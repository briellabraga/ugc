// ============================================================
// FUNCAO enviar-emails
//
// Este arquivo NAO faz parte do seu site. Ele mora dentro do
// Supabase, e e o unico lugar que enxerga a chave do Resend.
//
// Esta versao nao usa nenhuma biblioteca de fora. Ela fala com o
// Supabase e com o Resend direto, so com recursos que ja existem
// no Deno. Isso e de proposito: sem download no momento de
// publicar, a publicacao nao tem como falhar por causa disso.
//
// ONDE COLAR:
// 1. No Supabase, menu da esquerda, Edge Functions
// 2. Deploy a new function, opcao Via editor
// 3. Nome exato: enviar-emails
// 4. Apague TODO o exemplo que vier e cole este arquivo inteiro
// 5. Clique no botao Deploy function, no canto de cima
//
// A CHAVE SECRETA vai em outro lugar, nos segredos:
//   Nome:  RESEND_API_KEY
//   Valor: a chave do Resend, que comeca com re_
// ============================================================

// So esta pessoa pode disparar. Qualquer outra recebe recusa.
const DONA = "gabriellavazbraga@gmail.com";

// Para onde vai a resposta da marca quando ela apertar responder, e
// tambem para onde chega quem pedir para sair da lista.
// Se um dia esse endereco mudar, basta criar o segredo RESPONDER_PARA
// no Supabase, sem precisar publicar a funcao outra vez.
const RESPONDER_PARA = Deno.env.get("RESPONDER_PARA") || "gabriellabragaugc@gmail.com";

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

  const BASE = Deno.env.get("SUPABASE_URL") || "";
  const ANON = Deno.env.get("SUPABASE_ANON_KEY") || "";

  // ---------- 1. So a dona logada passa ----------
  const autorizacao = req.headers.get("Authorization") || "";
  if (!autorizacao.startsWith("Bearer ")) {
    return responder({ erro: "Você precisa estar logada para disparar." }, 401);
  }

  let email = "";
  try {
    const resposta = await fetch(BASE + "/auth/v1/user", {
      headers: { apikey: ANON, Authorization: autorizacao },
    });
    const usuario = await resposta.json();
    email = String(usuario?.email || "").toLowerCase();
  } catch {
    return responder({ erro: "Não consegui confirmar o seu login." }, 401);
  }

  if (!email) return responder({ erro: "Não consegui confirmar o seu login." }, 401);
  if (email !== DONA.toLowerCase()) {
    return responder({ erro: "Esta conta não tem permissão para disparar." }, 403);
  }

  // ---------- 2. O que veio do painel ----------
  let entrada: {
    destinatarios?: { email: string; nome?: string }[];
    assunto?: string;
    html?: string;
  } = {};

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
      { erro: "São no máximo " + MAXIMO_POR_CHAMADA + " destinatários por vez. Vieram " + destinatarios.length + "." },
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
  // Enquanto nao houver dominio proprio, o endereco tem que ser o de
  // teste do Resend, mas o nome que aparece na caixa de entrada pode
  // ser o seu. Com dominio proprio, basta trocar o segredo
  // EMAIL_REMETENTE por algo como: Gabriella Braga <contato@seudominio.com>
  const remetente = Deno.env.get("EMAIL_REMETENTE") || "Gabriella Braga <onboarding@resend.dev>";

  // Nunca duas vezes para o mesmo e-mail no mesmo disparo.
  const vistos = new Set<string>();
  destinatarios = destinatarios.filter((d) => {
    const e = String(d?.email || "").trim().toLowerCase();
    if (!e || vistos.has(e)) return false;
    vistos.add(e);
    return true;
  });

  // ---------- 5. Quem pediu para sair nao recebe ----------
  const fora = new Set<string>();
  try {
    const resposta = await fetch(BASE + "/rest/v1/email_optout?select=email", {
      headers: { apikey: ANON, Authorization: autorizacao },
    });
    const linhas = await resposta.json();
    if (Array.isArray(linhas)) {
      for (const l of linhas) fora.add(String(l?.email || "").toLowerCase());
    }
  } catch {
    // Sem a lista de descadastro o envio continua, so nao filtra.
  }

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

    if (cotaAcabou) {
      faltaram.push(paraEmail);
      continue;
    }

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
          Authorization: "Bearer " + chave,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: remetente,
          to: [paraEmail],
          subject: assuntoFinal,
          html: htmlFinal,
          reply_to: RESPONDER_PARA,
          headers: {
            "List-Unsubscribe": "<mailto:" + RESPONDER_PARA + "?subject=SAIR>",
          },
        }),
      });

      let corpo: Record<string, unknown> = {};
      try { corpo = await resposta.json(); } catch { corpo = {}; }

      if (resposta.ok && corpo?.id) {
        enviados++;
        registros.push({ email: paraEmail, assunto: assuntoFinal, status: "ok", resend_id: String(corpo.id) });
      } else {
        const nomeDoErro = String(corpo?.name || "");
        const textoDoErro = String(corpo?.message || corpo?.error || ("erro " + resposta.status));

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
      const texto = falha instanceof Error ? falha.message : String(falha);
      registros.push({ email: paraEmail, assunto: assuntoFinal, status: "erro", erro: texto.slice(0, 400) });
    }

    // ---------- 6. Ritmo seguro ----------
    if (i < destinatarios.length - 1 && !cotaAcabou) await esperar(PAUSA_ENTRE_ENVIOS);
  }

  // ---------- 9. Uma linha por destinatario no registro ----------
  if (registros.length) {
    try {
      const gravar = await fetch(BASE + "/rest/v1/email_envios", {
        method: "POST",
        headers: {
          apikey: ANON,
          Authorization: autorizacao,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(registros),
      });
      if (!gravar.ok) {
        return responder({
          enviados, falharam, pulados, cotaAcabou, faltaram,
          aviso: "Os e-mails saíram, mas não consegui gravar o registro. Rode o arquivo disparo.sql no Supabase.",
        });
      }
    } catch {
      return responder({
        enviados, falharam, pulados, cotaAcabou, faltaram,
        aviso: "Os e-mails saíram, mas não consegui gravar o registro.",
      });
    }
  }

  // ---------- 11. O resultado ----------
  return responder({ enviados, falharam, pulados, cotaAcabou, faltaram });
});
