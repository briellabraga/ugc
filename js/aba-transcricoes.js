/* ============================================================
   ABA TRANSCRICOES
   Os videos que voce gosta, com o video para assistir ali mesmo,
   a transcricao inteira e as suas anotacoes.

   A transcricao em si e feita no TokScript, que e um site de fora.
   O painel abre a pagina certa conforme a rede do link e ja copia
   o endereco do video, para voce so colar la e trazer o texto.
   ============================================================ */

(function(){
  "use strict";
  var A = window.Admin;

  var TOKSCRIPT = {
    "YouTube":   "https://tokscript.com/youtube-transcript-generator",
    "Instagram": "https://tokscript.com/instagram-transcript-generator",
    "TikTok":    "https://tokscript.com/",
    "Outro":     "https://tokscript.com/"
  };
  var CORES = {
    "YouTube":"p-vermelho", "Instagram":"p-roxo", "TikTok":"p-azul", "Outro":"p-cinza"
  };
  var PLATAFORMAS = ["YouTube","Instagram","TikTok","Outro"];

  var itens = [];
  var area = null;
  var busca = "";
  var filtro = "Todas";

  async function carregar(){
    var r = await window.Banco.consulta("transcricoes", function(c){
      return c.from("transcricoes").select("*").order("criado_em", { ascending:false });
    });
    itens = r.dados || [];
  }

  /* ---------------- LINK ---------------- */
  function detectarPlataforma(link){
    var l = String(link || "").toLowerCase();
    if (/youtube\.com|youtu\.be/.test(l))  return "YouTube";
    if (/instagram\.com/.test(l))          return "Instagram";
    if (/tiktok\.com/.test(l))             return "TikTok";
    return "Outro";
  }

  /* Monta o endereco que o navegador consegue mostrar dentro da
     pagina. Se nao der para embutir, devolve null e a tela mostra
     um botao para abrir o video na rede de origem. */
  function enderecoParaVer(link, plataforma){
    var l = String(link || "");
    var m;

    if (plataforma === "YouTube"){
      m = l.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{6,})/);
      if (m) return "https://www.youtube.com/embed/" + m[1];
    }
    if (plataforma === "Instagram"){
      m = l.match(/instagram\.com\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i);
      if (m) return "https://www.instagram.com/" + (m[1].toLowerCase() === "reels" ? "reel" : m[1].toLowerCase()) + "/" + m[2] + "/embed/";
    }
    if (plataforma === "TikTok"){
      m = l.match(/tiktok\.com\/.*\/video\/(\d+)/);
      if (m) return "https://www.tiktok.com/embed/v2/" + m[1];
    }
    return null;
  }

  function copiar(texto, recadoOk){
    function aviso(ok){ A.recado(ok ? recadoOk : "Não consegui copiar, selecione o texto e use Ctrl C", !ok); }
    if (navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(texto).then(function(){ aviso(true); }, function(){ aviso(false); });
      return;
    }
    try {
      var caixa = document.createElement("textarea");
      caixa.value = texto;
      caixa.style.position = "fixed";
      caixa.style.opacity = "0";
      document.body.appendChild(caixa);
      caixa.select();
      var deu = document.execCommand("copy");
      document.body.removeChild(caixa);
      aviso(deu);
    } catch (falha){ aviso(false); }
  }

  /* ---------------- LISTA ---------------- */
  function filtrar(){
    var termo = busca.trim().toLowerCase();
    return itens.filter(function(t){
      if (filtro !== "Todas" && t.plataforma !== filtro) return false;
      if (!termo) return true;
      return [t.titulo, t.roteiro, t.obs, t.link]
        .map(function(x){ return String(x || "").toLowerCase(); })
        .some(function(x){ return x.indexOf(termo) !== -1; });
    });
  }

  function resumo(texto, tamanho){
    var t = String(texto || "").replace(/\s+/g, " ").trim();
    if (!t) return "";
    return t.length > tamanho ? t.slice(0, tamanho) + "..." : t;
  }

  function montarLista(lista){
    if (!itens.length){
      return '<div class="cartao"><div class="vazio"><b>Nenhum vídeo salvo ainda</b>' +
        'Clique em adicionar vídeo, cole o link do YouTube, Instagram ou TikTok e guarde ' +
        'a transcrição junto com as suas anotações. Assim você tem sempre à mão os vídeos ' +
        'que te inspiram e o texto deles inteiro.</div></div>';
    }
    if (!lista.length){
      return '<div class="cartao"><div class="vazio"><b>Nada encontrado</b>' +
        'Nenhum vídeo combina com essa busca ou com esse filtro.</div></div>';
    }

    return '<div class="grade-trans">' +
      lista.map(function(t){
        return '<button type="button" class="trans-cartao" data-abrir="' + A.escapar(t.id) + '">' +
          '<span class="trans-topo">' +
            '<span class="pilula ' + (CORES[t.plataforma] || "p-cinza") + '">' + A.escapar(t.plataforma || "Outro") + '</span>' +
            (t.obs ? '<span class="trans-marca" title="Tem observação">' + A.icone("lapis",13) + '</span>' : '') +
          '</span>' +
          '<span class="trans-titulo">' + A.escapar(t.titulo || "sem título") +
            (A.ehExemplo(t) ? '<span class="etiqueta-exemplo">exemplo</span>' : '') + '</span>' +
          '<span class="trans-resumo">' + A.escapar(resumo(t.roteiro, 130) || "sem transcrição salva") + '</span>' +
          '<span class="trans-pe">' + A.escapar(A.dataBR(t.criado_em)) + '</span>' +
        '</button>';
      }).join("") + '</div>';
  }

  /* ---------------- FICHA ---------------- */
  function abrirFicha(id){
    var t = itens.filter(function(x){ return x.id === id; })[0];
    if (!t) return;

    var plataforma = t.plataforma || detectarPlataforma(t.link);
    var endereco = enderecoParaVer(t.link, plataforma);
    var vertical = plataforma === "Instagram" || plataforma === "TikTok";

    var visual;
    if (endereco){
      visual = '<div class="trans-video' + (vertical ? " vertical" : "") + '">' +
        '<iframe src="' + A.escapar(endereco) + '" title="Vídeo salvo" loading="lazy" allowfullscreen ' +
        'referrerpolicy="strict-origin-when-cross-origin" ' +
        'sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"></iframe></div>';
    } else if (t.link){
      visual = '<div class="trans-semvideo">Este link não pode ser mostrado aqui dentro.' +
        '<br><a class="btn btn-pequeno" href="' + A.escapar(t.link) + '" target="_blank" rel="noopener" style="margin-top:9px">' +
        A.icone("link",14) + ' Abrir o vídeo</a></div>';
    } else {
      visual = '<div class="trans-semvideo">Este item não tem link salvo.</div>';
    }

    A.abrirJanela({
      titulo: t.titulo || "Vídeo salvo",
      larga: true,
      semFoco: true,
      corpo:
        '<div class="ficha-linha" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
          '<span class="pilula ' + (CORES[plataforma] || "p-cinza") + '">' + A.escapar(plataforma) + '</span>' +
          '<span class="celula-fraca" style="font-size:.76rem">salvo em ' + A.escapar(A.dataBR(t.criado_em)) + '</span>' +
          (t.link ? '<a class="btn btn-pequeno" href="' + A.escapar(t.link) + '" target="_blank" rel="noopener" style="margin-left:auto">' + A.icone("link",13) + ' Abrir na rede</a>' : '') +
        '</div>' +

        visual +

        '<div class="ficha-linha" style="margin-top:16px">' +
          '<div class="ficha-rotulo" style="display:flex;align-items:center;gap:8px">Transcrição' +
            (t.roteiro ? '<button type="button" class="btn btn-pequeno" data-copiar="1" style="margin-left:auto">Copiar</button>' : '') +
          '</div>' +
          (t.roteiro
            ? '<div class="roteiro-caixa">' + A.escapar(t.roteiro) + '</div>'
            : '<div class="vazio" style="padding:16px">Sem transcrição salva. Clique em editar e use o botão do TokScript para gerar.</div>') +
        '</div>' +

        '<div class="ficha-linha">' +
          '<div class="ficha-rotulo">Minhas observações</div>' +
          (t.obs
            ? '<div class="obs-caixa">' + A.escapar(t.obs) + '</div>'
            : '<div class="celula-fraca" style="font-size:.84rem">Nenhuma observação ainda.</div>') +
        '</div>',

      botoes: [
        { texto:"Apagar", classe:"btn-perigo", aoClicar:function(fechar){ fechar(); apagar(t.id); } },
        { texto:"Fechar", aoClicar:function(fechar){ fechar(); } },
        { texto:"Editar", classe:"btn-lima", aoClicar:function(fechar){ fechar(); abrirFormulario(t); } }
      ],

      aoAbrir: function(corpo){
        var botaoCopiar = corpo.querySelector("[data-copiar]");
        if (botaoCopiar){
          botaoCopiar.addEventListener("click", function(){
            copiar(t.roteiro, "Transcrição copiada");
          });
        }
      }
    });
  }

  /* ---------------- FORMULARIO ---------------- */
  function abrirFormulario(item){
    var novo = !item;
    item = item || { titulo:"", link:"", plataforma:"", roteiro:"", obs:"" };

    A.abrirJanela({
      titulo: novo ? "Adicionar vídeo" : "Editar vídeo",
      larga: true,
      corpo:
        '<div class="campo"><label for="tLink">Link do vídeo</label>' +
        '<input id="tLink" type="url" value="' + A.escapar(item.link) + '" placeholder="Cole aqui o link do YouTube, Instagram ou TikTok">' +
        '<div class="celula-fraca" id="tDetectado" style="font-size:.76rem;margin-top:5px"></div></div>' +

        '<div class="campo"><label for="tTitulo">Título</label>' +
        '<input id="tTitulo" type="text" value="' + A.escapar(item.titulo) + '" placeholder="Como você quer chamar esse vídeo"></div>' +

        '<div class="caixa-tokscript">' +
          '<div><b>Ainda não tem a transcrição?</b><br>' +
          '<span>O botão abaixo copia o link do vídeo e abre a página certa do TokScript. ' +
          'Lá você cola o link, gera o texto e traz de volta para o campo Transcrição.</span></div>' +
          '<button type="button" class="btn btn-lima" id="tGerar">Gerar transcrição</button>' +
        '</div>' +

        '<div class="campo"><label for="tRoteiro">Transcrição</label>' +
        '<textarea id="tRoteiro" class="area-roteiro" style="min-height:190px" placeholder="Cole aqui o texto do vídeo">' + A.escapar(item.roteiro) + '</textarea></div>' +

        '<div class="campo"><label for="tObs">Minhas observações</label>' +
        '<textarea id="tObs" placeholder="O que te chamou atenção, o gancho, o que dá para adaptar para a sua marca">' + A.escapar(item.obs) + '</textarea></div>' +

        '<div class="campo-erro escondido" id="tErro"></div>',

      aoAbrir: function(corpo){
        var campoLink = corpo.querySelector("#tLink");
        var marcador  = corpo.querySelector("#tDetectado");

        function mostrarPlataforma(){
          var p = detectarPlataforma(campoLink.value);
          marcador.innerHTML = campoLink.value.trim()
            ? 'Rede identificada: <b>' + A.escapar(p) + '</b>'
            : 'A rede é identificada sozinha assim que você colar o link.';
        }
        campoLink.addEventListener("input", mostrarPlataforma);
        mostrarPlataforma();

        corpo.querySelector("#tGerar").addEventListener("click", function(){
          var link = campoLink.value.trim();
          var p = detectarPlataforma(link);
          if (link) copiar(link, "Link copiado, agora é só colar no TokScript");
          else A.recado("Cole o link do vídeo primeiro", true);
          window.open(TOKSCRIPT[p] || TOKSCRIPT.Outro, "_blank", "noopener");
        });
      },

      botoes: [
        { texto:"Cancelar", aoClicar:function(fechar){ fechar(); } },
        { texto: novo ? "Salvar vídeo" : "Salvar", classe:"btn-lima", aoClicar:async function(fechar){
            var link = document.getElementById("tLink").value.trim();
            var titulo = document.getElementById("tTitulo").value.trim();
            var erro = document.getElementById("tErro");

            if (!titulo && !link){
              erro.textContent = "Coloque pelo menos o link ou um título.";
              erro.classList.remove("escondido");
              return;
            }

            var dados = {
              titulo: titulo || ("Vídeo do " + detectarPlataforma(link)),
              link: link,
              plataforma: detectarPlataforma(link),
              roteiro: document.getElementById("tRoteiro").value.trim(),
              obs: document.getElementById("tObs").value.trim()
            };

            var r = novo
              ? await window.Banco.consulta("transcricoes", function(c){ return c.from("transcricoes").insert(dados); })
              : await window.Banco.consulta("transcricoes", function(c){ return c.from("transcricoes").update(dados).eq("id", item.id); });

            if (r.erro){ A.recado(r.erro, true); return; }
            fechar();
            A.recado(novo ? "Vídeo salvo" : "Alterações salvas");
            await recarregar();
          }
        }
      ]
    });
  }

  function apagar(id){
    var t = itens.filter(function(x){ return x.id === id; })[0];
    if (!t) return;
    A.confirmar("Apagar vídeo", 'Quer mesmo apagar "' + (t.titulo || "este vídeo") + '" e a transcrição dele? Isso não tem como desfazer.', async function(){
      var r = await window.Banco.consulta("transcricoes", function(c){ return c.from("transcricoes").delete().eq("id", id); });
      if (r.erro){ A.recado(r.erro, true); return; }
      A.recado("Vídeo apagado");
      await recarregar();
    });
  }

  /* ---------------- DESENHAR ---------------- */
  function contar(p){
    return itens.filter(function(t){ return t.plataforma === p; }).length;
  }

  function desenhar(){
    var lista = filtrar();

    area.innerHTML =
      '<div class="faixa-numeros de-quatro">' +
        '<div class="numero"><div class="numero-rotulo">Vídeos salvos</div>' +
          '<div class="numero-valor">' + itens.length + '</div></div>' +
        PLATAFORMAS.slice(0,3).map(function(p){
          return '<div class="numero"><div class="numero-rotulo">' + p + '</div>' +
                 '<div class="numero-valor">' + contar(p) + '</div></div>';
        }).join("") +
      '</div>' +

      '<div class="ferramentas">' +
        '<div class="busca">' + A.icone("busca") +
        '<input type="search" id="tBusca" placeholder="Buscar no título, na transcrição ou nas notas" value="' + A.escapar(busca) + '"></div>' +
        '<div class="grupo-filtro">' +
          ["Todas"].concat(PLATAFORMAS).map(function(f){
            return '<button type="button" class="filtro' + (filtro === f ? " ativo" : "") + '" data-filtro="' + A.escapar(f) + '">' + A.escapar(f) + '</button>';
          }).join("") +
        '</div>' +
        '<span class="espaco"></span>' +
        '<button type="button" class="btn btn-lima" id="tAdd">' + A.icone("mais") + ' Adicionar vídeo</button>' +
      '</div>' +

      montarLista(lista);

    var campoBusca = document.getElementById("tBusca");
    campoBusca.addEventListener("input", function(){
      busca = campoBusca.value;
      var posicao = campoBusca.selectionStart;
      desenhar();
      var novo = document.getElementById("tBusca");
      novo.focus();
      try { novo.setSelectionRange(posicao, posicao); } catch(f){}
    });

    area.querySelectorAll("[data-filtro]").forEach(function(b){
      b.addEventListener("click", function(){ filtro = b.dataset.filtro; desenhar(); });
    });
    document.getElementById("tAdd").addEventListener("click", function(){ abrirFormulario(null); });
    area.querySelectorAll("[data-abrir]").forEach(function(b){
      b.addEventListener("click", function(){ abrirFicha(b.dataset.abrir); });
    });
  }

  async function recarregar(){
    await carregar();
    desenhar();
  }

  A.registrarAba({
    id: "transcricoes",
    nome: "Transcrições",
    subtitulo: "Os vídeos que te inspiram, com o texto deles e as suas notas",
    icone: "transcricao",
    grupo: "rotina",
    montar: async function(destino){
      area = destino;
      await carregar();
      desenhar();
    }
  });

})();
