-- Phase 10A — document export queue for services/document-worker (service role only).

alter table public.document_exports add column attempts int not null default 0 check (attempts >= 0);
alter table public.document_exports add column locked_at timestamptz;

-- Atomically claim the oldest queued export (or a running one whose lock expired after a worker crash).
create or replace function public.claim_document_export(p_lock_seconds int default 120)
returns setof public.document_exports
language sql security definer set search_path = '' as $$
  update public.document_exports e set status = 'running', locked_at = now(), attempts = e.attempts + 1
  where e.id = (
    select id from public.document_exports
    where (status = 'queued' or (status = 'running' and locked_at < now() - make_interval(secs => p_lock_seconds)))
      and attempts < 3
    order by created_at
    for update skip locked
    limit 1
  )
  returning e.*;
$$;
revoke all on function public.claim_document_export(int) from public, anon, authenticated;
grant execute on function public.claim_document_export(int) to service_role;

-- Workers (service role) read profiles through the same function as the app.
grant execute on function public.get_master_profile(uuid) to service_role;

-- Monthly export count for quota checks (RLS: own rows only).
create index document_exports_user_month_idx on public.document_exports (user_id, created_at) where status in ('queued', 'running', 'succeeded');
