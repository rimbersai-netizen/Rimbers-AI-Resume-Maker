-- Interview Prep is a Professional-and-above feature. The API and the AI worker already check the plan; this makes the database
-- refuse the job too, so a signed-in client cannot bypass the API by inserting into ai_jobs directly.
-- Rules mirror packages/subscriptions (effectivePlan): active/trialing until period end, canceled keeps access until period end,
-- past_due has a 3-day grace period. service_role (the worker/backend) is not restricted here — it has its own check.

create or replace function public.enforce_ai_job_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'interview_prep' and coalesce(auth.role(), '') = 'authenticated' then
    if not exists (
      select 1 from public.subscriptions s
      where s.user_id = new.user_id
        and s.plan_id in ('PROFESSIONAL', 'PREMIUM')
        and (
          (s.status in ('active', 'trialing') and (s.current_period_end is null or s.current_period_end > now()))
          or (s.status = 'canceled' and s.current_period_end > now())
          or (s.status = 'past_due' and s.current_period_end + interval '3 days' > now())
        )
    ) then
      raise exception 'plan_required' using errcode = '42501', hint = 'Interview Prep is part of the Professional plan.';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_ai_job_plan() from public, anon, authenticated;

drop trigger if exists ai_jobs_plan_gate on public.ai_jobs;
create trigger ai_jobs_plan_gate before insert on public.ai_jobs
  for each row execute function public.enforce_ai_job_plan();
