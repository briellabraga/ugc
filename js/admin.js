/* ============================================================
   MIOLO DO PAINEL
   Cuida de: conferir a sessao, montar o menu, trocar de aba e
   oferecer as ferramentas que as abas usam (janela, recado,
   formatos de data e dinheiro, download de CSV).
   ============================================================ */

window.Admin = (function(){
  "use strict";

  var abas = [];
  var abaAtual = null;
  var email = "";

  /* ---------------- ICONES DE TRACO ---------------- */
  var CAMINHOS = {
    portfolio:  '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    marcas:     '<path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M10 21v-5h4v5"/>',
    calendario: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    campanhas:  '<path d="M3 11v3a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1Z"/><path d="M16 9a4 4 0 0 1 0 6"/><path d="M19 6a8 8 0 0 1 0 12"/>',
    checklist:  '<path d="M9 11l2 2 4-4"/><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4"/>',
    transcricao:'<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M7 8h6M7 12h4"/><path d="M8 20h8M12 16v4"/>',
    menu:       '<path d="M4 6h16M4 12h16M4 18h16"/>',
    sair:       '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
    mais:       '<path d="M12 5v14M5 12h14"/>',
    busca:      '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    lapis:      '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    lixo:       '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>',
    olho:       '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    olhoFechado:'<path d="M3 3l18 18"/><path d="M10.6 5.2A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-3.1 4"/><path d="M6.2 6.2A18 18 0 0 0 2 12s3.5 7 10 7a10.7 10.7 0 0 0 4.3-.9"/>',
    alcinha:    '<circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/>',
    estrela:    '<path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.9l1.1-6.5L2.6 9.8l6.5-.9Z"/>',
    baixar:     '<path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M4 21h16"/>',
    subir:      '<path d="M12 18V6"/><path d="m7 10 5-5 5 5"/><path d="M4 21h16"/>',
    esquerda:   '<path d="m15 18-6-6 6-6"/>',
    direita:    '<path d="m9 18 6-6-6-6"/>',
    baixo:      '<path d="m6 9 6 6 6-6"/>',
    fechar:     '<path d="M18 6 6 18M6 6l12 12"/>',
    alerta:     '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.8 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z"/>',
    zap:        '<path d="M21 11.5a8.4 8.4 0 0 1-11.9 7.6L3 21l1.9-5.9A8.4 8.4 0 1 1 21 11.5Z"/>',
    arroba:     '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>',
    play:       '<path d="M6 4l14 8-14 8Z"/>',
    link:       '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7L12 19"/>'
  };

  function icone(nome, tamanho){
    var d = CAMINHOS[nome] || "";
    var t = tamanho || 16;
    return '<svg viewBox="0 0 24 24" width="' + t + '" height="' + t + '" fill="none" ' +
           'stroke="currentColor" stroke-width="1.7" stroke-linecap="round" ' +
           'stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  }

  /* ---------------- FERRAMENTAS DE TEXTO ---------------- */
  function escapar(texto){
    return String(texto === undefined || texto === null ? "" : texto)
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }

  /* Nunca devolve NaN. Se nao for numero, devolve o reserva. */
  function numero(valor, reserva){
    var n = Number(valor);
    return isFinite(n) ? n : (reserva === undefined ? 0 : reserva);
  }

  /* Divisao que nunca quebra quando o de baixo e zero. */
  function dividir(cima, baixo){
    var a = numero(cima), b = numero(baixo);
    if (!b) return 0;
    var r = a / b;
    return isFinite(r) ? r : 0;
  }

  function dinheiro(valor){
    return numero(valor).toLocaleString("pt-BR", {
      style:"currency", currency:"BRL", minimumFractionDigits:2, maximumFractionDigits:2
    });
  }

  /* Devolve sempre o dia no horario de Brasilia, nunca no fuso do
     servidor. Uma visita das 21h nao pode virar visita de amanha.
     Data pura ("2026-09-22") entra como o dia 22 mesmo. Data com
     hora e convertida para o dia local de quem esta olhando. */
  function lerData(texto){
    if (!texto) return null;
    if (texto instanceof Date){
      return isNaN(texto) ? null : new Date(texto.getFullYear(), texto.getMonth(), texto.getDate());
    }

    var t = String(texto).trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(t)){
      var p = t.split("-");
      var pura = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
      return isNaN(pura) ? null : pura;
    }

    var comHora = new Date(t);
    if (isNaN(comHora)) return null;
    return new Date(comHora.getFullYear(), comHora.getMonth(), comHora.getDate());
  }

  function dataBR(texto){
    var d = lerData(texto);
    if (!d) return "";
    return String(d.getDate()).padStart(2,"0") + "/" +
           String(d.getMonth() + 1).padStart(2,"0") + "/" + d.getFullYear();
  }

  function paraISO(data){
    if (!data) return "";
    return data.getFullYear() + "-" +
           String(data.getMonth() + 1).padStart(2,"0") + "-" +
           String(data.getDate()).padStart(2,"0");
  }

  function hoje(){
    var agora = new Date();
    return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  }

  /* Diferenca em dias inteiros entre duas datas. */
  function diasEntre(de, ate){
    var a = lerData(de), b = lerData(ate);
    if (!a || !b) return null;
    return Math.round((b - a) / 86400000);
  }

  function ehExemplo(linha){
    var alvo = (linha.titulo || linha.nome || linha.campanha || "") + "";
    return /pode apagar|exemplo/i.test(alvo);
  }

  /* ---------------- RECADO ---------------- */
  var caixaRecado = null;
  var tempoRecado = null;
  function recado(texto, ruim){
    if (!caixaRecado){
      caixaRecado = document.createElement("div");
      caixaRecado.className = "recado";
      caixaRecado.setAttribute("role","status");
      caixaRecado.setAttribute("aria-live","polite");
      document.body.appendChild(caixaRecado);
    }
    caixaRecado.textContent = texto;
    caixaRecado.className = "recado aparece" + (ruim ? " ruim" : "");
    clearTimeout(tempoRecado);
    tempoRecado = setTimeout(function(){
      caixaRecado.className = "recado" + (ruim ? " ruim" : "");
    }, 3200);
  }

  /* ---------------- JANELA ---------------- */
  var janela, janelaCaixa, janelaTitulo, janelaCorpo, janelaPe;
  var aoFecharJanela = null;

  function prepararJanela(){
    janela = document.getElementById("janela");
    janelaCaixa   = janela.querySelector(".janela-caixa");
    janelaTitulo  = document.getElementById("janelaTitulo");
    janelaCorpo   = document.getElementById("janelaCorpo");
    janelaPe      = document.getElementById("janelaPe");

    janela.addEventListener("click", function(e){
      if (e.target === janela) fecharJanela();
    });
    document.getElementById("janelaFechar").addEventListener("click", fecharJanela);
    document.addEventListener("keydown", function(e){
      if (e.key === "Escape" && janela.classList.contains("aparece")) fecharJanela();
    });
  }

  function abrirJanela(opcoes){
    janelaTitulo.textContent = opcoes.titulo || "";
    janelaCorpo.innerHTML = opcoes.corpo || "";
    janelaCaixa.classList.toggle("larga", !!opcoes.larga);
    janelaPe.innerHTML = "";

    (opcoes.botoes || []).forEach(function(b){
      var botao = document.createElement("button");
      botao.type = "button";
      botao.className = "btn " + (b.classe || "");
      botao.textContent = b.texto;
      botao.addEventListener("click", function(){ b.aoClicar(fecharJanela); });
      janelaPe.appendChild(botao);
    });
    janelaPe.style.display = (opcoes.botoes && opcoes.botoes.length) ? "" : "none";

    aoFecharJanela = opcoes.aoFechar || null;
    janela.classList.add("aparece");

    var primeiro = janelaCorpo.querySelector("input, select, textarea, button");
    if (primeiro && !opcoes.semFoco) primeiro.focus();
    if (typeof opcoes.aoAbrir === "function") opcoes.aoAbrir(janelaCorpo);
  }

  function fecharJanela(){
    janela.classList.remove("aparece");
    janelaCorpo.innerHTML = "";
    if (typeof aoFecharJanela === "function"){
      var f = aoFecharJanela;
      aoFecharJanela = null;
      f();
    }
  }

  function confirmar(titulo, texto, aoConfirmar){
    abrirJanela({
      titulo: titulo,
      corpo: '<p style="margin:0;font-size:.88rem;line-height:1.6;">' + escapar(texto) + '</p>',
      botoes: [
        { texto:"Cancelar", aoClicar:function(fechar){ fechar(); } },
        { texto:"Apagar", classe:"btn-perigo", aoClicar:function(fechar){ fechar(); aoConfirmar(); } }
      ]
    });
  }

  /* ---------------- BAIXAR CSV ---------------- */
  /* Usa ponto e virgula e um marcador no comeco do arquivo para
     o Excel em portugues abrir com acento certo e em colunas. */
  function baixarCSV(nomeArquivo, cabecalhos, linhas){
    function limpar(v){
      var t = (v === undefined || v === null) ? "" : String(v);
      return '"' + t.replace(/"/g, '""').replace(/\r?\n/g, " ") + '"';
    }
    var texto = "﻿" + cabecalhos.map(limpar).join(";") + "\r\n" +
      linhas.map(function(l){ return l.map(limpar).join(";"); }).join("\r\n");

    var blob = new Blob([texto], { type:"text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
  }

  /* ---------------- AVISOS DO BANCO ---------------- */
  function mostrarAvisos(lista){
    var caixa = document.getElementById("avisos");
    if (!caixa) return;
    if (!lista || !lista.length){
      caixa.innerHTML = "";
      return;
    }
    caixa.innerHTML =
      '<div class="aviso">' + icone("alerta") +
      '<div><b>O painel abriu, mas faltou alguma coisa no banco:</b>' +
      '<ul>' + lista.map(function(t){ return "<li>" + escapar(t) + "</li>"; }).join("") + '</ul>' +
      '<div style="margin-top:6px;font-weight:500;">O resto do painel continua funcionando normalmente.</div>' +
      '</div></div>';
  }

  /* ---------------- MENU E ABAS ---------------- */
  function registrarAba(config){
    abas.push(config);
  }

  function montarMenu(){
    var corpo = document.getElementById("menuCorpo");
    var grupos = [
      { titulo:"meu site",     itens: abas.filter(function(a){ return a.grupo === "site"; }) },
      { titulo:"minha rotina", itens: abas.filter(function(a){ return a.grupo === "rotina"; }) }
    ];

    corpo.innerHTML = grupos.map(function(g){
      return '<div class="menu-grupo">' + escapar(g.titulo) + '</div>' +
        g.itens.map(function(a){
          return '<button type="button" class="menu-item" data-aba="' + escapar(a.id) + '">' +
                 icone(a.icone, 17) + '<span>' + escapar(a.nome) + '</span></button>';
        }).join("");
    }).join("");

    corpo.querySelectorAll(".menu-item").forEach(function(botao){
      botao.addEventListener("click", function(){
        irPara(botao.dataset.aba);
        fecharGaveta();
      });
    });
  }

  function irPara(id){
    var aba = abas.filter(function(a){ return a.id === id; })[0] || abas[0];
    if (!aba) return;
    abaAtual = aba.id;

    document.querySelectorAll(".menu-item").forEach(function(b){
      b.classList.toggle("ativo", b.dataset.aba === aba.id);
      if (b.dataset.aba === aba.id) b.setAttribute("aria-current","page");
      else b.removeAttribute("aria-current");
    });

    document.getElementById("tituloAba").textContent = aba.nome;
    document.getElementById("subtituloAba").textContent = aba.subtitulo || "";

    var area = document.getElementById("areaAba");
    area.innerHTML = '<div class="carregando-tela">Carregando...</div>';
    marcarHorario();

    try {
      window.location.hash = aba.id;
    } catch (falha){}

    Promise.resolve()
      .then(function(){ return aba.montar(area); })
      .catch(function(falha){
        area.innerHTML =
          '<div class="aviso">' + icone("alerta") +
          '<div>Não consegui montar esta aba agora. O resto do painel continua funcionando. ' +
          'Tente recarregar a página.</div></div>';
        if (window.console) console.error(falha);
      });
  }

  /* ---------------- ATUALIZAR ----------------
     O painel busca os dados quando a aba abre. Este botão busca
     de novo, e a página também busca sozinha quando você volta
     para ela depois de um tempo em outra aba. */
  var horaDaBusca = null;

  function marcarHorario(){
    horaDaBusca = new Date();
    var marcador = document.getElementById("atualizado");
    if (marcador){
      marcador.textContent = "atualizado às " +
        String(horaDaBusca.getHours()).padStart(2,"0") + ":" +
        String(horaDaBusca.getMinutes()).padStart(2,"0");
    }
  }

  function atualizarAgora(){
    if (abaAtual) irPara(abaAtual);
  }

  function ligarAtualizacao(){
    var botao = document.getElementById("botaoAtualizar");
    if (botao) botao.addEventListener("click", atualizarAgora);

    /* Voltou para o painel depois de meio minuto fora? Busca de novo,
       para os números não ficarem velhos na tela sem você perceber. */
    document.addEventListener("visibilitychange", function(){
      if (document.visibilityState !== "visible") return;
      if (!horaDaBusca) return;
      if (new Date() - horaDaBusca < 30000) return;
      atualizarAgora();
    });
  }

  /* ---------------- GAVETA DO CELULAR ---------------- */
  function abrirGaveta(){
    document.querySelector(".menu").classList.add("aberta");
    document.getElementById("veu").classList.add("aparece");
  }
  function fecharGaveta(){
    document.querySelector(".menu").classList.remove("aberta");
    document.getElementById("veu").classList.remove("aparece");
  }

  /* ---------------- INICIO ---------------- */
  async function iniciar(){
    /* A PRIMEIRA COISA: conferir a sessao. A pagina so aparece depois. */
    if (!window.Banco || !window.Banco.cliente){
      document.getElementById("portao").innerHTML =
        '<div class="carregando-tela">Não consegui carregar a conexão com o banco.<br>' +
        'Confira a sua internet e recarregue a página.</div>';
      return;
    }

    var sessao = await window.Banco.sessao();
    if (!sessao){
      window.location.replace("../login/");
      return;
    }

    email = (sessao.user && sessao.user.email) || "";

    document.getElementById("portao").remove();
    document.getElementById("app").hidden = false;
    document.getElementById("menuEmail").textContent = email;

    prepararJanela();
    window.Banco.definirAvisador(mostrarAvisos);

    document.getElementById("botaoSair").addEventListener("click", async function(){
      await window.Banco.sair();
      window.location.replace("../login/");
    });
    document.getElementById("abrirMenu").addEventListener("click", abrirGaveta);
    document.getElementById("veu").addEventListener("click", fecharGaveta);

    ligarAtualizacao();
    montarMenu();

    var inicial = (window.location.hash || "").replace("#","");
    irPara(abas.filter(function(a){ return a.id === inicial; })[0] ? inicial : abas[0].id);
  }

  return {
    registrarAba: registrarAba,
    iniciar: iniciar,
    irPara: irPara,
    icone: icone,
    escapar: escapar,
    numero: numero,
    dividir: dividir,
    dinheiro: dinheiro,
    lerData: lerData,
    dataBR: dataBR,
    paraISO: paraISO,
    hoje: hoje,
    diasEntre: diasEntre,
    ehExemplo: ehExemplo,
    recado: recado,
    abrirJanela: abrirJanela,
    fecharJanela: fecharJanela,
    confirmar: confirmar,
    baixarCSV: baixarCSV,
    emailDaDona: function(){ return email; }
  };
})();
