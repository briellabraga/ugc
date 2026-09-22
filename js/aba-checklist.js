/* ============================================================
   ABA CHECKLIST PORTFOLIO
   Usa exatamente o conteudo do arquivo js/biblioteca.js.
   Cinco sub abas: checklist, referencias, roteiros, ideias
   por nicho e revisar meu roteiro.
   ============================================================ */

(function(){
  "use strict";
  var A = window.Admin;

  var SUB = [
    { id:"checklist",   nome:"Checklist do portfólio" },
    { id:"referencias", nome:"Referências de vídeo" },
    { id:"roteiros",    nome:"Roteiros" },
    { id:"ideias",      nome:"Ideias por nicho" },
    { id:"revisao",     nome:"Revisar meu roteiro" }
  ];

  var subAtual = "checklist";
  var area = null;
  var marcados = {};       // o que ja esta marcado, vindo do banco
  var abertas = {};        // quais secoes estao abertas na tela
  var revisaoMarcada = {}; // marcacoes da revisao, so enquanto a pagina esta aberta

  function bib(){
    return window.Biblioteca || null;
  }

  async function carregarMarcados(){
    var r = await window.Banco.consulta("marcados", function(c){
      return c.from("marcados").select("chave,marcado");
    });
    marcados = {};
    (r.dados || []).forEach(function(m){
      if (m.marcado) marcados[m.chave] = true;
    });
  }

  async function salvarMarca(chave, valor){
    var r = await window.Banco.consulta("marcados", function(c){
      return c.from("marcados").upsert(
        { chave: chave, marcado: valor, atualizado_em: new Date().toISOString() },
        { onConflict: "chave" }
      );
    });
    if (r.erro){ A.recado(r.erro, true); return false; }
    return true;
  }

  /* ---------------- 1. CHECKLIST ---------------- */
  function chaveItem(secao, indice){
    return "checklist:" + secao.id + ":" + indice;
  }

  function contarSecao(secao){
    var itens = secao.itens || [];
    var feitos = itens.filter(function(_, i){ return marcados[chaveItem(secao, i)]; }).length;
    return { feitos: feitos, total: itens.length };
  }

  function montarChecklist(){
    var dados = bib();
    if (!dados || !dados.CHECKLIST) return semBiblioteca();

    var secoes = dados.CHECKLIST;
    var totalGeral = 0, feitosGeral = 0;
    secoes.forEach(function(s){
      var c = contarSecao(s);
      totalGeral += c.total;
      feitosGeral += c.feitos;
    });
    var pctGeral = Math.round(A.dividir(feitosGeral, totalGeral) * 100);

    return '<div class="cartao cartao-pad" style="margin-bottom:14px">' +
      '<p class="titulo-bloco">Quanto do seu portfólio já está pronto</p>' +
      '<div class="progresso-geral">' +
        '<span class="trilho"><i style="width:' + pctGeral + '%"></i></span>' +
        '<span class="progresso-num">' + feitosGeral + ' de ' + totalGeral + ' · ' + pctGeral + '%</span>' +
      '</div></div>' +

      secoes.map(function(s){
        var c = contarSecao(s);
        var pct = Math.round(A.dividir(c.feitos, c.total) * 100);
        var aberta = !!abertas[s.id];

        return '<div class="cartao secao' + (aberta ? " aberta" : "") + '" data-secao="' + A.escapar(s.id) + '">' +
          '<button type="button" class="secao-topo" data-abrir="' + A.escapar(s.id) + '" aria-expanded="' + aberta + '">' +
            '<span class="secao-emoji">' + A.escapar(s.emoji || "") + '</span>' +
            '<span><span class="secao-nome">' + A.escapar(s.nome) + '</span>' +
            '<span class="secao-resumo">' + A.escapar(s.resumo || "") + '</span></span>' +
            '<span class="secao-conta">' + c.feitos + '/' + c.total + '</span>' +
            '<span class="secao-trilho"><i style="width:' + pct + '%"></i></span>' +
            '<span class="secao-seta">' + A.icone("baixo",15) + '</span>' +
          '</button>' +
          '<div class="secao-corpo">' +
            (s.porque ? '<div class="secao-porque">' + A.escapar(s.porque) + '</div>' : '') +
            (s.itens || []).map(function(item, i){
              var chave = chaveItem(s, i);
              var pronto = !!marcados[chave];
              var id = "ck-" + s.id + "-" + i;
              return '<div class="item-check' + (pronto ? " pronto" : "") + '">' +
                '<input type="checkbox" id="' + id + '" data-chave="' + A.escapar(chave) + '"' + (pronto ? " checked" : "") + '>' +
                '<div><label class="item-t" for="' + id + '">' + A.escapar(item.t) + '</label>' +
                (item.d ? '<div class="item-d">' + A.escapar(item.d) + '</div>' : '') + '</div>' +
              '</div>';
            }).join("") +
          '</div></div>';
      }).join("");
  }

  function ligarChecklist(){
    area.querySelectorAll("[data-abrir]").forEach(function(b){
      b.addEventListener("click", function(){
        var id = b.dataset.abrir;
        abertas[id] = !abertas[id];
        desenhar();
      });
    });

    area.querySelectorAll("[data-chave]").forEach(function(caixa){
      caixa.addEventListener("change", async function(){
        var chave = caixa.dataset.chave;
        var valor = caixa.checked;
        if (valor) marcados[chave] = true; else delete marcados[chave];
        desenhar();
        var ok = await salvarMarca(chave, valor);
        if (!ok){
          if (valor) delete marcados[chave]; else marcados[chave] = true;
          desenhar();
        }
      });
    });
  }

  /* ---------------- 2. REFERENCIAS ---------------- */
  function montarReferencias(){
    var dados = bib();
    if (!dados || !dados.REFERENCIAS) return semBiblioteca();

    return '<div class="grade-ref">' +
      dados.REFERENCIAS.map(function(r, i){
        return '<button type="button" class="ref-cartao" data-ref="' + i + '">' +
          '<span class="ref-capa c-' + A.escapar(r.cor || "cinza") + '">' + A.escapar(r.emoji || "🎬") + '</span>' +
          '<span class="ref-corpo">' +
            '<span class="ref-titulo">' + A.escapar(r.titulo) + '</span>' +
            '<span class="ref-meta">' + A.escapar([r.estilo, r.duracao, r.marca].filter(Boolean).join(" · ")) + '</span>' +
          '</span></button>';
      }).join("") + '</div>';
  }

  function abrirFicha(indice){
    var r = bib().REFERENCIAS[indice];
    if (!r) return;

    var corpo =
      (r.gancho ? linhaFicha("Gancho", r.gancho) : "") +
      (r.porque ? linhaFicha("Por que funciona", r.porque) : "") +
      (r.diferencial ? linhaFicha("O diferencial", r.diferencial) : "") +
      (r.erro ? linhaFicha("Erro comum", r.erro) : "") +
      (r.roteiro && r.roteiro.length
        ? '<div class="ficha-linha"><div class="ficha-rotulo">Roteiro em blocos de tempo</div>' +
          r.roteiro.map(function(b){
            return '<div class="bloco-tempo"><span class="bloco-t">' + A.escapar(b.t) + '</span>' +
                   '<span class="bloco-o">' + (b.o || "") + '</span></div>';
          }).join("") + '</div>'
        : "");

    A.abrirJanela({
      titulo: (r.emoji ? r.emoji + " " : "") + r.titulo,
      larga: true,
      corpo: '<p class="ref-meta" style="margin:0 0 14px">' +
             A.escapar([r.estilo, r.audiencia, r.duracao, r.marca].filter(Boolean).join(" · ")) + '</p>' + corpo,
      botoes: r.youtube
        ? [{ texto:"Assistir o vídeo", classe:"btn-lima", aoClicar:function(){ window.open(r.youtube, "_blank", "noopener"); } },
           { texto:"Fechar", aoClicar:function(fechar){ fechar(); } }]
        : [{ texto:"Fechar", aoClicar:function(fechar){ fechar(); } }],
      semFoco: true
    });
  }

  function linhaFicha(rotulo, texto){
    return '<div class="ficha-linha"><div class="ficha-rotulo">' + A.escapar(rotulo) + '</div>' +
           '<div class="ficha-texto">' + A.escapar(texto) + '</div></div>';
  }

  /* ---------------- 3. ROTEIROS ---------------- */
  function montarRoteiros(){
    var dados = bib();
    if (!dados || !dados.TIPOS) return semBiblioteca();

    return dados.TIPOS.map(function(t){
      var aberta = !!abertas["tipo-" + t.id];
      return '<div class="cartao secao' + (aberta ? " aberta" : "") + '">' +
        '<button type="button" class="secao-topo" data-abrir="tipo-' + A.escapar(t.id) + '" aria-expanded="' + aberta + '">' +
          '<span class="secao-emoji">' + A.escapar(t.emoji || "") + '</span>' +
          '<span><span class="secao-nome">' + A.escapar(t.nome) + '</span>' +
          '<span class="secao-resumo">' + A.escapar(t.duracao || "") + '</span></span>' +
          '<span class="espaco"></span>' +
          '<span class="secao-seta">' + A.icone("baixo",15) + '</span>' +
        '</button>' +
        '<div class="secao-corpo">' +
          (t.porque ? '<div class="secao-porque">' + A.escapar(t.porque) + '</div>' : '') +
          (t.beats || []).map(function(b){
            return '<div class="bloco-tempo"><span class="bloco-t">' + A.escapar(b.t) + '</span>' +
                   '<span class="bloco-o">' + (b.o || "") + '</span></div>';
          }).join("") +
          (t.erros && t.erros.length
            ? '<div class="ficha-linha" style="margin-top:14px"><div class="ficha-rotulo">Erros comuns</div>' +
              '<ul class="lista-erros">' + t.erros.map(function(e){ return '<li>' + A.escapar(e) + '</li>'; }).join("") + '</ul></div>'
            : "") +
        '</div></div>';
    }).join("");
  }

  /* ---------------- 4. IDEIAS POR NICHO ---------------- */
  function montarIdeias(){
    var dados = bib();
    if (!dados || !dados.NICHOS) return semBiblioteca();

    return dados.NICHOS.map(function(n){
      var aberta = !!abertas["nicho-" + n.id];
      return '<div class="cartao secao' + (aberta ? " aberta" : "") + '">' +
        '<button type="button" class="secao-topo" data-abrir="nicho-' + A.escapar(n.id) + '" aria-expanded="' + aberta + '">' +
          '<span class="secao-emoji">' + A.escapar(n.emoji || "") + '</span>' +
          '<span><span class="secao-nome">' + A.escapar(n.nome) + '</span>' +
          '<span class="secao-resumo">' + (n.ideias || []).length + ' ideias com gancho pronto</span></span>' +
          '<span class="espaco"></span>' +
          '<span class="secao-seta">' + A.icone("baixo",15) + '</span>' +
        '</button>' +
        '<div class="secao-corpo">' +
          (n.ideias || []).map(function(ideia){
            return '<div class="ideia"><div class="ideia-t">' + A.escapar(ideia.t) + '</div>' +
                   (ideia.gancho ? '<div class="ideia-g">' + A.escapar(ideia.gancho) + '</div>' : '') + '</div>';
          }).join("") +
        '</div></div>';
    }).join("");
  }

  /* ---------------- 5. REVISAR MEU ROTEIRO ---------------- */
  function montarRevisao(){
    var dados = bib();
    if (!dados || !dados.REVISAO) return semBiblioteca();

    var total = 0, feitos = 0;
    dados.REVISAO.forEach(function(b, bi){
      (b.itens || []).forEach(function(_, ii){
        total++;
        if (revisaoMarcada["rev:" + bi + ":" + ii]) feitos++;
      });
    });
    var pct = Math.round(A.dividir(feitos, total) * 100);

    return '<div class="campo"><label for="meuRoteiro">Cole aqui o roteiro que você quer revisar</label>' +
      '<textarea id="meuRoteiro" class="area-roteiro" placeholder="Cole o texto do seu roteiro e vá conferindo item por item nos blocos abaixo."></textarea></div>' +

      '<div class="cartao cartao-pad" style="margin-bottom:14px">' +
        '<div class="progresso-geral">' +
          '<span class="trilho"><i style="width:' + pct + '%"></i></span>' +
          '<span class="progresso-num">' + feitos + ' de ' + total + ' conferidos</span>' +
          '<button type="button" class="btn btn-pequeno" id="limparRevisao">Limpar</button>' +
        '</div>' +
        '<p style="margin:8px 0 0;font-size:.78rem;color:var(--ink-fraco)">' +
        'Esta conferência é só para o roteiro de agora, então ela não fica salva.</p>' +
      '</div>' +

      dados.REVISAO.map(function(b, bi){
        return '<div class="cartao cartao-pad" style="margin-bottom:10px">' +
          '<p class="titulo-bloco" style="margin-bottom:8px">' +
          A.escapar((b.emoji ? b.emoji + " " : "") + b.bloco) + '</p>' +
          (b.itens || []).map(function(item, ii){
            var chave = "rev:" + bi + ":" + ii;
            var pronto = !!revisaoMarcada[chave];
            var id = "rv-" + bi + "-" + ii;
            return '<div class="item-check' + (pronto ? " pronto" : "") + '">' +
              '<input type="checkbox" id="' + id + '" data-rev="' + chave + '"' + (pronto ? " checked" : "") + '>' +
              '<div><label class="item-t" for="' + id + '">' + A.escapar(item.t) + '</label>' +
              (item.d ? '<div class="item-d">' + A.escapar(item.d) + '</div>' : '') + '</div>' +
            '</div>';
          }).join("") +
        '</div>';
      }).join("");
  }

  /* ---------------- COMUM ---------------- */
  function semBiblioteca(){
    return '<div class="aviso">' + A.icone("alerta") +
      '<div>Não consegui carregar o arquivo <b>js/biblioteca.js</b>, que é de onde vem todo o ' +
      'conteúdo desta aba. Confira se o arquivo está na pasta js do projeto e recarregue a página. ' +
      'O resto do painel continua funcionando.</div></div>';
  }

  function desenhar(){
    var conteudo = "";
    if (subAtual === "checklist")        conteudo = montarChecklist();
    else if (subAtual === "referencias") conteudo = montarReferencias();
    else if (subAtual === "roteiros")    conteudo = montarRoteiros();
    else if (subAtual === "ideias")      conteudo = montarIdeias();
    else                                 conteudo = montarRevisao();

    area.innerHTML =
      '<div class="sub-abas" role="tablist">' +
        SUB.map(function(s){
          return '<button type="button" role="tab" class="sub-aba' + (subAtual === s.id ? " ativa" : "") + '"' +
                 ' aria-selected="' + (subAtual === s.id) + '" data-sub="' + s.id + '">' + A.escapar(s.nome) + '</button>';
        }).join("") +
      '</div>' + conteudo;

    area.querySelectorAll("[data-sub]").forEach(function(b){
      b.addEventListener("click", function(){ subAtual = b.dataset.sub; desenhar(); });
    });

    if (subAtual === "checklist") ligarChecklist();

    if (subAtual === "referencias"){
      area.querySelectorAll("[data-ref]").forEach(function(b){
        b.addEventListener("click", function(){ abrirFicha(Number(b.dataset.ref)); });
      });
    }

    if (subAtual === "roteiros" || subAtual === "ideias"){
      area.querySelectorAll("[data-abrir]").forEach(function(b){
        b.addEventListener("click", function(){
          var id = b.dataset.abrir;
          abertas[id] = !abertas[id];
          desenhar();
        });
      });
    }

    if (subAtual === "revisao"){
      var texto = "";
      area.querySelectorAll("[data-rev]").forEach(function(caixa){
        caixa.addEventListener("change", function(){
          var campo = document.getElementById("meuRoteiro");
          texto = campo ? campo.value : "";
          if (caixa.checked) revisaoMarcada[caixa.dataset.rev] = true;
          else delete revisaoMarcada[caixa.dataset.rev];
          desenhar();
          var novo = document.getElementById("meuRoteiro");
          if (novo) novo.value = texto;
        });
      });
      var limpar = document.getElementById("limparRevisao");
      if (limpar) limpar.addEventListener("click", function(){
        revisaoMarcada = {};
        desenhar();
      });
    }
  }

  A.registrarAba({
    id: "checklist",
    nome: "Checklist",
    subtitulo: "O que ainda falta no seu portfólio e onde buscar ideia",
    icone: "checklist",
    grupo: "rotina",
    montar: async function(destino){
      area = destino;
      await carregarMarcados();
      desenhar();
    }
  });

})();
