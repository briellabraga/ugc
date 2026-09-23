-- ============================================================
-- BANCO DE DADOS DO PAINEL DA GABRIELLA BRAGA
--
-- ONDE COLAR ESTE ARQUIVO:
-- 1. Entre em https://supabase.com e abra o seu projeto
-- 2. No menu da esquerda, clique em "SQL Editor"
-- 3. Clique em "New query"
-- 4. Copie TODO o conteudo deste arquivo e cole na caixa
-- 5. Clique em "Run" (ou aperte Ctrl + Enter)
-- 6. Deve aparecer "Success. No rows returned". E so isso.
--
-- Pode rodar este arquivo mais de uma vez sem medo. Ele foi escrito
-- para nao duplicar nada e nao apagar dados que ja existem.
-- ============================================================


-- ============================================================
-- BLOCO 1: AS TABELAS
-- Cada tabela e uma "planilha" dentro do banco.
-- ============================================================

-- Os videos do portfolio. E daqui que o seu site publico le o que mostrar.
create table if not exists public.videos (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null,
  link        text,
  nicho       text,
  formato     text,
  marca       text,
  destaque    text,                      -- o numero forte, exemplo: "2,4M views"
  ordem       integer not null default 0,-- menor numero aparece primeiro
  visivel     boolean not null default true,
  criado_em   timestamptz not null default now()
);

-- A sua base de contatos de empresa.
create table if not exists public.marcas (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null,
  instagram       text,
  email           text,
  telefone        text,
  situacao        text not null default 'Lead',
  obs             text,
  ultimo_contato  date,
  criado_em       timestamptz not null default now()
);

-- O seu calendario de gravacao, edicao e postagem.
create table if not exists public.calendario (
  id         uuid primary key default gen_random_uuid(),
  titulo     text not null,
  marca      text,
  tipo       text not null default 'gravar',
  data       date not null,
  status     text not null default 'a fazer',
  criado_em  timestamptz not null default now()
);

-- As suas campanhas, com valor, prazo e pagamento.
create table if not exists public.campanhas (
  id         uuid primary key default gen_random_uuid(),
  campanha   text not null,
  cliente    text,
  tipo       text not null default 'Conteúdo',
  status     text not null default 'Briefing',
  qtd        integer not null default 1,
  valor      numeric(12,2) not null default 0,
  prazo      date,
  pagamento  text not null default 'pendente',
  ativa      boolean not null default true,
  favorita   boolean not null default false,
  criado_em  timestamptz not null default now()
);

-- O que voce ja marcou no checklist. A "chave" identifica o item marcado.
create table if not exists public.marcados (
  chave          text primary key,
  marcado        boolean not null default true,
  atualizado_em  timestamptz not null default now()
);

-- As visitas do seu portfolio, para as metricas do painel.
create table if not exists public.visitas (
  id      uuid primary key default gen_random_uuid(),
  data    timestamptz not null default now(),
  pagina  text,
  origem  text
);

-- Os videos que voce gosta, com a transcricao e as suas anotacoes.
create table if not exists public.transcricoes (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null,
  link        text,
  plataforma  text,
  roteiro     text,
  obs         text,
  criado_em   timestamptz not null default now()
);


-- ============================================================
-- BLOCO 2: AS LISTAS DE OPCOES PERMITIDAS
-- Isso impede que entre no banco uma situacao ou um status
-- que o painel nao conhece.
-- ============================================================

do $$
begin
  -- situacao de marca: Lead, Conversando, Cliente ou Parada
  if not exists (select 1 from pg_constraint where conname = 'marcas_situacao_ok') then
    alter table public.marcas add constraint marcas_situacao_ok
      check (situacao in ('Lead','Conversando','Cliente','Parada'));
  end if;

  -- tipo de item do calendario: gravar, editar ou postar
  if not exists (select 1 from pg_constraint where conname = 'calendario_tipo_ok') then
    alter table public.calendario add constraint calendario_tipo_ok
      check (tipo in ('gravar','editar','postar'));
  end if;

  -- status do calendario: a fazer ou feito
  if not exists (select 1 from pg_constraint where conname = 'calendario_status_ok') then
    alter table public.calendario add constraint calendario_status_ok
      check (status in ('a fazer','feito'));
  end if;

  -- tipo de campanha: Conteúdo ou Publicidade
  if not exists (select 1 from pg_constraint where conname = 'campanhas_tipo_ok') then
    alter table public.campanhas add constraint campanhas_tipo_ok
      check (tipo in ('Conteúdo','Publicidade'));
  end if;

  -- status da campanha, na ordem do funil
  if not exists (select 1 from pg_constraint where conname = 'campanhas_status_ok') then
    alter table public.campanhas add constraint campanhas_status_ok
      check (status in ('Briefing','Roteiro','Aprovação Roteiro','Gravação','Edição','Aprovado','Entregue'));
  end if;

  -- pagamento: pendente ou pago
  if not exists (select 1 from pg_constraint where conname = 'campanhas_pagamento_ok') then
    alter table public.campanhas add constraint campanhas_pagamento_ok
      check (pagamento in ('pendente','pago'));
  end if;
end $$;

-- Deixa as buscas mais rapidas nas colunas que o painel mais usa.
create index if not exists videos_ordem_idx    on public.videos (ordem);
create index if not exists calendario_data_idx on public.calendario (data);
create index if not exists campanhas_prazo_idx on public.campanhas (prazo);
create index if not exists visitas_data_idx    on public.visitas (data);


-- ============================================================
-- BLOCO 3: QUEM E A DONA
-- Esta funcao responde "quem esta logado agora e a Gabriella?".
-- Se um dia voce trocar de e-mail, e a unica linha que muda.
-- ============================================================

create or replace function public.eh_dona()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'gabriellavazbraga@gmail.com';
$$;


-- ============================================================
-- BLOCO 4: A TRANCA (Row Level Security)
--
-- Ligar o RLS e como trancar a porta de cada tabela.
-- Depois de ligado, NINGUEM entra, a nao ser que exista uma
-- regra dizendo que pode. As regras vem no bloco 5.
-- ============================================================

alter table public.videos       enable row level security;
alter table public.marcas       enable row level security;
alter table public.calendario   enable row level security;
alter table public.campanhas    enable row level security;
alter table public.marcados     enable row level security;
alter table public.visitas      enable row level security;
alter table public.transcricoes enable row level security;

-- Forca a tranca a valer tambem para a dona do banco.
alter table public.videos       force row level security;
alter table public.marcas       force row level security;
alter table public.calendario   force row level security;
alter table public.campanhas    force row level security;
alter table public.marcados     force row level security;
alter table public.visitas      force row level security;
alter table public.transcricoes force row level security;


-- ============================================================
-- BLOCO 5: AS REGRAS DE QUEM PODE O QUE
--
-- Regra geral: so a Gabriella logada le e escreve tudo.
-- Excecoes, e somente estas tres:
--   1. Qualquer pessoa pode INSERIR em marcas (formulario do site)
--   2. Qualquer pessoa pode INSERIR em visitas (contador de visita)
--   3. Qualquer pessoa pode LER os videos marcados como visiveis
--      (sem isso o seu portfolio nao conseguiria mostrar video nenhum
--      para quem visita, porque quem visita nao esta logado. Os videos
--      escondidos pelo olhinho continuam invisiveis para o publico.)
-- ============================================================

-- ---------- videos ----------
drop policy if exists "dona faz tudo em videos" on public.videos;
create policy "dona faz tudo em videos" on public.videos
  for all to authenticated
  using (public.eh_dona())
  with check (public.eh_dona());

drop policy if exists "site le videos visiveis" on public.videos;
create policy "site le videos visiveis" on public.videos
  for select to anon, authenticated
  using (visivel = true);

-- ---------- marcas ----------
drop policy if exists "dona faz tudo em marcas" on public.marcas;
create policy "dona faz tudo em marcas" on public.marcas
  for all to authenticated
  using (public.eh_dona())
  with check (public.eh_dona());

-- Excecao 1: o formulario do site pode criar contato, e so como Lead.
drop policy if exists "formulario do site cria lead" on public.marcas;
create policy "formulario do site cria lead" on public.marcas
  for insert to anon, authenticated
  with check (situacao = 'Lead');

-- ---------- calendario ----------
drop policy if exists "dona faz tudo em calendario" on public.calendario;
create policy "dona faz tudo em calendario" on public.calendario
  for all to authenticated
  using (public.eh_dona())
  with check (public.eh_dona());

-- ---------- campanhas ----------
drop policy if exists "dona faz tudo em campanhas" on public.campanhas;
create policy "dona faz tudo em campanhas" on public.campanhas
  for all to authenticated
  using (public.eh_dona())
  with check (public.eh_dona());

-- ---------- marcados ----------
drop policy if exists "dona faz tudo em marcados" on public.marcados;
create policy "dona faz tudo em marcados" on public.marcados
  for all to authenticated
  using (public.eh_dona())
  with check (public.eh_dona());

-- ---------- visitas ----------
drop policy if exists "dona le visitas" on public.visitas;
create policy "dona le visitas" on public.visitas
  for all to authenticated
  using (public.eh_dona())
  with check (public.eh_dona());

-- Excecao 2: qualquer visitante pode registrar que passou pelo site.
drop policy if exists "site registra visita" on public.visitas;
create policy "site registra visita" on public.visitas
  for insert to anon, authenticated
  with check (true);

-- ---------- transcricoes ----------
-- Material de estudo seu. Ninguem deslogado encosta, nem para ler.
drop policy if exists "dona faz tudo em transcricoes" on public.transcricoes;
create policy "dona faz tudo em transcricoes" on public.transcricoes
  for all to authenticated
  using (public.eh_dona())
  with check (public.eh_dona());


-- ============================================================
-- BLOCO 6: PERMISSAO DE ACESSO AS TABELAS
-- O bloco 5 diz QUAIS LINHAS cada um enxerga.
-- Este bloco diz em QUAIS TABELAS cada um pode encostar.
-- O visitante deslogado so encosta em tres, e de forma limitada.
-- ============================================================

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on
  public.videos, public.marcas, public.calendario,
  public.campanhas, public.marcados, public.visitas,
  public.transcricoes
  to authenticated;

grant select on public.videos  to anon;   -- ler video visivel
grant insert on public.marcas  to anon;   -- receber lead do formulario
grant insert on public.visitas to anon;   -- registrar visita


-- ============================================================
-- BLOCO 7: UMA LINHA DE EXEMPLO EM CADA LISTA
--
-- Serve so para voce ver o formato. Pode apagar tudo pelo painel
-- depois que entender. Repare que o video de exemplo entra como
-- ESCONDIDO, para nao aparecer no seu site publico.
-- A tabela de visitas fica vazia de proposito: os numeros comecam
-- em zero porque voce ainda nao recebeu visita nenhuma.
-- ============================================================

insert into public.videos (titulo, link, nicho, formato, marca, destaque, ordem, visivel)
select 'Exemplo de vídeo, pode apagar', '#', 'Skincare', 'Reels 9:16', 'Marca exemplo', '0 views', 1, false
where not exists (select 1 from public.videos);

insert into public.marcas (nome, instagram, email, telefone, situacao, obs)
select 'Marca exemplo, pode apagar', '@marcaexemplo', 'contato@exemplo.com', '', 'Lead', 'Linha de exemplo só para você ver o formato.'
where not exists (select 1 from public.marcas);

insert into public.calendario (titulo, marca, tipo, data, status)
select 'Item de exemplo, pode apagar', 'Marca exemplo', 'gravar', current_date, 'a fazer'
where not exists (select 1 from public.calendario);

insert into public.campanhas (campanha, cliente, tipo, status, qtd, valor, prazo, pagamento, ativa, favorita)
select 'Campanha de exemplo, pode apagar', 'Marca exemplo', 'Conteúdo', 'Briefing', 1, 0, current_date + 7, 'pendente', true, false
where not exists (select 1 from public.campanhas);

insert into public.transcricoes (titulo, link, plataforma, roteiro, obs)
select 'Vídeo de exemplo, pode apagar', '', 'Outro',
       'Cole aqui a transcrição do vídeo. O botão do TokScript, dentro do formulário, abre a página certa conforme a rede do link.',
       'Use este espaço para anotar o que você quer aproveitar desse vídeo.'
where not exists (select 1 from public.transcricoes);


-- ============================================================
-- PRONTO.
--
-- COMO TESTAR SE A TRANCA FUNCIONOU (passo a passo no final do
-- meu resumo, mas o resumo rapido e este):
--
-- Teste 1, deslogada: abra uma aba anonima do navegador e entre em
--   https://igvruyzpmewevfabxcsa.supabase.co/rest/v1/marcas?select=*&apikey=SUA_CHAVE_PUBLICA
--   Tem que voltar uma lista vazia [] ou um erro de permissao.
--   Se voltar os seus contatos, a tranca NAO esta funcionando.
--
-- Teste 2, deslogada: troque "marcas" por "videos" no endereco acima.
--   Tem que voltar so os videos com visivel = true.
--
-- Teste 3, logada: entre no seu painel e veja tudo normalmente.
-- ============================================================
