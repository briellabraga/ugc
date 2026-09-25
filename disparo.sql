-- ============================================================
-- PROSPECCAO POR E-MAIL
--
-- ONDE COLAR:
-- 1. Entre em https://supabase.com e abra o seu projeto
-- 2. No menu da esquerda, clique em "SQL Editor"
-- 3. Clique em "New query"
-- 4. Copie TODO este arquivo e cole na caixa
-- 5. Clique em "Run"
-- 6. Vai aparecer o aviso de operacao destrutiva. Ele aparece por
--    causa das palavras "drop policy" e "alter". Nao existe aqui
--    nenhum "drop table", nenhum "delete from" e nenhum "truncate",
--    entao nada seu e apagado. Pode confirmar.
-- 7. Deve terminar com "Success. No rows returned".
--
-- Pode rodar mais de uma vez sem medo.
-- ============================================================


-- ============================================================
-- BLOCO 1: TRES COLUNAS NOVAS NA SUA TABELA DE MARCAS
-- Nenhuma coluna existente e mexida. So entram estas.
-- ============================================================

-- Guarda quais marcas voce marcou a dedo para o proximo disparo.
-- Fica salva no banco, entao voce marca hoje e dispara amanha.
alter table public.marcas add column if not exists selecionada boolean not null default false;

-- Guarda a data do ultimo e-mail de prospeccao que saiu para ela.
alter table public.marcas add column if not exists enviado_em date;

-- Guarda o assunto do ultimo e-mail, para voce lembrar o que mandou.
alter table public.marcas add column if not exists ultimo_assunto text;


-- ============================================================
-- BLOCO 2: AS TABELAS NOVAS
-- ============================================================

-- Uma linha por destinatario, a cada disparo. E o seu comprovante:
-- se um envio morrer no meio, e aqui que voce descobre quem ja
-- recebeu e quem ficou faltando.
create table if not exists public.email_envios (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  assunto    text,
  status     text not null default 'ok',   -- ok ou erro
  erro       text,
  resend_id  text,                          -- o numero que o Resend devolve
  data       timestamptz not null default now()
);

-- Quem respondeu SAIR. Quem esta aqui nunca mais recebe, hoje e
-- em todos os disparos seguintes.
create table if not exists public.email_optout (
  email  text primary key,
  data   timestamptz not null default now()
);

-- Os seus tres modelos de e-mail guardados.
create table if not exists public.email_modelos (
  slot          smallint primary key,
  nome          text,
  assunto       text,
  modo          text not null default 'texto',  -- texto ou html
  corpo         text,
  botao_texto   text,
  botao_link    text,
  atualizado_em timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'email_modelos_slot_ok') then
    alter table public.email_modelos add constraint email_modelos_slot_ok
      check (slot between 1 and 3);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'email_envios_status_ok') then
    alter table public.email_envios add constraint email_envios_status_ok
      check (status in ('ok','erro'));
  end if;
end $$;

-- Deixa a busca do historico e a checagem de repetido mais rapidas.
create index if not exists email_envios_data_idx    on public.email_envios (data desc);
create index if not exists email_envios_email_idx   on public.email_envios (email);
create index if not exists email_envios_assunto_idx on public.email_envios (assunto);
create index if not exists marcas_selecionada_idx   on public.marcas (selecionada) where selecionada;


-- ============================================================
-- BLOCO 3: A TRANCA
-- As tres tabelas sao suas e de mais ninguem. Nenhuma excecao:
-- quem nao esta logada como voce nao le e nao escreve nada.
-- ============================================================

alter table public.email_envios  enable row level security;
alter table public.email_optout  enable row level security;
alter table public.email_modelos enable row level security;

alter table public.email_envios  force row level security;
alter table public.email_optout  force row level security;
alter table public.email_modelos force row level security;

drop policy if exists "dona faz tudo em email_envios" on public.email_envios;
create policy "dona faz tudo em email_envios" on public.email_envios
  for all to authenticated
  using (public.eh_dona())
  with check (public.eh_dona());

drop policy if exists "dona faz tudo em email_optout" on public.email_optout;
create policy "dona faz tudo em email_optout" on public.email_optout
  for all to authenticated
  using (public.eh_dona())
  with check (public.eh_dona());

drop policy if exists "dona faz tudo em email_modelos" on public.email_modelos;
create policy "dona faz tudo em email_modelos" on public.email_modelos
  for all to authenticated
  using (public.eh_dona())
  with check (public.eh_dona());


-- ============================================================
-- BLOCO 4: PERMISSAO DE ACESSO
-- Nada para o visitante deslogado. Só para voce logada.
-- ============================================================

grant select, insert, update, delete on
  public.email_envios, public.email_optout, public.email_modelos
  to authenticated;


-- ============================================================
-- PRONTO.
--
-- COMO CONFERIR QUE A TRANCA VALEU:
-- Abra uma aba anonima e entre neste endereco, trocando SUA_CHAVE
-- pela chave publica que esta no arquivo js/banco.js:
--
-- https://igvruyzpmewevfabxcsa.supabase.co/rest/v1/email_envios?select=*&apikey=SUA_CHAVE
--
-- Tem que voltar lista vazia [] ou erro de permissao. Se voltar os
-- seus envios, me avise na hora.
-- ============================================================
