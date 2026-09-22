/* ============================================================
   ABA CAMPANHAS
   Quanto voce tem fechado, quanto falta receber e em que pe
   esta cada trabalho.
   ============================================================ */

(function(){
  "use strict";
  var A = window.Admin;

  /* A ordem do funil. Ordenar por status segue esta ordem,
     nunca a ordem do alfabeto. */
  var STATUS = ["Briefing","Roteiro","Aprovação Roteiro","Gravação","Edição","Aprovado","Entregue"];
  var CORES_STATUS = {
    "Briefing":"p-cinza", "Roteiro":"p-azul", "Aprovação Roteiro":"p-roxo",
    "Gravação":"p-ambar", "Edição":"p-ambar", "Aprovado":"p-lima", "Entregue":"p-verde"
  };
  var TIPOS = ["Conteúdo","Publicidade"];

  var campanhas = [];
  var area = null;
  var busca = "";
  var filtro = "Todas";
  var ordenarPor = "prazo";
  var crescente = true;

  async function carregar(){
    var r = await window.Banco.consulta("campanhas", function(c){
      return c.from("campanhas").select("*");
    });
    campanhas = r.dados || [];
  }

  /* ---------------- NUMEROS ---------------- */
  function montarNumeros(){
    var total = campanhas.length;
    var ativas = campanhas.filter(function(c){ return c.ativa; }).length;

    var valorTotal = campanhas.reduce(function(s,c){ return s + A.numero(c.valor); }, 0);
    var qtdTotal   = campanhas.reduce(function(s,c){ return s + A.numero(c.qtd); }, 0);
    var ticket     = A.dividir(valorTotal, qtdTotal);

    var aReceber = campanhas.filter(function(c){ return c.pagamento !== "pago"; })
                            .reduce(function(s,c){ return s + A.numero(c.valor); }, 0);
    var recebido = campanhas.filter(function(c){ return c.pagamento === "pago"; })
                            .reduce(function(s,c){ return s + A.numero(c.valor); }, 0);

    return '<div class="faixa-numeros de-quatro">' +
      '<div class="numero"><div class="numero-rotulo">Campanhas</div>' +
        '<div class="numero-valor">' + total + '</div>' +
        '<div class="numero-apoio">' + (total ? "no total" : "nenhuma cadastrada") + '</div></div>' +

      '<div class="numero"><div class="numero-rotulo">Ativas agora</div>' +
        '<div class="numero-valor">' + ativas + '</div>' +
        '<div class="numero-apoio">' + (total ? (total - ativas) + " finalizada" + ((total - ativas) === 1 ? "" : "s") : "sem dados") + '</div></div>' +

      '<div class="numero"><div class="numero-rotulo">Valor total</div>' +
        '<div class="numero-valor">' + A.dinheiro(valorTotal) + '</div>' +
        '<div class="numero-apoio">' + (qtdTotal ? A.dinheiro(ticket) + " por vídeo" : "sem vídeo cadastrado") + '</div></div>' +

      '<div class="numero"><div class="numero-rotulo">A receber</div>' +
        '<div class="numero-valor">' + A.dinheiro(aReceber) + '</div>' +
        '<div class="numero-apoio">' + A.dinheiro(recebido) + ' já recebido</div></div>' +
    '</div>';
  }

  /* ---------------- PRAZO ---------------- */
  function avisoPrazo(c){
    if (!c.prazo) return '<span class="celula-fraca">sem prazo</span>';
    var texto = A.dataBR(c.prazo);
    if (c.status === "Entregue") return '<span class="celula-fraca">' + A.escapar(texto) + '</span>';

    var dias = A.diasEntre(A.hoje(), c.prazo);
    if (dias === null) return '<span class="celula-fraca">' + A.escapar(texto) + '</span>';

    if (dias < 0){
      var atraso = Math.abs(dias);
      return A.escapar(texto) + ' <span class="pilula p-vermelho">' + atraso + (atraso === 1 ? " dia atrasado" : " dias atrasado") + '</span>';
    }
    if (dias <= 3){
      return A.escapar(texto) + ' <span class="pilula p-ambar">' +
             (dias === 0 ? "vence hoje" : "faltam " + dias + (dias === 1 ? " dia" : " dias")) + '</span>';
    }
    return A.escapar(texto);
  }

  /* ---------------- ORDENAR E FILTRAR ---------------- */
  function valorDaColuna(c, coluna){
    switch (coluna){
      case "favorita":  return c.favorita ? 1 : 0;
      case "campanha":  return String(c.campanha || "").toLowerCase();
      case "cliente":   return String(c.cliente || "").toLowerCase();
      case "tipo":      return String(c.tipo || "").toLowerCase();
      case "status":    return STATUS.indexOf(c.status) === -1 ? 999 : STATUS.indexOf(c.status);
      case "qtd":       return A.numero(c.qtd);
      case "valor":     return A.numero(c.valor);
      case "prazo":     return c.prazo ? String(c.prazo).slice(0,10) : "9999-99-99";
      case "pagamento": return c.pagamento === "pago" ? 1 : 0;
      default:          return "";
    }
  }

  function listar(){
    var termo = busca.trim().toLowerCase();

    var lista = campanhas.filter(function(c){
      if (filtro === "Ativas" && !c.ativa) return false;
      if (filtro === "Finalizadas" && c.ativa) return false;
      if (!termo) return true;
      return [c.campanha, c.cliente, c.status, c.tipo]
        .map(function(x){ return String(x || "").toLowerCase(); })
        .some(function(x){ return x.indexOf(termo) !== -1; });
    });

    lista.sort(function(a,b){
      var va = valorDaColuna(a, ordenarPor);
      var vb = valorDaColuna(b, ordenarPor);
      if (va < vb) return crescente ? -1 : 1;
      if (va > vb) return crescente ? 1 : -1;
      return 0;
    });

    return lista;
  }

  function cabecalho(chave, rotulo, extra){
    var ativa = ordenarPor === chave;
    var seta = ativa ? (crescente ? "▲" : "▼") : "▲";
    return '<th class="ordenavel' + (ativa ? " ordenando" : "") + '" data-ordenar="' + chave + '"' + (extra || "") +
           ' title="Clique para ordenar">' + A.escapar(rotulo) + '<span class="seta">' + seta + '</span></th>';
  }

  /* ---------------- TABELA ---------------- */
  function montarTabela(lista){
    if (!campanhas.length){
      return '<div class="cartao"><div class="vazio"><b>Nenhuma campanha cadastrada</b>' +
        'Clique em adicionar campanha para registrar o primeiro trabalho fechado. ' +
        'Os prazos que você colocar aqui aparecem sozinhos no calendário.</div></div>';
    }
    if (!lista.length){
      return '<div class="cartao"><div class="vazio"><b>Nada encontrado</b>' +
        'Nenhuma campanha combina com essa busca ou com esse filtro.</div></div>';
    }

    return '<div class="rolagem cartao"><table>' +
      '<thead><tr>' +
        cabecalho("favorita", "", ' style="width:38px"') +
        cabecalho("campanha", "Campanha") +
        cabecalho("cliente", "Cliente") +
        cabecalho("tipo", "Tipo") +
        cabecalho("status", "Status") +
        cabecalho("qtd", "Qtd", ' style="text-align:right"') +
        cabecalho("valor", "Valor") +
        cabecalho("prazo", "Prazo") +
        cabecalho("pagamento", "Pagamento") +
        '<th style="width:44px"></th>' +
      '</tr></thead><tbody>' +
      lista.map(function(c){
        return '<tr class="clicavel' + (c.favorita ? " destacada" : "") + '" data-abrir="' + A.escapar(c.id) + '">' +
          '<td><button type="button" class="estrela' + (c.favorita ? " marcada" : "") + '" data-estrela="' + A.escapar(c.id) + '"' +
            ' title="' + (c.favorita ? "Tirar destaque" : "Destacar") + '" aria-label="Destacar campanha">' +
            '<svg viewBox="0 0 24 24" width="16" height="16" fill="' + (c.favorita ? "currentColor" : "none") + '" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true">' +
            '<path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.9l1.1-6.5L2.6 9.8l6.5-.9Z"/></svg></button></td>' +
          '<td class="celula-forte">' + A.escapar(c.campanha || "sem nome") +
            (A.ehExemplo(c) ? '<span class="etiqueta-exemplo">exemplo</span>' : '') + '</td>' +
          '<td>' + A.escapar(c.cliente || "") + '</td>' +
          '<td><span class="pilula ' + (c.tipo === "Publicidade" ? "p-roxo" : "p-azul") + '">' + A.escapar(c.tipo || "") + '</span></td>' +
          '<td><span class="pilula ' + (CORES_STATUS[c.status] || "p-cinza") + '">' + A.escapar(c.status || "") + '</span></td>' +
          '<td class="numero-col">' + A.numero(c.qtd) + '</td>' +
          '<td class="celula-forte numero-col">' + A.dinheiro(c.valor) + '</td>' +
          '<td>' + avisoPrazo(c) + '</td>' +
          '<td><span class="pilula ' + (c.pagamento === "pago" ? "p-verde" : "p-ambar") + '">' + A.escapar(c.pagamento || "pendente") + '</span></td>' +
          '<td><div class="acoes"><button type="button" class="btn btn-icone btn-perigo" data-apagar="' + A.escapar(c.id) + '" title="Apagar">' + A.icone("lixo",15) + '</button></div></td>' +
        '</tr>';
      }).join("") +
      '</tbody></table></div>';
  }

  /* ---------------- FORMULARIO ---------------- */
  function abrirFormulario(campanha){
    var novo = !campanha;
    campanha = campanha || {
      campanha:"", cliente:"", tipo:"Conteúdo", status:"Briefing",
      qtd:1, valor:0, prazo:"", pagamento:"pendente", ativa:true, favorita:false
    };

    A.abrirJanela({
      titulo: novo ? "Adicionar campanha" : "Editar campanha",
      corpo:
        '<div class="campo"><label for="kCampanha">Nome da campanha</label>' +
        '<input id="kCampanha" type="text" value="' + A.escapar(campanha.campanha) + '" placeholder="Lançamento do sérum"></div>' +

        '<div class="campo"><label for="kCliente">Cliente</label>' +
        '<input id="kCliente" type="text" value="' + A.escapar(campanha.cliente) + '" placeholder="Nome da marca"></div>' +

        '<div class="campo-duplo">' +
          '<div class="campo"><label for="kTipo">Tipo</label><select id="kTipo">' +
            TIPOS.map(function(t){ return '<option value="' + A.escapar(t) + '"' + (t === campanha.tipo ? " selected" : "") + '>' + A.escapar(t) + '</option>'; }).join("") +
          '</select></div>' +
          '<div class="campo"><label for="kStatus">Status</label><select id="kStatus">' +
            STATUS.map(function(s){ return '<option value="' + A.escapar(s) + '"' + (s === campanha.status ? " selected" : "") + '>' + A.escapar(s) + '</option>'; }).join("") +
          '</select></div>' +
        '</div>' +

        '<div class="campo-duplo">' +
          '<div class="campo"><label for="kQtd">Quantos vídeos</label>' +
          '<input id="kQtd" type="number" min="0" step="1" value="' + A.numero(campanha.qtd) + '"></div>' +
          '<div class="campo"><label for="kValor">Valor total em reais</label>' +
          '<input id="kValor" type="number" min="0" step="0.01" value="' + A.numero(campanha.valor) + '"></div>' +
        '</div>' +

        '<div class="campo-duplo">' +
          '<div class="campo"><label for="kPrazo">Prazo de entrega</label>' +
          '<input id="kPrazo" type="date" value="' + A.escapar(String(campanha.prazo || "").slice(0,10)) + '"></div>' +
          '<div class="campo"><label for="kPagamento">Pagamento</label><select id="kPagamento">' +
            '<option value="pendente"' + (campanha.pagamento !== "pago" ? " selected" : "") + '>pendente</option>' +
            '<option value="pago"' + (campanha.pagamento === "pago" ? " selected" : "") + '>pago</option>' +
          '</select></div>' +
        '</div>' +

        '<div class="campo"><label class="campo-caixa">' +
        '<input id="kAtiva" type="checkbox"' + (campanha.ativa ? " checked" : "") + '> Campanha ativa</label></div>' +
        '<div class="campo"><label class="campo-caixa">' +
        '<input id="kFavorita" type="checkbox"' + (campanha.favorita ? " checked" : "") + '> Destacar com estrela</label></div>' +

        '<div class="campo-erro escondido" id="kErro"></div>',

      botoes: [
        { texto:"Cancelar", aoClicar:function(fechar){ fechar(); } },
        { texto: novo ? "Adicionar" : "Salvar", classe:"btn-lima", aoClicar:async function(fechar){
            var nome = document.getElementById("kCampanha").value.trim();
            var erro = document.getElementById("kErro");
            if (!nome){
              erro.textContent = "Escreva pelo menos o nome da campanha.";
              erro.classList.remove("escondido");
              document.getElementById("kCampanha").focus();
              return;
            }

            var dados = {
              campanha: nome,
              cliente: document.getElementById("kCliente").value.trim(),
              tipo: document.getElementById("kTipo").value,
              status: document.getElementById("kStatus").value,
              qtd: Math.max(0, Math.round(A.numero(document.getElementById("kQtd").value))),
              valor: Math.max(0, A.numero(document.getElementById("kValor").value)),
              prazo: document.getElementById("kPrazo").value || null,
              pagamento: document.getElementById("kPagamento").value,
              ativa: document.getElementById("kAtiva").checked,
              favorita: document.getElementById("kFavorita").checked
            };

            var r = novo
              ? await window.Banco.consulta("campanhas", function(c){ return c.from("campanhas").insert(dados); })
              : await window.Banco.consulta("campanhas", function(c){ return c.from("campanhas").update(dados).eq("id", campanha.id); });

            if (r.erro){ A.recado(r.erro, true); return; }
            fechar();
            A.recado(novo ? "Campanha adicionada" : "Campanha salva");
            await recarregar();
          }
        }
      ]
    });
  }

  async function alternarEstrela(id){
    var c = campanhas.filter(function(x){ return x.id === id; })[0];
    if (!c) return;
    var r = await window.Banco.consulta("campanhas", function(cli){
      return cli.from("campanhas").update({ favorita: !c.favorita }).eq("id", id);
    });
    if (r.erro){ A.recado(r.erro, true); return; }
    await recarregar();
  }

  function apagar(id){
    var c = campanhas.filter(function(x){ return x.id === id; })[0];
    if (!c) return;
    A.confirmar("Apagar campanha", 'Quer mesmo apagar "' + (c.campanha || "esta campanha") + '"? Isso não tem como desfazer.', async function(){
      var r = await window.Banco.consulta("campanhas", function(cli){ return cli.from("campanhas").delete().eq("id", id); });
      if (r.erro){ A.recado(r.erro, true); return; }
      A.recado("Campanha apagada");
      await recarregar();
    });
  }

  function baixar(){
    var lista = listar();
    if (!lista.length){ A.recado("Não há nada para baixar com esse filtro", true); return; }
    A.baixarCSV(
      "minhas-campanhas.csv",
      ["Campanha","Cliente","Tipo","Status","Qtd","Valor","Prazo","Pagamento","Ativa"],
      lista.map(function(c){
        return [c.campanha, c.cliente, c.tipo, c.status, A.numero(c.qtd),
                A.numero(c.valor).toFixed(2).replace(".", ","), A.dataBR(c.prazo),
                c.pagamento, c.ativa ? "sim" : "não"];
      })
    );
    A.recado("Arquivo baixado");
  }

  /* ---------------- DESENHAR ---------------- */
  function desenhar(){
    var lista = listar();

    area.innerHTML =
      montarNumeros() +
      '<div class="ferramentas">' +
        '<div class="busca">' + A.icone("busca") +
        '<input type="search" id="kBusca" placeholder="Buscar por campanha ou cliente" value="' + A.escapar(busca) + '"></div>' +
        '<div class="grupo-filtro">' +
          ["Todas","Ativas","Finalizadas"].map(function(f){
            return '<button type="button" class="filtro' + (filtro === f ? " ativo" : "") + '" data-filtro="' + f + '">' + f + '</button>';
          }).join("") +
        '</div>' +
        '<span class="espaco"></span>' +
        '<button type="button" class="btn" id="kBaixar">' + A.icone("baixar") + ' Baixar CSV</button>' +
        '<button type="button" class="btn btn-lima" id="kAdd">' + A.icone("mais") + ' Adicionar campanha</button>' +
      '</div>' +
      montarTabela(lista);

    var campoBusca = document.getElementById("kBusca");
    campoBusca.addEventListener("input", function(){
      busca = campoBusca.value;
      var posicao = campoBusca.selectionStart;
      desenhar();
      var novo = document.getElementById("kBusca");
      novo.focus();
      try { novo.setSelectionRange(posicao, posicao); } catch(f){}
    });

    area.querySelectorAll("[data-filtro]").forEach(function(b){
      b.addEventListener("click", function(){ filtro = b.dataset.filtro; desenhar(); });
    });
    area.querySelectorAll("[data-ordenar]").forEach(function(th){
      th.addEventListener("click", function(){
        var chave = th.dataset.ordenar;
        if (ordenarPor === chave) crescente = !crescente;
        else { ordenarPor = chave; crescente = true; }
        desenhar();
      });
    });
    document.getElementById("kAdd").addEventListener("click", function(){ abrirFormulario(null); });
    document.getElementById("kBaixar").addEventListener("click", baixar);

    area.querySelectorAll("[data-estrela]").forEach(function(b){
      b.addEventListener("click", function(e){ e.stopPropagation(); alternarEstrela(b.dataset.estrela); });
    });
    area.querySelectorAll("[data-apagar]").forEach(function(b){
      b.addEventListener("click", function(e){ e.stopPropagation(); apagar(b.dataset.apagar); });
    });
    area.querySelectorAll("[data-abrir]").forEach(function(linha){
      linha.addEventListener("click", function(){
        abrirFormulario(campanhas.filter(function(c){ return c.id === linha.dataset.abrir; })[0]);
      });
    });
  }

  async function recarregar(){
    await carregar();
    desenhar();
  }

  A.registrarAba({
    id: "campanhas",
    nome: "Campanhas",
    subtitulo: "Trabalhos fechados, prazos e o que falta receber",
    icone: "campanhas",
    grupo: "rotina",
    montar: async function(destino){
      area = destino;
      await carregar();
      desenhar();
    }
  });

})();
