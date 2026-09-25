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

  /* ============================================================
     IMPORTAR PLANILHA

     Lê um arquivo CSV, que é o formato que o Excel e o Planilhas
     Google geram em "salvar como". Reconhece as colunas pelo nome
     do cabeçalho, aceita vírgula ou ponto e vírgula como separador
     e mostra tudo numa prévia antes de gravar qualquer coisa.
     ============================================================ */

  /* Tira acento e deixa minúsculo, para comparar nome de coluna
     sem depender de como a pessoa escreveu. */
  function normalizar(texto){
    return String(texto === undefined || texto === null ? "" : texto)
      .trim().toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  /* Nomes de coluna que o painel entende, na ordem do arquivo que
     o próprio botão de baixar gera. */
  var COLUNAS = [
    { campo:"nome",           nomes:["marca","nome","nome da marca","empresa","cliente"] },
    { campo:"instagram",      nomes:["instagram","insta","arroba","perfil","@"] },
    { campo:"email",          nomes:["e-mail","email","mail","correio"] },
    { campo:"telefone",       nomes:["telefone","tel","celular","whatsapp","zap","fone","numero"] },
    { campo:"situacao",       nomes:["situacao","status","estagio","etapa"] },
    { campo:"obs",            nomes:["observacao","observacoes","obs","nota","notas","anotacao","anotacoes"] },
    { campo:"ultimo_contato", nomes:["ultimo contato","ultimo_contato","ultimocontato","data","data do ultimo contato"] }
  ];

  /* Descobre se o arquivo usa ponto e vírgula, vírgula ou tabulação. */
  function descobrirSeparador(texto){
    var primeira = texto.split(/\r?\n/)[0] || "";
    var fora = primeira.replace(/"[^"]*"/g, "");
    var contagem = [
      { s:";",  n:(fora.match(/;/g)  || []).length },
      { s:",",  n:(fora.match(/,/g)  || []).length },
      { s:"\t", n:(fora.match(/\t/g) || []).length }
    ].sort(function(a,b){ return b.n - a.n; });
    return contagem[0].n ? contagem[0].s : ";";
  }

  /* Quebra o texto em linhas e colunas respeitando as aspas, para
     observação com vírgula dentro não virar duas colunas. */
  function lerCSV(texto, separador){
    var linhas = [], linha = [], campo = "", dentroDeAspas = false;

    for (var i = 0; i < texto.length; i++){
      var c = texto.charAt(i);

      if (dentroDeAspas){
        if (c === '"'){
          if (texto.charAt(i + 1) === '"'){ campo += '"'; i++; }
          else dentroDeAspas = false;
        } else campo += c;
        continue;
      }

      if (c === '"')            dentroDeAspas = true;
      else if (c === separador) { linha.push(campo); campo = ""; }
      else if (c === "\n")      { linha.push(campo); linhas.push(linha); linha = []; campo = ""; }
      else if (c !== "\r")      campo += c;
    }
    if (campo !== "" || linha.length){ linha.push(campo); linhas.push(linha); }

    return linhas.filter(function(l){
      return l.some(function(v){ return String(v).trim() !== ""; });
    });
  }

  /* Lê o arquivo respeitando o acento. O Excel costuma salvar em
     um formato antigo, então se o texto vier estranho eu tento de
     novo do outro jeito. */
  function lerArquivo(arquivo){
    return new Promise(function(ok, erro){
      var leitor = new FileReader();
      leitor.onerror = function(){ erro(new Error("não consegui abrir o arquivo")); };
      leitor.onload = function(){
        var bytes = new Uint8Array(leitor.result);
        var texto = "";
        try { texto = new TextDecoder("utf-8").decode(bytes); } catch(f){ texto = ""; }
        if (!texto || texto.indexOf("�") !== -1){
          try { texto = new TextDecoder("windows-1252").decode(bytes); } catch(f){}
        }
        ok(String(texto).replace(/^﻿/, ""));
      };
      leitor.readAsArrayBuffer(arquivo);
    });
  }

  function lerSituacao(valor){
    var n = normalizar(valor);
    if (!n) return "Lead";
    if (n.indexOf("convers") === 0) return "Conversando";
    if (n.indexOf("client") === 0)  return "Cliente";
    if (n.indexOf("parad") === 0)   return "Parada";
    return "Lead";
  }

  /* Aceita 24/09/2026 e 2026-09-24. Qualquer outra coisa entra vazia,
     em vez de derrubar a importação inteira. */
  function lerDataPlanilha(valor){
    var s = String(valor || "").trim();
    if (!s) return null;
    var br = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (br){
      var ano = br[3].length === 2 ? "20" + br[3] : br[3];
      return ano + "-" + String(br[2]).padStart(2,"0") + "-" + String(br[1]).padStart(2,"0");
    }
    var iso = s.match(/^\d{4}-\d{2}-\d{2}/);
    return iso ? iso[0] : null;
  }

  /* Monta a ligação entre as colunas do arquivo e os campos da base. */
  function mapearColunas(cabecalho){
    var mapa = {}, reconhecidas = 0;
    cabecalho.forEach(function(titulo, posicao){
      var n = normalizar(titulo);
      COLUNAS.forEach(function(col){
        if (mapa[col.campo] !== undefined) return;
        if (col.nomes.indexOf(n) !== -1){ mapa[col.campo] = posicao; reconhecidas++; }
      });
    });
    return { mapa: mapa, reconhecidas: reconhecidas };
  }

  function montarContatos(linhas){
    var primeira = linhas[0] || [];
    var resultado = mapearColunas(primeira);
    var mapa = resultado.mapa;
    var temCabecalho = resultado.reconhecidas > 0;

    /* Sem cabeçalho reconhecido, assume a ordem do arquivo que o
       botão de baixar gera e avisa isso na prévia. */
    if (!temCabecalho){
      mapa = {};
      COLUNAS.forEach(function(col, i){ mapa[col.campo] = i; });
    }

    var corpo = temCabecalho ? linhas.slice(1) : linhas;

    return {
      temCabecalho: temCabecalho,
      colunasLidas: Object.keys(mapa),
      contatos: corpo.map(function(linha){
        function pegar(campo){
          var p = mapa[campo];
          return p === undefined ? "" : String(linha[p] === undefined ? "" : linha[p]).trim();
        }
        return {
          nome: pegar("nome"),
          instagram: pegar("instagram"),
          email: pegar("email"),
          telefone: pegar("telefone"),
          situacao: lerSituacao(pegar("situacao")),
          obs: pegar("obs"),
          ultimo_contato: lerDataPlanilha(pegar("ultimo_contato"))
        };
      }).filter(function(c){ return c.nome || c.email || c.instagram; })
    };
  }

  /* Já existe na base? Compara pelo e-mail, e sem e-mail pelo nome. */
  function jaExiste(contato){
    var email = normalizar(contato.email);
    var nome = normalizar(contato.nome);
    return marcas.some(function(m){
      if (email && normalizar(m.email) === email) return true;
      if (!email && nome && normalizar(m.nome) === nome) return true;
      return false;
    });
  }

  function escolherArquivo(){
    var entrada = document.createElement("input");
    entrada.type = "file";
    entrada.accept = ".csv,text/csv,text/plain";
    entrada.style.display = "none";
    document.body.appendChild(entrada);
    entrada.addEventListener("change", async function(){
      var arquivo = entrada.files && entrada.files[0];
      document.body.removeChild(entrada);
      if (arquivo) await prepararImportacao(arquivo);
    });
    entrada.click();
  }

  async function prepararImportacao(arquivo){
    if (/\.(xlsx|xls|ods|numbers)$/i.test(arquivo.name)){
      A.abrirJanela({
        titulo: "Salve como CSV primeiro",
        corpo:
          '<p style="margin:0 0 12px;font-size:.88rem;line-height:1.6">Esse arquivo é uma planilha do Excel, e o painel lê planilhas no formato CSV, que é o mesmo conteúdo em texto.</p>' +
          '<p style="margin:0;font-size:.88rem;line-height:1.6"><b>No Excel:</b> menu Arquivo, depois Salvar como, e no tipo escolha CSV.<br>' +
          '<b>No Planilhas Google:</b> menu Arquivo, depois Fazer download, depois CSV.<br><br>' +
          'Depois é só clicar de novo em importar planilha e escolher o arquivo salvo.</p>',
        botoes: [{ texto:"Entendi", classe:"btn-lima", aoClicar:function(fechar){ fechar(); } }]
      });
      return;
    }

    var texto;
    try { texto = await lerArquivo(arquivo); }
    catch (falha){ A.recado("Não consegui abrir esse arquivo", true); return; }

    if (!texto.trim()){ A.recado("Esse arquivo está vazio", true); return; }

    var linhas = lerCSV(texto, descobrirSeparador(texto));
    if (!linhas.length){ A.recado("Não encontrei nenhuma linha nesse arquivo", true); return; }

    var lido = montarContatos(linhas);
    if (!lido.contatos.length){
      A.recado("Não encontrei nenhum contato com nome, e-mail ou instagram", true);
      return;
    }
    mostrarPrevia(lido, arquivo.name);
  }

  function mostrarPrevia(lido, nomeArquivo){
    var contatos = lido.contatos;
    var repetidos = contatos.filter(jaExiste).length;

    var amostra = contatos.slice(0, 5);
    var tabela =
      '<div class="rolagem" style="border:1px solid var(--line);border-radius:10px;margin-top:6px"><table>' +
      '<thead><tr><th>Marca</th><th>Instagram</th><th>E-mail</th><th>Telefone</th><th>Situação</th><th>Último contato</th></tr></thead><tbody>' +
      amostra.map(function(c){
        return '<tr>' +
          '<td class="celula-forte">' + A.escapar(c.nome || "sem nome") + (jaExiste(c) ? '<span class="etiqueta-exemplo">já existe</span>' : '') + '</td>' +
          '<td class="celula-fraca">' + A.escapar(c.instagram) + '</td>' +
          '<td class="celula-fraca">' + A.escapar(c.email) + '</td>' +
          '<td class="celula-fraca">' + A.escapar(c.telefone) + '</td>' +
          '<td><span class="pilula ' + corDaSituacao(c.situacao) + '">' + A.escapar(c.situacao) + '</span></td>' +
          '<td class="celula-fraca">' + A.escapar(A.dataBR(c.ultimo_contato)) + '</td>' +
        '</tr>';
      }).join("") +
      '</tbody></table></div>';

    A.abrirJanela({
      titulo: "Conferir antes de importar",
      larga: true,
      semFoco: true,
      corpo:
        '<p style="margin:0 0 4px;font-size:.88rem;line-height:1.6">' +
          'Li <b>' + contatos.length + (contatos.length === 1 ? ' contato' : ' contatos') + '</b> no arquivo ' +
          '<b>' + A.escapar(nomeArquivo) + '</b>.' +
          (repetidos ? ' Desses, <b>' + repetidos + '</b> já estão na sua base.' : '') +
        '</p>' +

        (lido.temCabecalho
          ? '<p style="margin:0;font-size:.79rem;color:var(--ink-fraco)">Reconheci as colunas pelo cabeçalho da planilha.</p>'
          : '<div class="aviso" style="margin:10px 0 0">' + A.icone("alerta") +
            '<div>Não reconheci os nomes das colunas, então li na ordem: marca, instagram, e-mail, telefone, situação, observação e último contato. ' +
            'Confira na tabela abaixo se bateu, e cancele se estiver trocado.</div></div>') +

        (contatos.length > amostra.length
          ? '<p style="margin:14px 0 0;font-size:.79rem;color:var(--ink-fraco)">Mostrando os ' + amostra.length + ' primeiros para você conferir:</p>'
          : '<p style="margin:14px 0 0;font-size:.79rem;color:var(--ink-fraco)">Conferindo:</p>') +

        tabela +

        '<label class="campo-caixa" style="margin-top:14px">' +
          '<input type="checkbox" id="mPularRepetidos" checked> Não importar quem já está na minha base</label>' +

        '<p style="margin:10px 0 0;font-size:.79rem;color:var(--ink-fraco)">' +
          'Quem não tiver situação na planilha entra como Lead. Nada é apagado: a importação só acrescenta.</p>',

      botoes: [
        { texto:"Cancelar", aoClicar:function(fechar){ fechar(); } },
        { texto:"Importar", classe:"btn-lima", aoClicar:async function(fechar){
            var pular = document.getElementById("mPularRepetidos").checked;
            fechar();
            await importar(contatos, pular);
          }
        }
      ]
    });
  }

  async function importar(contatos, pularRepetidos){
    var aEnviar = pularRepetidos ? contatos.filter(function(c){ return !jaExiste(c); }) : contatos;
    var pulados = contatos.length - aEnviar.length;

    if (!aEnviar.length){
      A.recado("Todos os contatos do arquivo já estão na sua base");
      return;
    }

    A.recado("Importando " + aEnviar.length + "...");

    var gravados = 0, falharam = 0;
    for (var i = 0; i < aEnviar.length; i += 40){
      var lote = aEnviar.slice(i, i + 40).map(function(c){
        return {
          nome: c.nome || c.email || c.instagram,
          instagram: c.instagram,
          email: c.email,
          telefone: c.telefone,
          situacao: c.situacao,
          obs: c.obs,
          ultimo_contato: c.ultimo_contato
        };
      });
      var r = await window.Banco.consulta("marcas", function(cli){
        return cli.from("marcas").insert(lote);
      });
      if (r.erro) falharam += lote.length;
      else gravados += lote.length;
    }

    await recarregar();

    var recado = gravados + (gravados === 1 ? " contato importado" : " contatos importados");
    if (pulados)  recado += ", " + pulados + " já existia" + (pulados === 1 ? "" : "m");
    if (falharam) recado += ", " + falharam + " não entrou" + (falharam === 1 ? "" : "ram");
    A.recado(recado, falharam > 0);
  }

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

  /* ---------------- SELECIONAR PARA A PROSPECÇÃO ---------------- */

  function selecionadas(){
    return marcas.filter(function(m){ return m.selecionada; });
  }

  function temEmail(m){
    return !!String(m.email || "").trim();
  }

  async function escolher(id, valor){
    var m = marcas.filter(function(x){ return x.id === id; })[0];
    if (m) m.selecionada = valor;
    desenhar();

    var r = await window.Banco.consulta("marcas", function(c){
      return c.from("marcas").update({ selecionada: valor }).eq("id", id);
    });
    if (r.erro){
      if (m) m.selecionada = !valor;
      desenhar();
      A.recado(r.erro, true);
    }
  }

  async function escolherVarias(ids, valor){
    if (!ids.length) return;
    marcas.forEach(function(m){ if (ids.indexOf(m.id) !== -1) m.selecionada = valor; });
    desenhar();

    var r = await window.Banco.consulta("marcas", function(c){
      return c.from("marcas").update({ selecionada: valor }).in("id", ids);
    });
    if (r.erro){ A.recado(r.erro, true); await recarregar(); return; }
    A.recado(valor
      ? ids.length + (ids.length === 1 ? " marca selecionada" : " marcas selecionadas")
      : "Seleção limpa");
  }

  function montarBarraSelecao(lista){
    var escolhidas = selecionadas().length;
    var visiveisComEmail = lista.filter(temEmail);
    var faltamEscolher = visiveisComEmail.filter(function(m){ return !m.selecionada; }).length;

    return '<div class="barra-selecao' + (escolhidas ? " tem" : "") + '">' +
      '<span class="barra-selecao-num">' +
        (escolhidas
          ? escolhidas + (escolhidas === 1 ? " marca selecionada" : " marcas selecionadas")
          : "Nenhuma marca selecionada") +
      '</span>' +
      '<span class="barra-selecao-dica">para o disparo na aba Prospecção</span>' +
      '<span class="espaco"></span>' +
      (faltamEscolher
        ? '<button type="button" class="btn btn-pequeno" id="mSelecionarVisiveis">Selecionar as ' +
          visiveisComEmail.length + ' que estão aparecendo</button>'
        : '') +
      (escolhidas ? '<button type="button" class="btn btn-pequeno" id="mLimparSelecao">Limpar seleção</button>' : '') +
    '</div>';
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
        '<th style="width:34px"></th>' +
        '<th>Marca</th><th>Instagram</th><th>E-mail</th><th>Telefone</th>' +
        '<th>Situação</th><th>Observação</th><th>Último contato</th><th style="width:76px"></th>' +
      '</tr></thead><tbody>' +
      lista.map(function(m){
        var ig = arroba(m.instagram);
        var zap = linkZap(m.telefone);
        var temEmail = !!String(m.email || "").trim();
        return '<tr class="clicavel' + (m.selecionada ? " selecionada" : "") + '" data-abrir="' + A.escapar(m.id) + '">' +
          '<td><input type="checkbox" class="caixa-marca" data-escolher="' + A.escapar(m.id) + '"' +
            (m.selecionada ? " checked" : "") + (temEmail ? "" : " disabled") +
            ' title="' + (temEmail ? "Escolher para a prospecção" : "Esta marca não tem e-mail cadastrado") + '"' +
            ' aria-label="Escolher ' + A.escapar(m.nome || "marca") + ' para a prospecção"></td>' +
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
        '<button type="button" class="btn" id="mImportar">' + A.icone("subir") + ' Importar planilha</button>' +
        '<button type="button" class="btn" id="mBaixar">' + A.icone("baixar") + ' Baixar CSV</button>' +
        '<button type="button" class="btn btn-lima" id="mAdd">' + A.icone("mais") + ' Adicionar marca</button>' +
      '</div>' +

      montarBarraSelecao(lista) +
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
    document.getElementById("mImportar").addEventListener("click", escolherArquivo);

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

    /* A caixinha de seleção não pode abrir o formulário da linha. */
    area.querySelectorAll("[data-escolher]").forEach(function(caixa){
      caixa.addEventListener("click", function(e){ e.stopPropagation(); });
      caixa.addEventListener("change", function(e){
        e.stopPropagation();
        escolher(caixa.dataset.escolher, caixa.checked);
      });
    });

    var botaoVisiveis = document.getElementById("mSelecionarVisiveis");
    if (botaoVisiveis){
      botaoVisiveis.addEventListener("click", function(){
        escolherVarias(lista.filter(temEmail).map(function(m){ return m.id; }), true);
      });
    }
    var botaoLimpar = document.getElementById("mLimparSelecao");
    if (botaoLimpar){
      botaoLimpar.addEventListener("click", function(){
        escolherVarias(selecionadas().map(function(m){ return m.id; }), false);
      });
    }
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
