-- ============================================================
-- FAVORITAS
--
-- Isto adiciona UMA coluna na tabela de marcas que voce ja tem.
-- Nao apaga nada, nao recria tabela nenhuma, nao mexe no RLS.
-- Se voce rodar duas vezes por engano, nao faz mal: o
-- "if not exists" cuida disso.
--
-- ONDE COLAR:
-- 1. No Supabase, menu da esquerda, SQL Editor
-- 2. New query
-- 3. Cole tudo isto e clique em Run
--
-- O esperado no fim e: Success. No rows returned
-- ============================================================

-- A coluna. Comeca falsa para todas as marcas que ja existem,
-- ou seja, ninguem vira favorita sozinha.
alter table public.marcas
  add column if not exists favorita boolean not null default false;

-- Um indice, para a lista continuar rapida quando a sua base
-- crescer. Sem ele o banco teria que olhar marca por marca para
-- saber quais sao as favoritas.
create index if not exists marcas_favorita_idx
  on public.marcas (favorita);

-- Conferencia: deve aparecer uma linha, com favorita, boolean e false.
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'marcas'
  and column_name = 'favorita';
