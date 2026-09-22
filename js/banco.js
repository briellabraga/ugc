/* ============================================================
   CONEXAO COM O BANCO (Supabase)

   Este e o unico arquivo onde ficam o endereco do projeto e a
   chave publica. Todas as paginas usam ele: o portfolio, a tela
   de entrar e o painel.

   A chave abaixo e a chave PUBLICA (publishable). Ela pode ficar
   aqui e pode ir para o GitHub sem problema: sozinha ela nao da
   acesso a nada, porque quem protege os seus dados e a tranca
   (RLS) que esta no arquivo banco.sql.

   NUNCA coloque aqui a chave secreta (service_role).
   ============================================================ */

window.Banco = (function(){
  "use strict";

  var URL_PROJETO = "https://igvruyzpmewevfabxcsa.supabase.co";
  var CHAVE_PUBLICA = "sb_publishable_KvL0Rz6gDq3oFReTuH4JFw_i54r-Bux";

  // Guarda os avisos de coisa que faltou no banco, para o painel
  // conseguir mostrar na tela sem parar de funcionar.
  var avisos = [];
  var aoAvisar = null;

  var cliente = null;
  if (window.supabase && window.supabase.createClient){
    cliente = window.supabase.createClient(URL_PROJETO, CHAVE_PUBLICA, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
  }

  function avisar(texto){
    if (avisos.indexOf(texto) === -1){
      avisos.push(texto);
      if (typeof aoAvisar === "function") aoAvisar(avisos);
    }
  }

  /* Traduz o erro tecnico do banco para uma frase em portugues.
     Assim o painel nunca mostra texto em ingles na tela. */
  function explicarErro(rotulo, erro){
    var codigo = (erro && erro.code) || "";
    var mensagem = (erro && erro.message) || "";

    if (codigo === "42P01" || /does not exist|not find the table|schema cache/i.test(mensagem)){
      return "A tabela \"" + rotulo + "\" ainda nao existe no banco. Rode o arquivo banco.sql no Supabase.";
    }
    if (codigo === "42703" || /column .* does not exist/i.test(mensagem)){
      return "Falta uma coluna na tabela \"" + rotulo + "\". Rode o arquivo banco.sql de novo no Supabase.";
    }
    if (codigo === "42501" || /row-level security|permission denied/i.test(mensagem)){
      return "Sem permissao para acessar \"" + rotulo + "\". Confira se voce entrou com o e-mail certo.";
    }
    if (/Failed to fetch|NetworkError/i.test(mensagem)){
      return "Nao consegui falar com o banco agora. Confira a sua internet.";
    }
    return "Nao consegui carregar \"" + rotulo + "\" agora.";
  }

  /* Executa uma operacao no banco sem nunca derrubar a pagina.
     Sempre devolve { dados, erro }. Se der errado, "erro" vem com
     uma frase em portugues e "dados" vem com a reserva combinada. */
  async function consulta(rotulo, executar, reserva){
    if (!cliente){
      var falta = "A biblioteca do banco nao carregou. Confira a sua internet e recarregue a pagina.";
      avisar(falta);
      return { dados: reserva === undefined ? [] : reserva, erro: falta };
    }
    try {
      var resposta = await executar(cliente);
      if (resposta && resposta.error){
        var texto = explicarErro(rotulo, resposta.error);
        avisar(texto);
        return { dados: reserva === undefined ? [] : reserva, erro: texto };
      }
      return { dados: resposta ? resposta.data : null, erro: null };
    } catch (falha){
      var aviso = explicarErro(rotulo, falha);
      avisar(aviso);
      return { dados: reserva === undefined ? [] : reserva, erro: aviso };
    }
  }

  async function sessao(){
    if (!cliente) return null;
    try {
      var r = await cliente.auth.getSession();
      return (r && r.data && r.data.session) || null;
    } catch (falha){
      return null;
    }
  }

  async function sair(){
    if (!cliente) return;
    try { await cliente.auth.signOut(); } catch (falha){}
  }

  /* De onde a pessoa veio: instagram, google, link direto e por ai.
     Nao usa servico de fora e nao pede nada para o visitante. */
  function descobrirOrigem(){
    var vindo = document.referrer || "";
    var busca = new URLSearchParams(window.location.search);
    var marcado = busca.get("utm_source") || busca.get("origem");
    if (marcado) return marcado.toLowerCase().slice(0, 40);
    if (!vindo) return "direto";
    try {
      var dominio = new window.URL(vindo).hostname.replace(/^www\./, "");
      if (dominio === window.location.hostname) return "direto";
      if (/instagram/.test(dominio))  return "instagram";
      if (/tiktok/.test(dominio))     return "tiktok";
      if (/google/.test(dominio))     return "google";
      if (/facebook/.test(dominio))   return "facebook";
      if (/youtube|youtu\.be/.test(dominio)) return "youtube";
      if (/linkedin/.test(dominio))   return "linkedin";
      if (/wa\.me|whatsapp/.test(dominio)) return "whatsapp";
      return dominio.slice(0, 40);
    } catch (falha){
      return "direto";
    }
  }

  /* Registra a visita. Conta uma vez por aba aberta, para nao
     inflar o numero quando voce recarrega a pagina. */
  async function registrarVisita(pagina){
    if (!cliente) return;
    try {
      if (sessionStorage.getItem("visitaRegistrada")) return;
      sessionStorage.setItem("visitaRegistrada", "1");
    } catch (falha){ /* navegador sem storage: registra mesmo assim */ }

    try {
      await cliente.from("visitas").insert({
        pagina: pagina || window.location.pathname || "/",
        origem: descobrirOrigem()
      });
    } catch (falha){
      /* Se falhar, o site continua normal. Visita nao e essencial. */
    }
  }

  return {
    URL_PROJETO: URL_PROJETO,
    cliente: cliente,
    consulta: consulta,
    sessao: sessao,
    sair: sair,
    registrarVisita: registrarVisita,
    avisos: avisos,
    definirAvisador: function(fn){ aoAvisar = fn; },
    avisar: avisar
  };
})();
