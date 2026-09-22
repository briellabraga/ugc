/* ============================================================
   ABA PORTFOLIO
   Numeros de visita do site, grafico dos ultimos 14 dias,
   de onde as pessoas vieram e a tabela dos seus videos.
   ============================================================ */

(function(){
  "use strict";
  var A = window.Admin;

  var NICHOS_SUGERIDOS  = ["Skincare","Fitness","Pet","Viagem","Tech"];
  var FORMATOS_SUGERIDOS = ["Reels 9:16","TikTok 9:16","Story 9:16","YouTube Shorts","Feed 4:5","Foto"];

  var videos = [];
  var visitas = [];
  var area = null;

  async function carregar(){
    var limite = new Date();
    limite.setDate(limite.getDate() - 13);
    limite.setHours(0,0,0,0);

    var r1 = await window.Banco.consulta("videos", function(c){
      return c.from("videos").select("*").order("ordem", { ascending:true });
    });
    var r2 = await window.Banco.consulta("visitas", function(c){
      return c.from("visitas").select("data,origem,pagina").gte("data", limite.toISOString());
    });

    videos  = r1.dados || [];
    visitas = r2.dados || [];
  }

  /* ---------------- NUMEROS ---------------- */
  function contarPorDia(){
    var dias = [];
    var base = A.hoje();
    for (var i = 13; i >= 0; i--){
      var d = new Date(base);
      d.setDate(d.getDate() - i);
      dias.push({ data:d, chave:A.paraISO(d), total:0 });
    }
    var indice = {};
    dias.forEach(function(d){ indice[d.chave] = d; });

    visitas.forEach(function(v){
      var d = A.lerData(v.data);
      if (!d) return;
      var chave = A.paraISO(d);
      if (indice[chave]) indice[chave].total++;
    });
    return dias;
  }

  function contarOrigens(){
    var mapa = {};
    visitas.forEach(function(v){
      var o = (v.origem || "direto").toString().trim().toLowerCase() || "direto";
      mapa[o] = (mapa[o] || 0) + 1;
    });
    return Object.keys(mapa)
      .map(function(k){ return { nome:k, total:mapa[k] }; })
      .sort(function(a,b){ return b.total - a.total; });
  }

  function nichoMaisForte(){
    var visiveis = videos.filter(function(v){ return v.visivel; });
    if (!visiveis.length) return null;
    var mapa = {};
    visiveis.forEach(function(v){
      var n = (v.nicho || "").trim();
      if (!n) return;
      mapa[n] = (mapa[n] || 0) + 1;
    });
    var chaves = Object.keys(mapa);
    if (!chaves.length) return null;
    chaves.sort(function(a,b){ return mapa[b] - mapa[a]; });
    return { nome: chaves[0], total: mapa[chaves[0]] };
  }

  function montarNumeros(dias){
    var total14 = dias.reduce(function(s,d){ return s + d.total; }, 0);
    var hojeChave = A.paraISO(A.hoje());
    var deHoje = dias.filter(function(d){ return d.chave === hojeChave; })[0];
    var noAr = videos.filter(function(v){ return v.visivel; }).length;
    var nicho = nichoMaisForte();
    var origens = contarOrigens();
    var principal = origens[0] || null;

    var mediaDia = total14 ? (total14 / 14) : 0;

    return '<div class="faixa-numeros">' +
      bloco("Visitas em 14 dias", total14, total14 ? ("média de " + mediaDia.toFixed(1).replace(".", ",") + " por dia") : "ainda sem visita") +
      bloco("Visitas hoje", deHoje ? deHoje.total : 0, "") +
      bloco("Vídeos no ar", noAr, videos.length ? (videos.length + " no total") : "nenhum cadastrado") +
      bloco("Nicho mais forte", nicho ? nicho.nome : "sem dados", nicho ? (nicho.total + (nicho.total === 1 ? " vídeo" : " vídeos")) : "cadastre um vídeo") +
      bloco("De onde mais vêm", principal ? principal.nome : "sem dados", principal ? (principal.total + (principal.total === 1 ? " visita" : " visitas")) : "ainda sem visita") +
    '</div>';
  }

  function bloco(rotulo, valor, apoio){
    return '<div class="numero">' +
      '<div class="numero-rotulo">' + A.escapar(rotulo) + '</div>' +
      '<div class="numero-valor">' + A.escapar(valor) + '</div>' +
      (apoio ? '<div class="numero-apoio">' + A.escapar(apoio) + '</div>' : '') +
    '</div>';
  }

  /* ---------------- GRAFICO ---------------- */
  function montarGrafico(dias){
    var total = dias.reduce(function(s,d){ return s + d.total; }, 0);

    if (!total){
      return '<div class="cartao cartao-pad">' +
        '<p class="titulo-bloco">Visitas dos últimos 14 dias</p>' +
        '<div class="vazio"><b>Ainda não há visitas para mostrar aqui</b>' +
        'Assim que alguém abrir o seu portfólio, este espaço vira um gráfico de barras ' +
        'com o número de visitas de cada um dos últimos 14 dias, para você ver quais dias ' +
        'movimentam mais o seu site.</div></div>';
    }

    var maior = dias.reduce(function(m,d){ return Math.max(m, d.total); }, 0);

    return '<div class="cartao cartao-pad">' +
      '<p class="titulo-bloco">Visitas dos últimos 14 dias</p>' +
      '<div class="grafico">' +
        dias.map(function(d){
          var altura = maior ? Math.round(A.dividir(d.total, maior) * 100) : 0;
          var rotulo = String(d.data.getDate()).padStart(2,"0") + "/" + String(d.data.getMonth()+1).padStart(2,"0");
          return '<div class="barra-col" title="' + A.escapar(rotulo + ": " + d.total + (d.total === 1 ? " visita" : " visitas")) + '">' +
            '<div class="barra' + (d.total ? "" : " zerada") + '" style="height:' + Math.max(altura, d.total ? 4 : 2) + '%"></div>' +
            '<div class="barra-dia">' + A.escapar(String(d.data.getDate()).padStart(2,"0")) + '</div>' +
          '</div>';
        }).join("") +
      '</div></div>';
  }

  function montarOrigens(){
    var origens = contarOrigens();
    if (!origens.length){
      return '<div class="cartao cartao-pad">' +
        '<p class="titulo-bloco">De onde as pessoas chegaram</p>' +
        '<div class="vazio"><b>Nenhuma origem registrada ainda</b>' +
        'Quando alguém entrar no seu site, aqui vai aparecer se a pessoa veio do Instagram, ' +
        'do Google, de um link que você mandou ou se digitou o endereço direto.</div></div>';
    }
    var maior = origens[0].total;
    return '<div class="cartao cartao-pad">' +
      '<p class="titulo-bloco">De onde as pessoas chegaram</p>' +
      '<ul class="lista-origens">' +
        origens.slice(0,7).map(function(o){
          var pct = Math.round(A.dividir(o.total, maior) * 100);
          return '<li><span class="origem-nome">' + A.escapar(o.nome) + '</span>' +
            '<span class="origem-trilho"><i class="origem-cheio" style="width:' + pct + '%"></i></span>' +
            '<span class="origem-num">' + o.total + '</span></li>';
        }).join("") +
      '</ul></div>';
  }

  /* ---------------- TABELA DE VIDEOS ---------------- */
  function montarTabela(){
    if (!videos.length){
      return '<div class="cartao">' +
        '<div class="vazio"><b>Nenhum vídeo cadastrado</b>' +
        'Clique em adicionar vídeo para criar o primeiro. Ele aparece no seu portfólio ' +
        'assim que estiver com o olhinho aberto.</div></div>';
    }

    return '<div class="rolagem cartao"><table>' +
      '<thead><tr>' +
        '<th style="width:32px"></th>' +
        '<th>Vídeo</th><th>Nicho</th><th>Formato</th><th>Marca</th><th>Destaque</th>' +
        '<th style="width:110px"></th>' +
      '</tr></thead><tbody id="corpoVideos">' +
      videos.map(function(v, i){
        return '<tr draggable="false" data-id="' + A.escapar(v.id) + '" data-pos="' + i + '"' +
                 (v.visivel ? '' : ' style="opacity:.55"') + '>' +
          '<td><span class="alcinha" title="Arraste para mudar a ordem" data-alca="1">' + A.icone("alcinha") + '</span></td>' +
          '<td class="celula-forte">' + A.escapar(v.titulo || "sem título") +
            (A.ehExemplo(v) ? '<span class="etiqueta-exemplo">exemplo</span>' : '') +
            (v.link && v.link !== "#" ? ' <a href="' + A.escapar(v.link) + '" target="_blank" rel="noopener" title="Abrir vídeo" style="color:var(--ink-fraco)">' + A.icone("link",13) + '</a>' : '') +
          '</td>' +
          '<td>' + (v.nicho ? '<span class="pilula p-lima">' + A.escapar(v.nicho) + '</span>' : '<span class="celula-fraca">sem nicho</span>') + '</td>' +
          '<td class="celula-fraca">' + A.escapar(v.formato || "") + '</td>' +
          '<td class="celula-fraca">' + A.escapar(v.marca || "") + '</td>' +
          '<td class="celula-forte">' + A.escapar(v.destaque || "") + '</td>' +
          '<td><div class="acoes">' +
            '<button type="button" class="btn btn-icone" data-ver="' + A.escapar(v.id) + '" title="' + (v.visivel ? "Está no site, clique para esconder" : "Está escondido, clique para mostrar") + '">' +
              A.icone(v.visivel ? "olho" : "olhoFechado", 15) + '</button>' +
            '<button type="button" class="btn btn-icone" data-editar="' + A.escapar(v.id) + '" title="Editar">' + A.icone("lapis",15) + '</button>' +
            '<button type="button" class="btn btn-icone btn-perigo" data-apagar="' + A.escapar(v.id) + '" title="Apagar">' + A.icone("lixo",15) + '</button>' +
          '</div></td>' +
        '</tr>';
      }).join("") +
      '</tbody></table></div>';
  }

  /* ---------------- FORMULARIO ---------------- */
  function opcoes(lista, atual){
    return lista.map(function(o){
      return '<option value="' + A.escapar(o) + '"' + (o === atual ? " selected" : "") + '>' + A.escapar(o) + '</option>';
    }).join("");
  }

  function abrirFormulario(video){
    var novo = !video;
    video = video || { titulo:"", link:"", nicho:"", formato:"", marca:"", destaque:"", ordem:(videos.length + 1), visivel:true };

    A.abrirJanela({
      titulo: novo ? "Adicionar vídeo" : "Editar vídeo",
      corpo:
        '<div class="campo"><label for="fTitulo">Título do vídeo</label>' +
        '<input id="fTitulo" type="text" value="' + A.escapar(video.titulo) + '" placeholder="Rotina de skincare noturna"></div>' +

        '<div class="campo"><label for="fLink">Link do vídeo</label>' +
        '<input id="fLink" type="url" value="' + A.escapar(video.link === "#" ? "" : video.link) + '" placeholder="https://instagram.com/reel/..."></div>' +

        '<div class="campo-duplo">' +
          '<div class="campo"><label for="fNicho">Nicho</label>' +
          '<input id="fNicho" list="listaNichos" value="' + A.escapar(video.nicho) + '" placeholder="Skincare">' +
          '<datalist id="listaNichos">' + opcoes(NICHOS_SUGERIDOS) + '</datalist></div>' +

          '<div class="campo"><label for="fFormato">Formato</label>' +
          '<input id="fFormato" list="listaFormatos" value="' + A.escapar(video.formato) + '" placeholder="Reels 9:16">' +
          '<datalist id="listaFormatos">' + opcoes(FORMATOS_SUGERIDOS) + '</datalist></div>' +
        '</div>' +

        '<div class="campo-duplo">' +
          '<div class="campo"><label for="fMarca">Marca</label>' +
          '<input id="fMarca" type="text" value="' + A.escapar(video.marca) + '" placeholder="Nome da marca"></div>' +

          '<div class="campo"><label for="fDestaque">Destaque</label>' +
          '<input id="fDestaque" type="text" value="' + A.escapar(video.destaque) + '" placeholder="2,4M views"></div>' +
        '</div>' +

        '<div class="campo"><label class="campo-caixa">' +
        '<input id="fVisivel" type="checkbox"' + (video.visivel ? " checked" : "") + '> Mostrar este vídeo no meu site</label></div>' +

        '<div class="campo-erro escondido" id="fErro"></div>',

      botoes: [
        { texto:"Cancelar", aoClicar:function(fechar){ fechar(); } },
        { texto: novo ? "Adicionar" : "Salvar", classe:"btn-lima", aoClicar:async function(fechar){
            var titulo = document.getElementById("fTitulo").value.trim();
            var erro = document.getElementById("fErro");

            if (!titulo){
              erro.textContent = "Escreva pelo menos o título do vídeo.";
              erro.classList.remove("escondido");
              document.getElementById("fTitulo").focus();
              return;
            }

            var dados = {
              titulo: titulo,
              link: document.getElementById("fLink").value.trim(),
              nicho: document.getElementById("fNicho").value.trim(),
              formato: document.getElementById("fFormato").value.trim(),
              marca: document.getElementById("fMarca").value.trim(),
              destaque: document.getElementById("fDestaque").value.trim(),
              visivel: document.getElementById("fVisivel").checked
            };

            var r;
            if (novo){
              dados.ordem = videos.length ? (Math.max.apply(null, videos.map(function(v){ return A.numero(v.ordem); })) + 1) : 1;
              r = await window.Banco.consulta("videos", function(c){ return c.from("videos").insert(dados); });
            } else {
              r = await window.Banco.consulta("videos", function(c){ return c.from("videos").update(dados).eq("id", video.id); });
            }

            if (r.erro){ A.recado(r.erro, true); return; }
            fechar();
            A.recado(novo ? "Vídeo adicionado" : "Vídeo salvo");
            await recarregar();
          }
        }
      ]
    });
  }

  /* ---------------- ACOES ---------------- */
  async function alternarVisivel(id){
    var v = videos.filter(function(x){ return x.id === id; })[0];
    if (!v) return;
    var r = await window.Banco.consulta("videos", function(c){
      return c.from("videos").update({ visivel: !v.visivel }).eq("id", id);
    });
    if (r.erro){ A.recado(r.erro, true); return; }
    A.recado(!v.visivel ? "Vídeo aparecendo no site" : "Vídeo escondido do site");
    await recarregar();
  }

  function apagar(id){
    var v = videos.filter(function(x){ return x.id === id; })[0];
    if (!v) return;
    A.confirmar("Apagar vídeo", 'Quer mesmo apagar "' + (v.titulo || "este vídeo") + '"? Isso não tem como desfazer.', async function(){
      var r = await window.Banco.consulta("videos", function(c){ return c.from("videos").delete().eq("id", id); });
      if (r.erro){ A.recado(r.erro, true); return; }
      A.recado("Vídeo apagado");
      await recarregar();
    });
  }

  /* Arrastar pela alcinha para mudar a ordem. */
  function ligarArrasto(){
    var corpo = document.getElementById("corpoVideos");
    if (!corpo) return;
    var arrastando = null;

    corpo.querySelectorAll("[data-alca]").forEach(function(alca){
      alca.addEventListener("mousedown", function(){ alca.closest("tr").draggable = true; });
      alca.addEventListener("touchstart", function(){ alca.closest("tr").draggable = true; }, { passive:true });
    });

    corpo.querySelectorAll("tr").forEach(function(linha){
      linha.addEventListener("dragstart", function(e){
        arrastando = linha;
        linha.classList.add("arrastando");
        try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", linha.dataset.id); } catch(f){}
      });
      linha.addEventListener("dragend", function(){
        linha.classList.remove("arrastando");
        linha.draggable = false;
        corpo.querySelectorAll("tr").forEach(function(l){ l.classList.remove("alvo-solta"); });
        arrastando = null;
      });
      linha.addEventListener("dragover", function(e){
        if (!arrastando || arrastando === linha) return;
        e.preventDefault();
        linha.classList.add("alvo-solta");
      });
      linha.addEventListener("dragleave", function(){ linha.classList.remove("alvo-solta"); });
      linha.addEventListener("drop", async function(e){
        e.preventDefault();
        linha.classList.remove("alvo-solta");
        if (!arrastando || arrastando === linha) return;

        var de = Number(arrastando.dataset.pos);
        var para = Number(linha.dataset.pos);
        if (!isFinite(de) || !isFinite(para)) return;

        var lista = videos.slice();
        var movido = lista.splice(de, 1)[0];
        lista.splice(para, 0, movido);
        videos = lista;

        desenhar();
        await salvarOrdem();
      });
    });
  }

  async function salvarOrdem(){
    var falhou = false;
    for (var i = 0; i < videos.length; i++){
      var r = await window.Banco.consulta("videos", function(c){
        return c.from("videos").update({ ordem: i + 1 }).eq("id", videos[i].id);
      });
      if (r.erro){ falhou = true; break; }
      videos[i].ordem = i + 1;
    }
    A.recado(falhou ? "Não consegui salvar a nova ordem" : "Ordem salva", falhou);
  }

  /* ---------------- DESENHAR ---------------- */
  function desenhar(){
    var dias = contarPorDia();

    area.innerHTML =
      montarNumeros(dias) +
      '<div class="duas-colunas">' + montarGrafico(dias) + montarOrigens() + '</div>' +
      '<div class="ferramentas">' +
        '<p class="titulo-bloco" style="margin:0">Meus vídeos</p>' +
        '<span class="espaco"></span>' +
        '<button type="button" class="btn btn-lima" id="addVideo">' + A.icone("mais") + ' Adicionar vídeo</button>' +
      '</div>' +
      montarTabela();

    var add = document.getElementById("addVideo");
    if (add) add.addEventListener("click", function(){ abrirFormulario(null); });

    area.querySelectorAll("[data-ver]").forEach(function(b){
      b.addEventListener("click", function(){ alternarVisivel(b.dataset.ver); });
    });
    area.querySelectorAll("[data-editar]").forEach(function(b){
      b.addEventListener("click", function(){
        abrirFormulario(videos.filter(function(v){ return v.id === b.dataset.editar; })[0]);
      });
    });
    area.querySelectorAll("[data-apagar]").forEach(function(b){
      b.addEventListener("click", function(){ apagar(b.dataset.apagar); });
    });

    ligarArrasto();
  }

  async function recarregar(){
    await carregar();
    desenhar();
  }

  A.registrarAba({
    id: "portfolio",
    nome: "Portfólio",
    subtitulo: "Como o seu site está indo e quais vídeos estão no ar",
    icone: "portfolio",
    grupo: "site",
    montar: async function(destino){
      area = destino;
      await carregar();
      desenhar();
    }
  });

})();
