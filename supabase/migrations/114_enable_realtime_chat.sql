-- Migration to enable Realtime for CRM Chat tables
-- Ensures that frontend can listen to changes without needing to refresh

BEGIN;

-- Try to add tables to the existing supabase_realtime publication
-- The publication 'supabase_realtime' is created by default by Supabase
do $$
begin
  -- Add crm_atendimentos
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'crm_atendimentos'
  ) then
    execute 'ALTER PUBLICATION supabase_realtime ADD TABLE crm_atendimentos;';
  end if;

  -- Add crm_mensagens
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'crm_mensagens'
  ) then
    execute 'ALTER PUBLICATION supabase_realtime ADD TABLE crm_mensagens;';
  end if;
end;
$$;

COMMIT;
