// ============================================================
// FUNCAO enviar-emails
//
// Este arquivo NAO faz parte do seu site. Ele mora dentro do
// Supabase, e e o unico lugar que enxerga a chave do Resend.
//
// ONDE COLAR:
// 1. Entre no Supabase e abra o seu projeto
// 2. Menu da esquerda, clique em "Edge Functions"
// 3. Clique em "Deploy a new function", escolha criar pelo editor
// 4. De o nome exato: enviar-emails
// 5. Apague o exemplo que vier e cole TODO este arquivo
// 6. Clique em "Deploy"
//
// ONDE COLAR A CHAVE SECRETA (isso e separado):
// Em Edge Functions, aba "Secrets", clique em "Add new secret":
//   Nome:  RESEND_API_KEY
//   Valor: a chave que voce gerou no Resend (comeca com re_)
// Salve. Essa chave nunca aparece no seu site.
//
// Se um dia voce verificar um dominio seu no Resend, crie tambem
// o segredo EMAIL_REMETENTE com algo como contato@seudominio.com.
// Sem ele, a funcao usa o remetente de teste do Resend, que so
// entrega e-mail para voce mesma.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// So esta pessoa pode disparar. Qualquer outra recebe recusa.
const DONA = "gabriellavazbraga@gmail.com";

// Para onde vai a resposta da marca quando ela apertar responder.
const RESPONDER_PARA = "gabriellavazbraga@gmail.com";

// Teto por chamada, combinado para nao estourar.
const MAXIMO_POR_CHAMADA = 250;

// Ritmo seguro do Resend: cinco por segundo.
const PAUSA_ENTRE_ENVIOS = 200;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function responder(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function esperar(ms: number) {
  return new Promise((ok) => setTimeout(ok, ms));
}

// Troca {{nome}} pelo primeiro nome e {{marca}} pelo nome completo.
function personalizar(texto: string, nomeDaMarca: string) {
  const completo = (nomeDaMarca || "").trim();
  const primeiro = completo.split(/\s+/)[0] || completo;
  return String(texto || "")
    .replace(/\{\{\s*nome\s*\}\}/gi, primeiro)
    .replace(/\{\{\s*marca\s*\}\}/gi, completo);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return responder({ erro: "Método não permitido" }, 405);

  // ---------- 1. So a dona logada passa ----------
  const autorizacao = req.headers.get("Authorization") || "";
  if (!autorizacao.startsWith("Bearer ")) {
    return responder({ erro: "Você precisa estar logada para disparar." }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: autorizacao } } },
  );

  const { data: dadosUsuario, error: erroUsuario } = await supabase.auth.getUser();
  const email = dadosUsuario?.user?.email?.toLowerCase() || "";

  if (erroUsuario || !email) {
    return responder({ erro: "Não consegui confirmar o seu login." }, 401);
  }
  if (email !== DONA.toLowerCase()) {
    return responder({ erro: "Esta conta não tem permissão para disparar." }, 403);
  }

  // ---------- 2. O que veio do painel ----------
  let entrada: {
    destinatarios?: { email: string; nome?: string }[];
    assunto?: string;
    html?: string;
  };
  try {
    entrada = await req.json();
  } catch {
    return responder({ erro: "Não entendi o que o painel mandou." }, 400);
  }

  const assunto = String(entrada.assunto || "").trim();
  const html = String(entrada.html || "");
  let destinatarios = Array.isArray(entrada.destinatarios) ? entrada.destinatarios : [];

  if (!assunto) return responder({ erro: "Falta o assunto do e-mail." }, 400);
  if (!html) return responder({ erro: "Falta o texto do e-mail." }, 400);
  if (!destinatarios.length) return responder({ erro: "A lista de destinatários está vazia." }, 400);

  // ---------- 3. Teto de 250 ----------
  if (destinatarios.length > MAXIMO_POR_CHAMADA) {
    return responder(
      { erro: `São no máximo ${MAXIMO_POR_CHAMADA} destinatários por vez. Vieram ${destinatarios.length}.` },
      400,
    );
  }

  const chave = Deno.env.get("RESEND_API_KEY");
  if (!chave) {
    return responder(
      { erro: "A chave do Resend ainda não foi cadastrada. Coloque o segredo RESEND_API_KEY no Supabase." },
      500,
    );
  }
  const remetente = Deno.env.get("EMAIL_REMETENTE") || "onboarding@resend.dev";

  // Nunca duas vezes para o mesmo e-mail no mesmo disparo.
  const vistos = new Set<string>();
  destinatarios = destinatarios.filter((d) => {
    const e = String(d?.email || "").trim().toLowerCase();
    if (!e || vistos.has(e)) return false;
    vistos.add(e);
    return true;
  });

  // ---------- 5. Quem pediu para sair nao recebe ----------
  const { data: descadastrados } = await supabase.from("email_optout").select("email");
  const fora = new Set((descadastrados || []).map((r: { email: string }) => String(r.email || "").toLowerCase()));

  // ---------- Envio ----------
  let enviados = 0;
  let falharam = 0;
  let pulados = 0;
  let cotaAcabou = false;
  const faltaram: string[] = [];
  const registros: Record<string, unknown>[] = [];

  for (let i = 0; i < destinatarios.length; i++) {
    const alvo = destinatarios[i];
    const paraEmail = String(alvo?.email || "").trim();
    const nomeDaMarca = String(alvo?.nome || "").trim();

    if (cotaAcabou) { faltaram.push(paraEmail); continue; }

    if (fora.has(paraEmail.toLowerCase())) {
      pulados++;
      continue;
    }

    const assuntoFinal = personalizar(assunto, nomeDaMarca);
    const htmlFinal = personalizar(html, nomeDaMarca);

    try {
      const resposta = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${chave}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: remetente,
          to: [paraEmail],
          subject: assuntoFinal,
          html: htmlFinal,
          reply_to: RESPONDER_PARA,
          headers: {
            "List-Unsubscribe": `<mailto:${RESPONDER_PARA}?subject=SAIR>`,
          },
        }),
      });

      const corpo = await resposta.json().catch(() => ({}));

      if (resposta.ok && corpo?.id) {
        enviados++;
        registros.push({ email: paraEmail, assunto: assuntoFinal, status: "ok", resend_id: corpo.id });
      } else {
        const nomeDoErro = String(corpo?.name || "");
        const textoDoErro = String(corpo?.message || corpo?.error || `erro ${resposta.status}`);

        // ---------- 10. Cota diaria acabou: para na hora ----------
        if (nomeDoErro === "daily_quota_exceeded" || /daily.quota/i.test(textoDoErro)) {
          cotaAcabou = true;
          faltaram.push(paraEmail);
          registros.push({ email: paraEmail, assunto: assuntoFinal, status: "erro", erro: "cota diária do Resend acabou" });
          continue;
        }

        falharam++;
        registros.push({ email: paraEmail, assunto: assuntoFinal, status: "erro", erro: textoDoErro.slice(0, 400) });
      }
    } catch (falha) {
      falharam++;
      registros.push({
        email: paraEmail,
        assunto: assuntoFinal,
        status: "erro",
        erro: String((falha as Error)?.message || falha).slice(0, 400),
      });
    }

    // ---------- 6. Ritmo seguro ----------
    if (i < destinatarios.length - 1 && !cotaAcabou) await esperar(PAUSA_ENTRE_ENVIOS);
  }

  // ---------- 9. Uma linha por destinatario no registro ----------
  if (registros.length) {
    const { error: erroRegistro } = await supabase.from("email_envios").insert(registros);
    if (erroRegistro) {
      return responder({
        enviados, falharam, pulados, cotaAcabou, faltaram,
        aviso: "Os e-mails saíram, mas não consegui gravar o registro. Rode o arquivo disparo.sql no Supabase.",
      });
    }
  }

  // ---------- 11. O resultado ----------
  return responder({ enviados, falharam, pulados, cotaAcabou, faltaram });
});
