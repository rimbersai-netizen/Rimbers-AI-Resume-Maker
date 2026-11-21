-- Phase 7B — AI job queue for services/ai-worker (service role only).

-- Atomically claim the oldest queued job (or a running one whose lock expired after a worker crash).
create or replace function public.claim_ai_job(p_lock_seconds int default 300)
returns setof public.ai_jobs
language sql security definer set search_path = '' as $$
  update public.ai_jobs j set status = 'running', locked_at = now(), attempts = j.attempts + 1
  where j.id = (
    select id from public.ai_jobs
    where (status = 'queued' or (status = 'running' and locked_at < now() - make_interval(secs => p_lock_seconds)))
      and attempts < max_attempts
    order by created_at
    for update skip locked
    limit 1
  )
  returning j.*;
$$;
revoke all on function public.claim_ai_job(int) from public, anon, authenticated;
grant execute on function public.claim_ai_job(int) to service_role;

-- Monthly AI request counting for quota checks (RLS: own rows only).
create index ai_jobs_user_month_idx on public.ai_jobs (user_id, created_at) where status in ('queued', 'running', 'succeeded');

-- Users may cancel their own queued jobs (e.g. closing the assistant).
create policy ai_jobs_owner_cancel on public.ai_jobs for update to authenticated
  using (user_id = (select auth.uid()) and status = 'queued')
  with check (user_id = (select auth.uid()) and status = 'cancelled' and output is null);
