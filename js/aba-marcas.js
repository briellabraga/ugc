/* ============================================================
   ABA MARCAS
   A sua base de contatos de empresa, em formato de planilha.
   ============================================================ */

(function(){
  "use strict";
  var A = window.Admin;

  var SITUACOES = [
    { nome:"Lead",        cor:"p-azul"  },
    { nome:"Conversando", cor:"p-ambar" },
    { nome:"Cliente",     cor:"p-verde" },
    { nome:"Parada",      cor:"p-cinza" }
  ];

  var marcas = [];
  var area = null;
  var busca = "";
  var filtro = "Todas";

  async function carregar(){
    var r = await window.Banco.consulta("marcas", function(c){
      return c.from("marcas").select("*").order("criado_em", { ascending:false });
    });
    marcas = r.dados || [];
  }

  function corDaSituacao(nome){
    var s = SITUACOES.filter(function(x){ return x.nome === nome; })[0];
    return s ? s.cor : "p-cinza";
  }

  function soNumeros(telefone){
    return String(telefone || "").replace(/\D/g, "");
  }

  function linkZap(telefone){
    var n = soNumeros(telefone);
    if (n.length < 10) return null;
    if (n.length <= 11) n = "55" + n;
    return "https://wa.me/" + n;
  }

  function arroba(instagram){
    var t = String(instagram || "").trim().replace(/^@/, "").replace(/\/$/, "");
    if (!t) return null;
    if (/^https?:\/\//i.test(t)) return { texto:t, link:t };
    return { texto:"@" + t, link:"https://instagram.com/" + t };
  }

  function filtrar(){
    var termo = busca.trim().toLowerCase();
    return marcas.filter(function(m){
      if (filtro !== "Todas" && m.situacao !== filtro) return false;
      if (!termo) return true;
      return [m.nome, m.instagram, m.email]
        .map(function(x){ return String(x || "").toLowerCase(); })
        .some(function(x){ return x.indexOf(termo) !== -1; });
    });
  }

  /* ---------------- TABELA ---------------- */
  function montarTabela(lista){
    if (!marcas.length){
      return '<div class="cartao"><div class="vazio"><b>Nenhuma marca na sua base ainda</b>' +
        'Clique em adicionar marca para cadastrar a primeira. Os contatos que chegarem pelo ' +
        'formulário do seu site também caem aqui sozinhos, como Lead.</div></div>';
    }
    if (!lista.length){
      return '<div class="cartao"><div class="vazio"><b>Nada encontrado</b>' +
        'Nenhuma marca combina com essa busca ou com esse filtro. Tente outra palavra.</div></div>';
    }

    return '<div class="rolagem cartao"><table>' +
      '<thead><tr>' +
        '<th>Marca</th><th>Instagram</th><th>E-mail</th><th>Telefone</th>' +
        '<th>Situação</th><th>Observação</th><th>Último contato</th><th style="width:76px"></th>' +
      '</tr></thead><tbody>' +
      lista.map(function(m){
        var ig = arroba(m.instagram);
        var zap = linkZap(m.telefone);
        return '<tr class="clicavel" data-abrir="' + A.escapar(m.id) + '">' +
          '<td class="celula-forte">' + A.escapar(m.nome || "sem nome") +
            (A.ehExemplo(m) ? '<span class="etiqueta-exemplo">exemplo</span>' : '') + '</td>' +
          '<td>' + (ig
              ? '<a href="' + A.escapar(ig.link) + '" target="_blank" rel="noopener" data-parar="1" style="color:var(--azul)">' + A.escapar(ig.texto) + '</a>'
              : '<span class="celula-fraca">sem instagram</span>') + '</td>' +
          '<td>' + (m.email
              ? '<a href="mailto:' + A.escapar(m.email) + '" data-parar="1">' + A.escapar(m.email) + '</a>'
              : '<span class="celula-fraca">sem e-mail</span>') + '</td>' +
          '<td class="celula-fraca">' + A.escapar(m.telefone || "") + '</td>' +
          '<td><span class="pilula ' + corDaSituacao(m.situacao) + '">' + A.escapar(m.situacao || "Lead") + '</span></td>' +
          '<td class="celula-fraca" style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + A.escapar(m.obs || "") + '">' + A.escapar(m.obs || "") + '</td>' +
          '<td class="celula-fraca">' + A.escapar(A.dataBR(m.ultimo_contato)) + '</td>' +
          '<td><div class="acoes">' +
            (zap ? '<a class="btn btn-icone" href="' + A.escapar(zap) + '" target="_blank" rel="noopener" data-parar="1" title="Abrir no WhatsApp" style="color:var(--verde)">' + A.icone("zap",15) + '</a>' : '') +
            '<button type="button" class="btn btn-icone btn-perigo" data-apagar="' + A.escapar(m.id) + '" title="Apagar">' + A.icone("lixo",15) + '</button>' +
          '</div></td>' +
        '</tr>';
      }).join("") +
      '</tbody></table></div>';
  }

  /* ---------------- FORMULARIO ---------------- */
  function abrirFormulario(marca){
    var novo = !marca;
    marca = marca || { nome:"", instagram:"", email:"", telefone:"", situacao:"Lead", obs:"", ultimo_contato:"" };

    A.abrirJanela({
      titulo: novo ? "Adicionar marca" : "Editar marca",
      corpo:
        '<div class="campo"><label for="mNome">Nome da marca</label>' +
        '<input id="mNome" type="text" value="' + A.escapar(marca.nome) + '" placeholder="Nome da empresa"></div>' +

        '<div class="campo-duplo">' +
          '<div class="campo"><label for="mInsta">Instagram</label>' +
          '<input id="mInsta" type="text" value="' + A.escapar(marca.instagram) + '" placeholder="@marca"></div>' +
          '<div class="campo"><label for="mTel">Telefone</label>' +
          '<input id="mTel" type="tel" value="' + A.escapar(marca.telefone) + '" placeholder="(62) 90000-0000"></div>' +
        '</div>' +

        '<div class="campo"><label for="mEmail">E-mail</label>' +
        '<input id="mEmail" type="email" value="' + A.escapar(marca.email) + '" placeholder="contato@marca.com"></div>' +

        '<div class="campo-duplo">' +
          '<div class="campo"><label for="mSituacao">Situação</label>' +
          '<select id="mSituacao">' + SITUACOES.map(function(s){
            return '<option value="' + s.nome + '"' + (s.nome === marca.situacao ? " selected" : "") + '>' + s.nome + '</option>';
          }).join("") + '</select></div>' +
          '<div class="campo"><label for="mData">Último contato</label>' +
          '<input id="mData" type="date" value="' + A.escapar(String(marca.ultimo_contato || "").slice(0,10)) + '"></div>' +
        '</div>' +

        '<div class="campo"><label for="mObs">Observação</label>' +
        '<textarea id="mObs" placeholder="O que ficou combinado, o que ela pediu, quando retomar">' + A.escapar(marca.obs) + '</textarea></div>' +

        '<div class="campo-erro escondido" id="mErro"></div>',

      botoes: [
        { texto:"Cancelar", aoClicar:function(fechar){ fechar(); } },
        { texto: novo ? "Adicionar" : "Salvar", classe:"btn-lima", aoClicar:async function(fechar){
            var nome = document.getElementById("mNome").value.trim();
            var erro = document.getElementById("mErro");
            if (!nome){
              erro.textContent = "Escreva pelo menos o nome da marca.";
              erro.classList.remove("escondido");
              document.getElementById("mNome").focus();
              return;
            }

            var dados = {
              nome: nome,
              instagram: document.getElementById("mInsta").value.trim(),
              email: document.getElementById("mEmail").value.trim(),
              telefone: document.getElementById("mTel").value.trim(),
              situacao: document.getElementById("mSituacao").value,
              obs: document.getElementById("mObs").value.trim(),
              ultimo_contato: document.getElementById("mData").value || null
            };

            var r = novo
              ? await window.Banco.consulta("marcas", function(c){ return c.from("marcas").insert(dados); })
              : await window.Banco.consulta("marcas", function(c){ return c.from("marcas").update(dados).eq("id", marca.id); });

            if (r.erro){ A.recado(r.erro, true); return; }
            fechar();
            A.recado(novo ? "Marca adicionada" : "Marca salva");
            await recarregar();
          }
        }
      ]
    });
  }

  function apagar(id){
    var m = marcas.filter(function(x){ return x.id === id; })[0];
    if (!m) return;
    A.confirmar("Apagar marca", 'Quer mesmo apagar "' + (m.nome || "esta marca") + '" da sua base? Isso não tem como desfazer.', async function(){
      var r = await window.Banco.consulta("marcas", function(c){ return c.from("marcas").delete().eq("id", id); });
      if (r.erro){ A.recado(r.erro, true); return; }
      A.recado("Marca apagada");
      await recarregar();
    });
  }

  function baixar(){
    var lista = filtrar();
    if (!lista.length){ A.recado("Não há nada para baixar com esse filtro", true); return; }
    A.baixarCSV(
      "minhas-marcas.csv",
      ["Marca","Instagram","E-mail","Telefone","Situação","Observação","Último contato"],
      lista.map(function(m){
        return [m.nome, m.instagram, m.email, m.telefone, m.situacao, m.obs, A.dataBR(m.ultimo_contato)];
      })
    );
    A.recado("Arquivo baixado");
  }

  /* ---------------- DESENHAR ---------------- */
  function contar(nome){
    return marcas.filter(function(m){ return m.situacao === nome; }).length;
  }

  function desenhar(){
    var lista = filtrar();

    area.innerHTML =
      '<div class="faixa-numeros de-quatro">' +
        SITUACOES.map(function(s){
          return '<div class="numero"><div class="numero-rotulo">' + s.nome + '</div>' +
                 '<div class="numero-valor">' + contar(s.nome) + '</div></div>';
        }).join("") +
      '</div>' +

      '<div class="ferramentas">' +
        '<div class="busca">' + A.icone("busca") +
        '<input type="search" id="mBusca" placeholder="Buscar por nome, @ ou e-mail" value="' + A.escapar(busca) + '"></div>' +
        '<div class="grupo-filtro">' +
          ["Todas"].concat(SITUACOES.map(function(s){ return s.nome; })).map(function(f){
            return '<button type="button" class="filtro' + (filtro === f ? " ativo" : "") + '" data-filtro="' + f + '">' + f + '</button>';
          }).join("") +
        '</div>' +
        '<span class="espaco"></span>' +
        '<button type="button" class="btn" id="mBaixar">' + A.icone("baixar") + ' Baixar CSV</button>' +
        '<button type="button" class="btn btn-lima" id="mAdd">' + A.icone("mais") + ' Adicionar marca</button>' +
      '</div>' +

      montarTabela(lista);

    var campoBusca = document.getElementById("mBusca");
    campoBusca.addEventListener("input", function(){
      busca = campoBusca.value;
      var posicao = campoBusca.selectionStart;
      desenhar();
      var novo = document.getElementById("mBusca");
      novo.focus();
      try { novo.setSelectionRange(posicao, posicao); } catch(f){}
    });

    area.querySelectorAll("[data-filtro]").forEach(function(b){
      b.addEventListener("click", function(){ filtro = b.dataset.filtro; desenhar(); });
    });
    document.getElementById("mAdd").addEventListener("click", function(){ abrirFormulario(null); });
    document.getElementById("mBaixar").addEventListener("click", baixar);

    area.querySelectorAll("[data-apagar]").forEach(function(b){
      b.addEventListener("click", function(e){ e.stopPropagation(); apagar(b.dataset.apagar); });
    });
    area.querySelectorAll("[data-parar]").forEach(function(a){
      a.addEventListener("click", function(e){ e.stopPropagation(); });
    });
    area.querySelectorAll("[data-abrir]").forEach(function(linha){
      linha.addEventListener("click", function(){
        abrirFormulario(marcas.filter(function(m){ return m.id === linha.dataset.abrir; })[0]);
      });
    });
  }

  async function recarregar(){
    await carregar();
    desenhar();
  }

  A.registrarAba({
    id: "marcas",
    nome: "Marcas",
    subtitulo: "Com quem você já falou e em que pé está cada conversa",
    icone: "marcas",
    grupo: "site",
    montar: async function(destino){
      area = destino;
      await carregar();
      desenhar();
    }
  });

})();
