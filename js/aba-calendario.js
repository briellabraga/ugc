/* ============================================================
   ABA CALENDARIO
   Mes inteiro em grade, de segunda a domingo. Os prazos das
   campanhas aparecem sozinhos, puxados da tabela campanhas,
   para voce nao precisar digitar a mesma coisa duas vezes.
   ============================================================ */

(function(){
  "use strict";
  var A = window.Admin;

  var TIPOS = [
    { nome:"gravar", cor:"p-azul"  },
    { nome:"editar", cor:"p-roxo"  },
    { nome:"postar", cor:"p-verde" }
  ];
  var SEMANA = ["seg","ter","qua","qui","sex","sáb","dom"];
  var MESES = ["janeiro","fevereiro","março","abril","maio","junho",
               "julho","agosto","setembro","outubro","novembro","dezembro"];

  var itens = [];
  var prazos = [];
  var area = null;
  var mesVisivel = null;
  var filtro = "todos";

  async function carregar(){
    var r1 = await window.Banco.consulta("calendario", function(c){
      return c.from("calendario").select("*").order("data", { ascending:true });
    });
    itens = r1.dados || [];

    var r2 = await window.Banco.consulta("campanhas", function(c){
      return c.from("campanhas").select("id,campanha,cliente,prazo,status").not("prazo","is",null);
    });
    prazos = (r2.dados || []).map(function(c){
      return {
        id: "prazo-" + c.id,
        titulo: "Prazo: " + (c.campanha || "campanha"),
        marca: c.cliente || "",
        tipo: "prazo",
        data: c.prazo,
        status: (c.status === "Entregue") ? "feito" : "a fazer",
        deCampanha: true
      };
    });
  }

  function todos(){
    return itens.concat(prazos);
  }

  function doFiltro(lista){
    if (filtro === "todos") return lista;
    return lista.filter(function(i){ return i.tipo === filtro; });
  }

  function corDoTipo(tipo){
    if (tipo === "prazo") return "p-ambar";
    var t = TIPOS.filter(function(x){ return x.nome === tipo; })[0];
    return t ? t.cor : "p-cinza";
  }

  /* Segunda como primeiro dia da semana: 0 = segunda, 6 = domingo. */
  function diaDaSemana(data){
    return (data.getDay() + 6) % 7;
  }

  function montarDias(){
    var primeiro = new Date(mesVisivel.getFullYear(), mesVisivel.getMonth(), 1);
    var comeco = new Date(primeiro);
    comeco.setDate(comeco.getDate() - diaDaSemana(primeiro));

    var dias = [];
    for (var i = 0; i < 42; i++){
      var d = new Date(comeco);
      d.setDate(comeco.getDate() + i);
      dias.push(d);
    }
    // Se a ultima semana inteira for do mes seguinte, nao mostra.
    if (dias[35].getMonth() !== mesVisivel.getMonth() &&
        dias[35] > new Date(mesVisivel.getFullYear(), mesVisivel.getMonth() + 1, 0)){
      dias = dias.slice(0, 35);
    }
    return dias;
  }

  function itensDoDia(chave){
    return doFiltro(todos()).filter(function(i){
      return String(i.data || "").slice(0,10) === chave;
    });
  }

  /* ---------------- GRADE ---------------- */
  function montarGrade(){
    var dias = montarDias();
    var hojeChave = A.paraISO(A.hoje());

    return '<div class="cal-semana">' + SEMANA.map(function(s){ return '<span>' + s + '</span>'; }).join("") + '</div>' +
      '<div class="cal-grade">' +
      dias.map(function(d){
        var chave = A.paraISO(d);
        var fora = d.getMonth() !== mesVisivel.getMonth();
        var doDia = itensDoDia(chave);
        var mostrar = doDia.slice(0,3);
        var sobra = doDia.length - mostrar.length;

        return '<div class="cal-dia' + (fora ? " fora" : "") + (chave === hojeChave ? " hoje" : "") + '" data-dia="' + chave + '">' +
          '<span class="cal-num">' + d.getDate() + '</span>' +
          '<button type="button" class="cal-mais-btn" data-novo="' + chave + '" title="Adicionar neste dia" aria-label="Adicionar item no dia ' + A.escapar(A.dataBR(chave)) + '">+</button>' +
          mostrar.map(function(i){
            return '<button type="button" class="cal-item pilula ' + corDoTipo(i.tipo) + (i.status === "feito" ? " feito" : "") + '"' +
              ' data-item="' + A.escapar(i.id) + '" title="' + A.escapar(i.titulo + (i.marca ? " · " + i.marca : "")) + '">' +
              A.escapar(i.titulo) + '</button>';
          }).join("") +
          (sobra > 0 ? '<button type="button" class="cal-mais" data-verdia="' + chave + '">+' + sobra + ' mais</button>' : '') +
        '</div>';
      }).join("") +
      '</div>';
  }

  /* ---------------- FICOU PRA TRAS ---------------- */
  function montarAtrasados(){
    var hojeChave = A.paraISO(A.hoje());
    var atrasados = todos().filter(function(i){
      return i.status !== "feito" && String(i.data || "").slice(0,10) < hojeChave;
    }).sort(function(a,b){ return String(a.data).localeCompare(String(b.data)); });

    if (!atrasados.length){
      return '<div class="cartao cartao-pad" style="margin-top:18px">' +
        '<p class="titulo-bloco">Ficou pra trás</p>' +
        '<div class="vazio" style="padding:14px"><b>Nada atrasado</b>Tudo que passou do dia já está marcado como feito.</div></div>';
    }

    return '<div class="cartao cartao-pad" style="margin-top:18px">' +
      '<p class="titulo-bloco">Ficou pra trás</p>' +
      '<ul class="atrasados">' +
      atrasados.map(function(i){
        var dias = A.diasEntre(i.data, A.hoje());
        return '<li>' +
          '<span class="pilula ' + corDoTipo(i.tipo) + '">' + A.escapar(i.tipo) + '</span>' +
          '<span>' + A.escapar(i.titulo) + (i.marca ? ' <span class="celula-fraca">· ' + A.escapar(i.marca) + '</span>' : '') + '</span>' +
          '<span class="quanto">há ' + dias + (dias === 1 ? " dia" : " dias") + '</span>' +
        '</li>';
      }).join("") +
      '</ul></div>';
  }

  /* ---------------- JANELA DE UM DIA ---------------- */
  function verDia(chave){
    var doDia = itensDoDia(chave);
    A.abrirJanela({
      titulo: A.dataBR(chave),
      corpo: doDia.length
        ? '<ul style="margin:0">' + doDia.map(function(i){
            return '<li style="display:flex;gap:9px;align-items:center;padding:9px 0;border-bottom:1px solid var(--line)">' +
              '<span class="pilula ' + corDoTipo(i.tipo) + '">' + A.escapar(i.tipo) + '</span>' +
              '<span style="flex:1' + (i.status === "feito" ? ";text-decoration:line-through;opacity:.6" : "") + '">' +
                A.escapar(i.titulo) + (i.marca ? ' <span class="celula-fraca">· ' + A.escapar(i.marca) + '</span>' : '') + '</span>' +
              (i.deCampanha
                ? '<span class="celula-fraca" style="font-size:.74rem">vem da campanha</span>'
                : '<button type="button" class="btn btn-pequeno" data-editaritem="' + A.escapar(i.id) + '">Abrir</button>') +
            '</li>';
          }).join("") + '</ul>'
        : '<p style="margin:0;font-size:.88rem;color:var(--ink-fraco)">Nenhum item neste dia.</p>',
      botoes: [
        { texto:"Fechar", aoClicar:function(fechar){ fechar(); } },
        { texto:"Adicionar neste dia", classe:"btn-lima", aoClicar:function(fechar){ fechar(); abrirFormulario(null, chave); } }
      ],
      aoAbrir: function(corpo){
        corpo.querySelectorAll("[data-editaritem]").forEach(function(b){
          b.addEventListener("click", function(){
            A.fecharJanela();
            abrirFormulario(itens.filter(function(i){ return i.id === b.dataset.editaritem; })[0]);
          });
        });
      }
    });
  }

  /* ---------------- FORMULARIO ---------------- */
  function abrirFormulario(item, dataSugerida){
    var novo = !item;
    item = item || { titulo:"", marca:"", tipo:"gravar", data: dataSugerida || A.paraISO(A.hoje()), status:"a fazer" };

    A.abrirJanela({
      titulo: novo ? "Adicionar no calendário" : "Editar item",
      corpo:
        '<div class="campo"><label for="cTitulo">O que é</label>' +
        '<input id="cTitulo" type="text" value="' + A.escapar(item.titulo) + '" placeholder="Gravar unboxing do sérum"></div>' +

        '<div class="campo-duplo">' +
          '<div class="campo"><label for="cTipo">Tipo</label>' +
          '<select id="cTipo">' + TIPOS.map(function(t){
            return '<option value="' + t.nome + '"' + (t.nome === item.tipo ? " selected" : "") + '>' + t.nome + '</option>';
          }).join("") + '</select></div>' +
          '<div class="campo"><label for="cData">Data</label>' +
          '<input id="cData" type="date" value="' + A.escapar(String(item.data || "").slice(0,10)) + '"></div>' +
        '</div>' +

        '<div class="campo"><label for="cMarca">Marca</label>' +
        '<input id="cMarca" type="text" value="' + A.escapar(item.marca) + '" placeholder="Para qual marca"></div>' +

        '<div class="campo"><label class="campo-caixa">' +
        '<input id="cFeito" type="checkbox"' + (item.status === "feito" ? " checked" : "") + '> Já está feito</label></div>' +

        '<div class="campo-erro escondido" id="cErro"></div>',

      botoes: [].concat(
        novo ? [] : [{ texto:"Apagar", classe:"btn-perigo", aoClicar:function(fechar){ fechar(); apagar(item.id); } }],
        [
          { texto:"Cancelar", aoClicar:function(fechar){ fechar(); } },
          { texto: novo ? "Adicionar" : "Salvar", classe:"btn-lima", aoClicar:async function(fechar){
              var titulo = document.getElementById("cTitulo").value.trim();
              var data = document.getElementById("cData").value;
              var erro = document.getElementById("cErro");

              if (!titulo || !data){
                erro.textContent = "Preencha o que é e a data.";
                erro.classList.remove("escondido");
                return;
              }

              var dados = {
                titulo: titulo,
                marca: document.getElementById("cMarca").value.trim(),
                tipo: document.getElementById("cTipo").value,
                data: data,
                status: document.getElementById("cFeito").checked ? "feito" : "a fazer"
              };

              var r = novo
                ? await window.Banco.consulta("calendario", function(c){ return c.from("calendario").insert(dados); })
                : await window.Banco.consulta("calendario", function(c){ return c.from("calendario").update(dados).eq("id", item.id); });

              if (r.erro){ A.recado(r.erro, true); return; }
              fechar();
              A.recado(novo ? "Item adicionado" : "Item salvo");
              await recarregar();
            }
          }
        ]
      )
    });
  }

  function apagar(id){
    A.confirmar("Apagar item", "Quer mesmo apagar este item do calendário?", async function(){
      var r = await window.Banco.consulta("calendario", function(c){ return c.from("calendario").delete().eq("id", id); });
      if (r.erro){ A.recado(r.erro, true); return; }
      A.recado("Item apagado");
      await recarregar();
    });
  }

  /* ---------------- DESENHAR ---------------- */
  function desenhar(){
    var nomeMes = MESES[mesVisivel.getMonth()] + " de " + mesVisivel.getFullYear();

    area.innerHTML =
      '<div class="cal-topo">' +
        '<button type="button" class="btn btn-icone" id="cAnterior" title="Mês anterior" aria-label="Mês anterior">' + A.icone("esquerda",15) + '</button>' +
        '<button type="button" class="btn btn-icone" id="cProximo" title="Próximo mês" aria-label="Próximo mês">' + A.icone("direita",15) + '</button>' +
        '<span class="cal-mes">' + A.escapar(nomeMes) + '</span>' +
        '<button type="button" class="btn btn-pequeno" id="cHoje">Este mês</button>' +
        '<span class="espaco"></span>' +
        '<div class="grupo-filtro">' +
          ['todos'].concat(TIPOS.map(function(t){ return t.nome; })).map(function(f){
            return '<button type="button" class="filtro' + (filtro === f ? " ativo" : "") + '" data-filtro="' + f + '">' + f + '</button>';
          }).join("") +
        '</div>' +
        '<button type="button" class="btn btn-lima" id="cAdd">' + A.icone("mais") + ' Adicionar</button>' +
      '</div>' +

      montarGrade() +

      '<p style="font-size:.76rem;color:var(--ink-fraco);margin:10px 2px 0">' +
        'Os itens em âmbar são prazos de campanha. Eles vêm sozinhos da aba Campanhas, ' +
        'então para mudar a data é só mudar o prazo lá.</p>' +

      montarAtrasados();

    document.getElementById("cAnterior").addEventListener("click", function(){
      mesVisivel = new Date(mesVisivel.getFullYear(), mesVisivel.getMonth() - 1, 1);
      desenhar();
    });
    document.getElementById("cProximo").addEventListener("click", function(){
      mesVisivel = new Date(mesVisivel.getFullYear(), mesVisivel.getMonth() + 1, 1);
      desenhar();
    });
    document.getElementById("cHoje").addEventListener("click", function(){
      var h = A.hoje();
      mesVisivel = new Date(h.getFullYear(), h.getMonth(), 1);
      desenhar();
    });
    document.getElementById("cAdd").addEventListener("click", function(){ abrirFormulario(null); });

    area.querySelectorAll("[data-filtro]").forEach(function(b){
      b.addEventListener("click", function(){ filtro = b.dataset.filtro; desenhar(); });
    });

    area.querySelectorAll("[data-novo]").forEach(function(b){
      b.addEventListener("click", function(e){
        e.stopPropagation();
        abrirFormulario(null, b.dataset.novo);
      });
    });
    area.querySelectorAll("[data-verdia]").forEach(function(b){
      b.addEventListener("click", function(e){ e.stopPropagation(); verDia(b.dataset.verdia); });
    });
    area.querySelectorAll("[data-item]").forEach(function(b){
      b.addEventListener("click", function(e){
        e.stopPropagation();
        var achado = itens.filter(function(i){ return i.id === b.dataset.item; })[0];
        if (achado) abrirFormulario(achado);
        else A.recado("Este item é um prazo de campanha. Edite ele na aba Campanhas.");
      });
    });
    area.querySelectorAll(".cal-dia").forEach(function(dia){
      dia.addEventListener("click", function(){ abrirFormulario(null, dia.dataset.dia); });
    });
  }

  async function recarregar(){
    await carregar();
    desenhar();
  }

  A.registrarAba({
    id: "calendario",
    nome: "Calendário",
    subtitulo: "O que gravar, editar e postar em cada dia",
    icone: "calendario",
    grupo: "rotina",
    montar: async function(destino){
      area = destino;
      var h = A.hoje();
      if (!mesVisivel) mesVisivel = new Date(h.getFullYear(), h.getMonth(), 1);
      await carregar();
      desenhar();
    }
  });

})();
