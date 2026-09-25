/* ============================================================
   ABA PROSPECCAO
   Manda o seu e-mail de apresentacao para varias marcas da sua
   base de uma vez, chamando cada uma pelo nome.

   Os e-mails saem da aba Marcas. Esta aba nao guarda contato
   nenhum por conta propria.
   ============================================================ */

(function(){
  "use strict";
  var A = window.Admin;

  var MEU_EMAIL = "gabriellavazbraga@gmail.com";
  var MEU_NOME  = "Gabriella Braga";
  var NOME_EXEMPLO = "Marca Exemplo";
  var POR_LOTE = 100;

  var marcas = [], envios = [], optout = [], modelos = [];
  var area = null;
  var faltou = { envios:false, optout:false, modelos:false };

  var destino = "selecionadas";
  var modoEscrita = "texto";
  var modoEnvio = "resend";
  var pularJaRecebeu = true;

  var assunto = "";
  var corpoTexto = "";
  var corpoHTML = "";
  var botaoTexto = "";
  var botaoLink = "";

  var enviando = false;
  var progresso = null;
  var resultado = null;
  var fila = null;
  var buscaHistorico = "";

  /* ---------------- DADOS ---------------- */
  async function carregar(){
    var r1 = await window.Banco.consulta("marcas", function(c){
      return c.from("marcas").select("*").order("nome", { ascending:true });
    });
    marcas = r1.dados || [];

    var r2 = await window.Banco.consulta("email_envios", function(c){
      return c.from("email_envios").select("*").order("data", { ascending:false }).limit(600);
    });
    envios = r2.dados || [];
    faltou.envios = !!r2.erro;

    var r3 = await window.Banco.consulta("email_optout", function(c){
      return c.from("email_optout").select("email");
    });
    optout = r3.dados || [];
    faltou.optout = !!r3.erro;

    var r4 = await window.Banco.consulta("email_modelos", function(c){
      return c.from("email_modelos").select("*").order("slot", { ascending:true });
    });
    modelos = r4.dados || [];
    faltou.modelos = !!r4.erro;
  }

  function minusculo(t){ return String(t || "").trim().toLowerCase(); }

  function conjuntoOptout(){
    var s = {};
    optout.forEach(function(o){ s[minusculo(o.email)] = true; });
    return s;
  }

  function jaRecebeu(email, qualAssunto){
    var e = minusculo(email), a = String(qualAssunto || "").trim();
    return envios.some(function(v){
      return v.status === "ok" && minusculo(v.email) === e && String(v.assunto || "").trim() === a;
    });
  }

  /* ---------------- QUEM RECEBE ---------------- */
  function comEmail(){
    return marcas.filter(function(m){ return String(m.email || "").trim(); });
  }

  function situacoesExistentes(){
    var vistas = [];
    marcas.forEach(function(m){
      var s = String(m.situacao || "").trim();
      if (s && vistas.indexOf(s) === -1) vistas.push(s);
    });
    return vistas.sort();
  }

  function opcoesDestino(){
    var lista = [
      { valor:"selecionadas", rotulo:"Só as marcas que eu selecionei" },
      { valor:"eu",           rotulo:"Só para mim (teste)" },
      { valor:"todas",        rotulo:"Todas as marcas com e-mail" }
    ];
    situacoesExistentes().forEach(function(s){
      lista.push({ valor:"situacao:" + s, rotulo:"Só quem está como " + s });
    });
    return lista;
  }

  /* A lista bruta, antes de tirar repetido e descadastrado. */
  function listaBase(){
    if (destino === "eu") return [{ nome: MEU_NOME, email: MEU_EMAIL }];
    if (destino === "selecionadas") return comEmail().filter(function(m){ return m.selecionada; });
    if (destino === "todas") return comEmail();
    if (destino.indexOf("situacao:") === 0){
      var alvo = destino.slice(9);
      return comEmail().filter(function(m){ return String(m.situacao || "") === alvo; });
    }
    return [];
  }

  /* Quantas ficaram de fora por não ter e-mail cadastrado. */
  function semEmail(){
    if (destino === "eu" || destino === "selecionadas") return 0;
    var todas = destino === "todas"
      ? marcas
      : marcas.filter(function(m){ return String(m.situacao || "") === destino.slice(9); });
    return todas.filter(function(m){ return !String(m.email || "").trim(); }).length;
  }

  function destinatarios(){
    var fora = conjuntoOptout();
    var vistos = {};
    var lista = [], repetidos = 0, descadastrados = 0, jaForam = 0;

    listaBase().forEach(function(m){
      var e = minusculo(m.email);
      if (!e) return;
      if (vistos[e]){ repetidos++; return; }
      vistos[e] = true;
      if (fora[e]){ descadastrados++; return; }
      if (pularJaRecebeu && assunto.trim() && jaRecebeu(e, assunto)){ jaForam++; return; }
      lista.push({ id:m.id, nome:String(m.nome || "").trim(), email:String(m.email).trim() });
    });

    return { lista:lista, repetidos:repetidos, descadastrados:descadastrados, jaForam:jaForam };
  }

  /* ---------------- MONTAR O E-MAIL ---------------- */
  function escapar(t){
    return String(t === undefined || t === null ? "" : t)
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  /* Transforma o texto simples em HTML: parágrafos, quebras de
     linha e links clicáveis. */
  function textoParaHTML(texto){
    var pedacos = String(texto || "").split(/\n{2,}/);
    return pedacos.map(function(p){
      var corpo = escapar(p).replace(/\n/g, "<br>");
      corpo = corpo.replace(/(https?:\/\/[^\s<]+)/g, function(url){
        var limpo = url.replace(/[.,;:)]+$/, "");
        var sobra = url.slice(limpo.length);
        return '<a href="' + limpo + '" style="color:#4a6b12;">' + limpo + '</a>' + sobra;
      });
      return '<p style="margin:0 0 16px;">' + corpo + '</p>';
    }).join("");
  }

  function pedacoBotao(){
    if (!botaoTexto.trim() || !botaoLink.trim()) return "";
    return '<div style="margin:24px 0 6px;">' +
      '<a href="' + escapar(botaoLink.trim()) + '" style="display:inline-block;background:#c6f24e;color:#1c2400;' +
      'text-decoration:none;font-weight:bold;padding:13px 26px;border-radius:999px;font-size:15px;">' +
      escapar(botaoTexto.trim()) + '</a></div>';
  }

  function rodape(){
    return '<div style="margin-top:28px;padding-top:16px;border-top:1px solid #e3e4de;font-size:12px;' +
      'color:#8a8d84;line-height:1.6;">Se você não quiser mais receber estes e-mails, é só responder ' +
      'esta mensagem com a palavra SAIR.</div>';
  }

  function montarHTML(){
    if (modoEscrita === "html") return corpoHTML;
    return '<div style="background:#f3f4f2;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;">' +
      '<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px 26px;' +
      'color:#111214;font-size:15px;line-height:1.65;">' +
        textoParaHTML(corpoTexto) +
        pedacoBotao() +
        rodape() +
      '</div></div>';
  }

  function modeloHTMLDeExemplo(){
    var guardado = { texto: corpoTexto, modo: modoEscrita };
    modoEscrita = "texto";
    if (!corpoTexto.trim()){
      corpoTexto = "Oi {{nome}}, tudo bem?\n\nSou a Gabriella, criadora de conteúdo UGC. Acompanho a {{marca}} e acho que os meus vídeos combinam bastante com o que vocês vêm fazendo.\n\nDeixo aqui o meu portfólio para você dar uma olhada.\n\nUm abraço,\nGabriella";
    }
    var html = montarHTML();
    corpoTexto = guardado.texto;
    modoEscrita = guardado.modo;
    return html;
  }

  function trocarChaves(texto, nomeDaMarca){
    var completo = String(nomeDaMarca || "").trim();
    var primeiro = completo.split(/\s+/)[0] || completo;
    return String(texto || "")
      .replace(/\{\{\s*nome\s*\}\}/gi, primeiro)
      .replace(/\{\{\s*marca\s*\}\}/gi, completo);
  }

  function paraTextoPuro(html){
    var caixa = document.createElement("div");
    caixa.innerHTML = String(html || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/div>/gi, "\n");
    return (caixa.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
  }

  /* ---------------- CAPA E CARTOES ---------------- */
  function montarCapa(){
    var totalOk = envios.filter(function(e){ return e.status === "ok"; }).length;
    return '<div class="capa-prosp">' +
      '<span class="capa-prosp-icone">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="m2 7 10 6 10-6"/></svg>' +
      '</span>' +
      '<div class="capa-prosp-texto">' +
        '<h2>Prospecção</h2>' +
        '<p>Manda o seu e-mail de apresentação para várias marcas de uma vez, chamando cada uma pelo nome.</p>' +
      '</div>' +
      '<div class="capa-prosp-total">' +
        '<b>' + (totalOk ? totalOk : "-") + '</b>' +
        '<span>enviados até agora</span>' +
      '</div>' +
      '<div class="capa-prosp-chips">' +
        '<span>teste antes, sempre</span>' +
        '<span>a chave vive no Supabase</span>' +
        '<span>quem responde SAIR sai da lista</span>' +
      '</div>' +
    '</div>';
  }

  function cartao(cor, valor, rotulo, apoio){
    return '<div class="cartao-metrica" style="--cor:' + cor + '">' +
      '<b>' + A.escapar(valor) + '</b>' +
      '<div class="rotulo">' + A.escapar(rotulo) + '</div>' +
      (apoio ? '<div class="apoio">' + A.escapar(apoio) + '</div>' : '') +
    '</div>';
  }

  function montarCartoes(){
    var base = comEmail().length;
    var aEnviar = destinatarios().lista.length;

    var recebidos = {};
    envios.forEach(function(e){ if (e.status === "ok") recebidos[minusculo(e.email)] = true; });
    var quantosReceberam = Object.keys(recebidos).length;
    var falhas = envios.filter(function(e){ return e.status === "erro"; }).length;

    return '<div class="cartoes-prosp">' +
      cartao("#7ca316", base, "marcas com e-mail", base ? "na sua base de marcas" : "cadastre ou importe") +
      cartao("#2f6fd0", aEnviar, "a enviar", "na seleção de agora") +
      cartao("#2f7d43", faltou.envios ? "-" : quantosReceberam, "já receberam", faltou.envios ? "rode o disparo.sql" : "e-mails diferentes") +
      cartao("#a4730b", faltou.envios ? "-" : falhas, "falhas", faltou.envios ? "rode o disparo.sql" : "para limpar a base depois") +
      cartao("#b3261e", faltou.optout ? "-" : optout.length, "descadastrados", faltou.optout ? "rode o disparo.sql" : "responderam SAIR") +
    '</div>';
  }

  /* ---------------- MODELOS ---------------- */
  function modeloDoSlot(n){
    return modelos.filter(function(m){ return Number(m.slot) === n; })[0] || null;
  }

  function montarModelos(){
    if (faltou.modelos) return "";
    return '<div class="modelos-linha">' +
      '<span class="celula-fraca" style="font-size:.78rem;font-weight:600">Meus modelos:</span>' +
      [1,2,3].map(function(n){
        var m = modeloDoSlot(n);
        return '<button type="button" class="modelo-chip' + (m ? " cheio" : "") + '" data-modelo="' + n + '">' +
          A.escapar(m ? (m.nome || ("Modelo " + n)) : ("Modelo " + n + ", vazio")) + '</button>';
      }).join("") +
      '<button type="button" class="btn btn-pequeno" id="pSalvarModelo">Salvar o atual</button>' +
    '</div>';
  }

  function carregarModelo(n){
    var m = modeloDoSlot(n);
    if (!m){
      A.recado("Esse modelo está vazio. Escreva o e-mail e clique em salvar o atual.");
      return;
    }
    assunto = m.assunto || "";
    modoEscrita = m.modo === "html" ? "html" : "texto";
    if (modoEscrita === "html") corpoHTML = m.corpo || "";
    else corpoTexto = m.corpo || "";
    botaoTexto = m.botao_texto || "";
    botaoLink = m.botao_link || "";
    desenhar();
    A.recado("Modelo carregado");
  }

  function salvarModelo(){
    A.abrirJanela({
      titulo: "Salvar como modelo",
      corpo:
        '<div class="campo"><label for="pmNome">Nome do modelo</label>' +
        '<input id="pmNome" type="text" placeholder="Apresentação para skincare"></div>' +
        '<div class="campo"><label for="pmSlot">Guardar em qual espaço</label><select id="pmSlot">' +
          [1,2,3].map(function(n){
            var m = modeloDoSlot(n);
            return '<option value="' + n + '">Modelo ' + n + (m ? " (substitui " + A.escapar(m.nome || "o atual") + ")" : " (vazio)") + '</option>';
          }).join("") +
        '</select></div>',
      botoes: [
        { texto:"Cancelar", aoClicar:function(fechar){ fechar(); } },
        { texto:"Salvar", classe:"btn-lima", aoClicar:async function(fechar){
            var n = Number(document.getElementById("pmSlot").value);
            var nome = document.getElementById("pmNome").value.trim() || ("Modelo " + n);
            var r = await window.Banco.consulta("email_modelos", function(c){
              return c.from("email_modelos").upsert({
                slot: n, nome: nome, assunto: assunto, modo: modoEscrita,
                corpo: modoEscrita === "html" ? corpoHTML : corpoTexto,
                botao_texto: botaoTexto, botao_link: botaoLink,
                atualizado_em: new Date().toISOString()
              }, { onConflict: "slot" });
            });
            if (r.erro){ A.recado(r.erro, true); return; }
            fechar();
            A.recado("Modelo salvo");
            await recarregar();
          }
        }
      ]
    });
  }

  /* ---------------- ENVIO ---------------- */
  async function chamarFuncao(lote){
    try {
      var r = await window.Banco.cliente.functions.invoke("enviar-emails", {
        body: { destinatarios: lote, assunto: assunto, html: montarHTML() }
      });
      if (r.error){
        var detalhe = "";
        try { detalhe = (await r.error.context.json()).erro || ""; } catch (f){}
        return { falhou: true, mensagem: detalhe || "A função enviar-emails não respondeu. Confira se ela foi publicada no Supabase." };
      }
      return r.data || {};
    } catch (falha){
      return { falhou: true, mensagem: "Não consegui falar com a função de envio agora." };
    }
  }

  async function marcarComoEnviadas(lista){
    var hoje = A.paraISO(A.hoje());
    var ids = lista.map(function(d){ return d.id; }).filter(Boolean);
    if (!ids.length) return;
    await window.Banco.consulta("marcas", function(c){
      return c.from("marcas").update({ enviado_em: hoje, ultimo_assunto: assunto }).in("id", ids);
    });
  }

  function confirmarDisparo(){
    var info = destinatarios();
    var quantos = info.lista.length;
    var rotulo = (opcoesDestino().filter(function(o){ return o.valor === destino; })[0] || {}).rotulo || "";

    if (!assunto.trim()){ A.recado("Escreva o assunto do e-mail primeiro", true); return; }
    if (!montarHTML().trim()){ A.recado("Escreva o texto do e-mail primeiro", true); return; }

    if (destino === "selecionadas" && !quantos){
      A.abrirJanela({
        titulo: "Nenhuma marca selecionada",
        corpo: '<p style="margin:0;font-size:.88rem;line-height:1.6">Você escolheu mandar só para as marcas selecionadas, mas não há nenhuma marcada. Vá até a aba Marcas e marque as caixinhas das marcas que você quer.</p>',
        botoes: [
          { texto:"Fechar", aoClicar:function(fechar){ fechar(); } },
          { texto:"Ir para Marcas", classe:"btn-lima", aoClicar:function(fechar){ fechar(); A.irPara("marcas"); } }
        ]
      });
      return;
    }
    if (!quantos){ A.recado("Não há ninguém nessa seleção", true); return; }

    if (modoEscrita === "html" && !/SAIR/i.test(corpoHTML)){
      A.abrirJanela({
        titulo: "Falta o rodapé do SAIR",
        corpo: '<p style="margin:0;font-size:.88rem;line-height:1.6">No modo HTML sai exatamente o que você colou, e eu não acrescento nada por cima. Não encontrei a palavra SAIR no seu HTML, então o rodapé do descadastro está faltando. Quer disparar assim mesmo?</p>',
        botoes: [
          { texto:"Voltar e ajustar", aoClicar:function(fechar){ fechar(); } },
          { texto:"Disparar assim mesmo", classe:"btn-perigo", aoClicar:function(fechar){ fechar(); janelaConfirmacao(quantos, rotulo); } }
        ]
      });
      return;
    }

    janelaConfirmacao(quantos, rotulo);
  }

  function janelaConfirmacao(quantos, rotulo){
    A.abrirJanela({
      titulo: "Confirmar disparo",
      corpo:
        '<p style="margin:0 0 10px;font-size:.95rem;line-height:1.6">Este e-mail vai para <b>' + quantos +
        (quantos === 1 ? ' marca' : ' marcas') + '</b>, da lista <b>' + A.escapar(rotulo) + '</b>.</p>' +
        '<p style="margin:0;font-size:.88rem;line-height:1.6;color:var(--ink-fraco)">Depois de começar não dá para desfazer. Você já mandou o teste para você mesma?</p>',
      botoes: [
        { texto:"Cancelar", aoClicar:function(fechar){ fechar(); } },
        { texto:"Disparar agora", classe:"btn-lima", aoClicar:function(fechar){ fechar(); dispararTudo(); } }
      ]
    });
  }

  async function dispararTudo(){
    var lista = destinatarios().lista;
    enviando = true;
    resultado = null;
    progresso = { feitos:0, total:lista.length };
    desenhar();

    var totais = { enviados:0, falharam:0, pulados:0, cotaAcabou:false, faltaram:0, mensagem:"" };
    var enviadasComSucesso = [];

    for (var i = 0; i < lista.length; i += POR_LOTE){
      var lote = lista.slice(i, i + POR_LOTE);
      var r = await chamarFuncao(lote.map(function(d){ return { email:d.email, nome:d.nome }; }));

      if (r.falhou){
        totais.mensagem = r.mensagem;
        break;
      }

      totais.enviados += A.numero(r.enviados);
      totais.falharam += A.numero(r.falharam);
      totais.pulados  += A.numero(r.pulados);
      enviadasComSucesso = enviadasComSucesso.concat(lote);

      progresso.feitos = Math.min(i + lote.length, lista.length);
      desenhar();

      if (r.cotaAcabou){
        totais.cotaAcabou = true;
        totais.faltaram = lista.length - progresso.feitos + A.numero((r.faltaram || []).length);
        break;
      }
    }

    await marcarComoEnviadas(enviadasComSucesso);

    enviando = false;
    progresso = null;
    resultado = totais;
    await recarregar();

    if (destino === "selecionadas" && totais.enviados) perguntarLimparSelecao();
  }

  function perguntarLimparSelecao(){
    A.abrirJanela({
      titulo: "Limpar a seleção?",
      corpo: '<p style="margin:0;font-size:.88rem;line-height:1.6">O disparo terminou. Quer desmarcar as marcas que você tinha selecionado, ou prefere manter a seleção para mandar de novo depois?</p>',
      botoes: [
        { texto:"Manter selecionadas", aoClicar:function(fechar){ fechar(); } },
        { texto:"Limpar seleção", classe:"btn-lima", aoClicar:async function(fechar){
            fechar();
            var ids = marcas.filter(function(m){ return m.selecionada; }).map(function(m){ return m.id; });
            if (!ids.length) return;
            var r = await window.Banco.consulta("marcas", function(c){
              return c.from("marcas").update({ selecionada:false }).in("id", ids);
            });
            if (r.erro){ A.recado(r.erro, true); return; }
            A.recado("Seleção limpa");
            await recarregar();
          }
        }
      ]
    });
  }

  async function enviarTeste(){
    if (!assunto.trim()){ A.recado("Escreva o assunto primeiro", true); return; }
    if (!montarHTML().trim()){ A.recado("Escreva o texto primeiro", true); return; }

    A.recado("Enviando o teste...");
    var r = await chamarFuncao([{ email: MEU_EMAIL, nome: NOME_EXEMPLO }]);

    if (r.falhou){ A.recado(r.mensagem, true); return; }
    if (A.numero(r.enviados) > 0){
      A.recado("Teste enviado para " + MEU_EMAIL);
      await recarregar();
    } else if (r.cotaAcabou){
      A.recado("A cota diária do Resend acabou. Tente amanhã.", true);
    } else {
      A.recado("O teste não saiu. Confira a chave do Resend no Supabase.", true);
    }
  }

  /* ---------------- MODO RASCUNHO ---------------- */
  function abrirFila(){
    var lista = destinatarios().lista;
    if (!lista.length){
      if (destino === "selecionadas"){ confirmarDisparo(); return; }
      A.recado("Não há ninguém nessa seleção", true);
      return;
    }
    if (!assunto.trim()){ A.recado("Escreva o assunto primeiro", true); return; }
    fila = { lista: lista, posicao: 0 };
    desenhar();
  }

  function linkGmail(alvo){
    var assuntoFinal = trocarChaves(assunto, alvo.nome);
    var texto = paraTextoPuro(trocarChaves(montarHTML(), alvo.nome));
    return "https://mail.google.com/mail/?view=cm&fs=1" +
      "&to=" + encodeURIComponent(alvo.email) +
      "&su=" + encodeURIComponent(assuntoFinal) +
      "&body=" + encodeURIComponent(texto);
  }

  async function marcarDaFila(){
    var alvo = fila.lista[fila.posicao];
    if (!alvo) return;

    var hoje = A.paraISO(A.hoje());
    if (alvo.id){
      await window.Banco.consulta("marcas", function(c){
        return c.from("marcas").update({ enviado_em: hoje, ultimo_assunto: assunto }).eq("id", alvo.id);
      });
    }
    await window.Banco.consulta("email_envios", function(c){
      return c.from("email_envios").insert({
        email: alvo.email,
        assunto: trocarChaves(assunto, alvo.nome),
        status: "ok",
        erro: null,
        resend_id: null
      });
    });

    fila.lista.splice(fila.posicao, 1);
    if (fila.posicao >= fila.lista.length) fila.posicao = Math.max(0, fila.lista.length - 1);
    if (!fila.lista.length) fila = null;

    await recarregar();
    A.recado("Marcada como enviada");
  }

  function montarFila(){
    var alvo = fila.lista[fila.posicao];
    var assuntoFinal = trocarChaves(assunto, alvo.nome);
    var texto = paraTextoPuro(trocarChaves(montarHTML(), alvo.nome));

    return '<div class="fila-rascunho">' +
      '<div class="fila-contador">Faltam ' + fila.lista.length +
        (fila.lista.length === 1 ? " marca nesta fila" : " marcas nesta fila") + '</div>' +
      '<div class="fila-nome">' + A.escapar(alvo.nome || "sem nome") + '</div>' +
      '<div class="fila-email">' + A.escapar(alvo.email) + '</div>' +
      '<div class="campo"><label>Assunto</label>' +
      '<input type="text" readonly value="' + A.escapar(assuntoFinal) + '"></div>' +
      '<div class="campo"><label>Texto do e-mail</label>' +
      '<textarea id="pFilaTexto" class="area-roteiro" readonly style="min-height:190px">' + A.escapar(texto) + '</textarea></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<button type="button" class="btn" id="pFilaCopiar">Copiar o texto</button>' +
        '<a class="btn btn-lima" href="' + A.escapar(linkGmail(alvo)) + '" target="_blank" rel="noopener">Abrir no Gmail</a>' +
        '<span class="espaco"></span>' +
        '<button type="button" class="btn btn-pequeno" id="pFilaPular">Pular esta</button>' +
        '<button type="button" class="btn btn-principal" id="pFilaFeita">Marcar como enviada</button>' +
      '</div>' +
      '<div style="margin-top:10px"><button type="button" class="btn btn-pequeno" id="pFilaFechar">Fechar a fila</button></div>' +
    '</div>';
  }

  /* ---------------- PREVIA ---------------- */
  function htmlDaPrevia(){
    return trocarChaves(montarHTML(), NOME_EXEMPLO);
  }

  function montarPrevia(){
    var assuntoFinal = trocarChaves(assunto, NOME_EXEMPLO) || "Assunto do seu e-mail";
    return '<div class="prosp-previa">' +
      '<div class="ferramentas" style="margin-bottom:10px">' +
        '<p class="titulo-bloco" style="margin:0">Como vai chegar</p>' +
        '<span class="espaco"></span>' +
        '<button type="button" class="btn btn-pequeno" id="pTelaCheia">Ver em tela cheia</button>' +
      '</div>' +
      '<div class="palco">' +
        '<div class="janela-email">' +
          '<div class="janela-email-topo">' +
            '<span class="bolinha-remetente">' + A.escapar(MEU_NOME.charAt(0)) + '</span>' +
            '<div style="min-width:0">' +
              '<div class="janela-email-assunto">' + A.escapar(assuntoFinal) + '</div>' +
              '<div class="janela-email-de">' + A.escapar(MEU_NOME) + ' &lt;' + A.escapar(MEU_EMAIL) + '&gt; para você</div>' +
            '</div>' +
          '</div>' +
          '<div class="janela-email-corpo"><iframe id="pPreviaQuadro" title="Prévia do e-mail"></iframe></div>' +
        '</div>' +
      '</div>' +
      '<p class="previa-nota">Antes de disparar, mande o teste para você mesma e abra no celular. É lá que a maioria das marcas vai ler.</p>' +
    '</div>';
  }

  function encherPrevia(){
    var quadro = document.getElementById("pPreviaQuadro");
    if (!quadro) return;
    quadro.srcdoc = htmlDaPrevia() || '<p style="font-family:Arial;color:#8a8d84;padding:20px">Escreva o texto do e-mail para ver a prévia aqui.</p>';
    quadro.addEventListener("load", function(){
      try {
        var doc = quadro.contentDocument;
        quadro.style.height = Math.min(Math.max(doc.body.scrollHeight + 24, 260), 520) + "px";
      } catch (f){}
    });
  }

  function abrirTelaCheia(){
    var caixa = document.getElementById("pTelaCheiaCaixa");
    if (!caixa) return;
    document.getElementById("pTelaCheiaQuadro").srcdoc = htmlDaPrevia();
    caixa.classList.add("aparece");
  }

  /* ---------------- HISTORICO ---------------- */
  function montarHistorico(){
    if (faltou.envios){
      return '<div class="cartao"><div class="vazio"><b>O histórico ainda não existe</b>' +
        'Rode o arquivo disparo.sql no Supabase para criar a tabela de registro. ' +
        'O resto da aba continua funcionando.</div></div>';
    }
    var termo = buscaHistorico.trim().toLowerCase();
    var lista = envios.filter(function(e){
      if (!termo) return true;
      return minusculo(e.email).indexOf(termo) !== -1 || minusculo(e.assunto).indexOf(termo) !== -1;
    });

    if (!envios.length){
      return '<div class="cartao"><div class="vazio"><b>Nenhum e-mail enviado ainda</b>' +
        'Quando você disparar, cada destinatário vira uma linha aqui, com a data e se deu certo.</div></div>';
    }
    if (!lista.length){
      return '<div class="cartao"><div class="vazio"><b>Nada encontrado</b>Nenhum envio combina com essa busca.</div></div>';
    }

    return '<div class="rolagem cartao"><table>' +
      '<thead><tr><th>Para</th><th>Assunto</th><th>Quando</th><th>Situação</th></tr></thead><tbody>' +
      lista.slice(0, 200).map(function(e){
        return '<tr>' +
          '<td class="celula-forte">' + A.escapar(e.email) + '</td>' +
          '<td class="celula-fraca">' + A.escapar(e.assunto || "") + '</td>' +
          '<td class="celula-fraca">' + A.escapar(A.dataBR(e.data)) + '</td>' +
          '<td>' + (e.status === "ok"
            ? '<span class="pilula p-verde">enviado</span>'
            : '<span class="pilula p-vermelho" title="' + A.escapar(e.erro || "") + '">erro</span>') + '</td>' +
        '</tr>';
      }).join("") +
      '</tbody></table></div>';
  }

  /* ---------------- FORMULARIO ---------------- */
  function montarFormulario(){
    var info = destinatarios();
    var fora = semEmail();

    var avisos = [];
    if (info.repetidos)      avisos.push(info.repetidos + " com e-mail repetido");
    if (info.descadastrados) avisos.push(info.descadastrados + " que pediram para sair");
    if (info.jaForam)        avisos.push(info.jaForam + " que já receberam este assunto");
    if (fora)                avisos.push(fora + " sem e-mail cadastrado");

    return '<div>' +
      '<div class="origem-aviso">Os e-mails vêm da sua aba Marcas.</div>' +

      '<div class="campo"><label for="pDestino">Para quem vai</label>' +
      '<select id="pDestino">' +
        opcoesDestino().map(function(o){
          var quantos = "";
          if (o.valor === "selecionadas") quantos = " (" + comEmail().filter(function(m){ return m.selecionada; }).length + ")";
          return '<option value="' + A.escapar(o.valor) + '"' + (o.valor === destino ? " selected" : "") + '>' +
                 A.escapar(o.rotulo + quantos) + '</option>';
        }).join("") +
      '</select>' +
      '<div class="celula-fraca" style="font-size:.78rem;margin-top:6px">' +
        '<b>' + info.lista.length + (info.lista.length === 1 ? ' marca' : ' marcas') + '</b> nesta seleção' +
        (avisos.length ? ', fora ' + A.escapar(avisos.join(", ")) : '') +
      '</div></div>' +

      '<label class="campo-caixa" style="margin-bottom:14px">' +
      '<input type="checkbox" id="pPular"' + (pularJaRecebeu ? " checked" : "") + '> Pular quem já recebeu este mesmo assunto</label>' +

      montarModelos() +

      '<div class="modo-troca">' +
        '<button type="button" class="' + (modoEscrita === "texto" ? "ativo" : "") + '" data-modo="texto">Texto fácil</button>' +
        '<button type="button" class="' + (modoEscrita === "html" ? "ativo" : "") + '" data-modo="html">HTML</button>' +
      '</div>' +

      '<div class="campo"><label for="pAssunto">Assunto</label>' +
      '<input id="pAssunto" type="text" value="' + A.escapar(assunto) + '" placeholder="Parceria com a {{marca}}"></div>' +

      (modoEscrita === "texto"
        ? '<div class="campo"><label for="pCorpo">Texto do e-mail</label>' +
          '<textarea id="pCorpo" class="area-roteiro" style="min-height:220px" placeholder="Oi {{nome}}, tudo bem?">' + A.escapar(corpoTexto) + '</textarea>' +
          '<div class="celula-fraca" style="font-size:.76rem;margin-top:5px">Use <b>{{nome}}</b> para o primeiro nome e <b>{{marca}}</b> para o nome completo da marca.</div></div>'
        : '<div class="campo">' +
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">' +
            '<label for="pCorpoHTML" style="margin:0">HTML do e-mail</label>' +
            '<button type="button" class="btn btn-pequeno" id="pModeloPronto" style="margin-left:auto">Começar do modelo pronto</button>' +
          '</div>' +
          '<textarea id="pCorpoHTML" class="area-roteiro area-html">' + A.escapar(corpoHTML) + '</textarea>' +
          '<div class="celula-fraca" style="font-size:.76rem;margin-top:5px">Sai exatamente o que estiver aqui. O rodapé do SAIR precisa estar no seu HTML.</div></div>') +

      '<div class="campo-duplo">' +
        '<div class="campo"><label for="pBotaoTexto">Texto do botão (opcional)</label>' +
        '<input id="pBotaoTexto" type="text" value="' + A.escapar(botaoTexto) + '" placeholder="Ver meu portfólio"></div>' +
        '<div class="campo"><label for="pBotaoLink">Link do botão</label>' +
        '<input id="pBotaoLink" type="url" value="' + A.escapar(botaoLink) + '" placeholder="https://briellabraga.github.io/ugc"></div>' +
      '</div>' +

      '<div class="modo-troca" style="margin-top:4px">' +
        '<button type="button" class="' + (modoEnvio === "resend" ? "ativo" : "") + '" data-envio="resend">Disparo automático</button>' +
        '<button type="button" class="' + (modoEnvio === "rascunho" ? "ativo" : "") + '" data-envio="rascunho">Modo rascunho</button>' +
      '</div>' +

      (modoEnvio === "resend"
        ? '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">' +
            '<button type="button" class="btn" id="pTeste">Enviar teste para mim</button>' +
            '<button type="button" class="btn btn-lima" id="pDisparar"' + (enviando ? " disabled" : "") + '>' +
            (enviando ? "Enviando..." : "Disparar") + '</button>' +
          '</div>' +
          '<p class="previa-nota">O disparo automático só entrega para outras pessoas depois que você verificar um domínio seu no Resend. Antes disso, ele entrega só para você.</p>'
        : '<div style="margin-top:6px">' +
            '<button type="button" class="btn btn-lima" id="pAbrirFila">Montar a fila de rascunhos</button>' +
            '<p class="previa-nota">O modo rascunho funciona sem Resend. Ele monta o e-mail de cada marca e abre o Gmail já preenchido, para você só clicar em enviar.</p>' +
          '</div>') +

      (progresso
        ? '<div class="progresso-envio"><div class="progresso-geral">' +
            '<span class="trilho"><i style="width:' + Math.round(A.dividir(progresso.feitos, progresso.total) * 100) + '%"></i></span>' +
            '<span class="progresso-num">' + progresso.feitos + ' de ' + progresso.total + '</span>' +
          '</div></div>'
        : '') +

      (resultado ? montarResultado() : "") +
    '</div>';
  }

  function montarResultado(){
    var r = resultado;
    if (r.mensagem){
      return '<div class="aviso" style="margin-top:12px">' + A.icone("alerta") + '<div>' + A.escapar(r.mensagem) + '</div></div>';
    }
    var linha = r.enviados + " enviados, " + r.falharam + " com falha, " + r.pulados + " pulados.";
    if (r.cotaAcabou){
      return '<div class="aviso" style="margin-top:12px">' + A.icone("alerta") +
        '<div><b>A cota diária do Resend acabou no meio do disparo.</b><br>' + A.escapar(linha) +
        ' Ficaram faltando cerca de ' + A.numero(r.faltaram) + '.<br><br>' +
        'Volte amanhã, cole o mesmo assunto e o mesmo texto, deixe marcada a caixinha de pular quem já recebeu ' +
        'e dispare de novo. Assim ele manda só para quem ficou faltando.</div></div>';
    }
    return '<div class="progresso-envio" style="margin-top:12px"><b style="font-size:.9rem">Disparo concluído</b>' +
      '<div class="celula-fraca" style="font-size:.83rem;margin-top:4px">' + A.escapar(linha) + '</div></div>';
  }

  /* ---------------- DESENHAR ---------------- */
  function desenhar(){
    if (!comEmail().length){
      area.innerHTML = montarCapa() + montarCartoes() +
        '<div class="cartao"><div class="vazio"><b>A sua base ainda está sem e-mail</b>' +
        'A prospecção manda para os e-mails que estão na sua aba Marcas, e nenhuma marca sua tem e-mail preenchido ainda. ' +
        'Cadastre uma marca ou importe a sua planilha primeiro.' +
        '<div style="margin-top:14px"><button type="button" class="btn btn-lima" id="pIrMarcas">Ir para a aba Marcas</button></div>' +
        '</div></div>';
      var ir = document.getElementById("pIrMarcas");
      if (ir) ir.addEventListener("click", function(){ A.irPara("marcas"); });
      return;
    }

    area.innerHTML =
      montarCapa() +
      montarCartoes() +
      (fila
        ? montarFila()
        : '<div class="prosp-colunas">' + montarFormulario() + montarPrevia() + '</div>') +
      '<div class="ferramentas" style="margin-top:22px">' +
        '<p class="titulo-bloco" style="margin:0">Histórico de envios</p>' +
        '<span class="espaco"></span>' +
        '<div class="busca">' + A.icone("busca") +
        '<input type="search" id="pBuscaHist" placeholder="Buscar por e-mail ou assunto" value="' + A.escapar(buscaHistorico) + '"></div>' +
      '</div>' +
      montarHistorico() +
      '<div class="tela-cheia" id="pTelaCheiaCaixa">' +
        '<div class="tela-cheia-caixa">' +
          '<div class="janela-topo"><h2>Prévia do e-mail</h2>' +
          '<button type="button" class="janela-fechar" id="pFecharCheia" aria-label="Fechar">✕</button></div>' +
          '<iframe id="pTelaCheiaQuadro" title="Prévia em tela cheia"></iframe>' +
        '</div>' +
      '</div>';

    ligarEventos();
    if (!fila) encherPrevia();
  }

  /* Espera você parar de digitar para redesenhar a prévia, em vez
     de recarregar a cada letra. */
  var temporizador = null;
  function aoDigitar(id, guardar){
    var campo = document.getElementById(id);
    if (!campo) return;
    campo.addEventListener("input", function(){
      guardar(campo.value);
      clearTimeout(temporizador);
      temporizador = setTimeout(function(){
        encherPrevia();
        atualizarContador();
      }, 350);
    });
  }

  /* Atualiza só o número de destinatários, sem redesenhar a tela
     inteira enquanto ela digita. */
  function atualizarContador(){
    var alvo = area.querySelector("#pDestino");
    if (!alvo) return;
    var pai = alvo.parentNode.querySelector(".celula-fraca");
    if (!pai) return;
    var info = destinatarios();
    pai.innerHTML = '<b>' + info.lista.length + (info.lista.length === 1 ? ' marca' : ' marcas') + '</b> nesta seleção';
  }

  function ligarEventos(){
    if (fila){
      var copiar = document.getElementById("pFilaCopiar");
      if (copiar) copiar.addEventListener("click", function(){
        var campo = document.getElementById("pFilaTexto");
        campo.select();
        try { document.execCommand("copy"); A.recado("Texto copiado"); }
        catch (f){ A.recado("Selecione o texto e use Ctrl C", true); }
      });
      var pular = document.getElementById("pFilaPular");
      if (pular) pular.addEventListener("click", function(){
        fila.posicao = (fila.posicao + 1) % fila.lista.length;
        desenhar();
      });
      var feita = document.getElementById("pFilaFeita");
      if (feita) feita.addEventListener("click", marcarDaFila);
      var fechar = document.getElementById("pFilaFechar");
      if (fechar) fechar.addEventListener("click", function(){ fila = null; desenhar(); });
    } else {
      var seletor = document.getElementById("pDestino");
      if (seletor) seletor.addEventListener("change", function(){ destino = seletor.value; desenhar(); });

      var caixaPular = document.getElementById("pPular");
      if (caixaPular) caixaPular.addEventListener("change", function(){
        pularJaRecebeu = caixaPular.checked;
        desenhar();
      });

      area.querySelectorAll("[data-modo]").forEach(function(b){
        b.addEventListener("click", function(){ modoEscrita = b.dataset.modo; desenhar(); });
      });
      area.querySelectorAll("[data-envio]").forEach(function(b){
        b.addEventListener("click", function(){ modoEnvio = b.dataset.envio; desenhar(); });
      });
      area.querySelectorAll("[data-modelo]").forEach(function(b){
        b.addEventListener("click", function(){ carregarModelo(Number(b.dataset.modelo)); });
      });

      var salvar = document.getElementById("pSalvarModelo");
      if (salvar) salvar.addEventListener("click", salvarModelo);

      aoDigitar("pAssunto", function(v){ assunto = v; });
      aoDigitar("pCorpo", function(v){ corpoTexto = v; });
      aoDigitar("pCorpoHTML", function(v){ corpoHTML = v; });
      aoDigitar("pBotaoTexto", function(v){ botaoTexto = v; });
      aoDigitar("pBotaoLink", function(v){ botaoLink = v; });

      var pronto = document.getElementById("pModeloPronto");
      if (pronto) pronto.addEventListener("click", function(){
        corpoHTML = modeloHTMLDeExemplo();
        desenhar();
        A.recado("Modelo colado, agora é só mexer");
      });

      var teste = document.getElementById("pTeste");
      if (teste) teste.addEventListener("click", enviarTeste);

      var disparar = document.getElementById("pDisparar");
      if (disparar) disparar.addEventListener("click", confirmarDisparo);

      var abrirF = document.getElementById("pAbrirFila");
      if (abrirF) abrirF.addEventListener("click", abrirFila);

      var cheia = document.getElementById("pTelaCheia");
      if (cheia) cheia.addEventListener("click", abrirTelaCheia);
    }

    var fecharCheia = document.getElementById("pFecharCheia");
    if (fecharCheia) fecharCheia.addEventListener("click", function(){
      document.getElementById("pTelaCheiaCaixa").classList.remove("aparece");
    });

    var busca = document.getElementById("pBuscaHist");
    if (busca) busca.addEventListener("input", function(){
      buscaHistorico = busca.value;
      var posicao = busca.selectionStart;
      desenhar();
      var novo = document.getElementById("pBuscaHist");
      if (novo){ novo.focus(); try { novo.setSelectionRange(posicao, posicao); } catch (f){} }
    });
  }

  async function recarregar(){
    await carregar();
    desenhar();
  }

  A.registrarAba({
    id: "prospeccao",
    nome: "Prospecção",
    subtitulo: "Manda o seu e-mail de apresentação para várias marcas de uma vez",
    icone: "prospeccao",
    grupo: "rotina",
    montar: async function(destinoArea){
      area = destinoArea;
      resultado = null;
      fila = null;
      await carregar();
      desenhar();
    }
  });

})();
