-- Interview Prep plan gate on ai_jobs (pgTAP).
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'free@test.local', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'pro@test.local', 'authenticated', 'authenticated'),
  ('33333333-3333-3333-3333-333333333333', 'lapsed@test.local', 'authenticated', 'authenticated');
insert into public.subscriptions (user_id, plan_id, status, billing_period, provider, provider_subscription_id, current_period_start, current_period_end) values
  ('22222222-2222-2222-2222-222222222222', 'PROFESSIONAL', 'active', 'monthly', 'manual', 'pro-1', now() - interval '1 day', now() + interval '29 days'),
  ('33333333-3333-3333-3333-333333333333', 'PROFESSIONAL', 'expired', 'monthly', 'manual', 'lapsed-1', now() - interval '40 days', now() - interval '10 days');

set local role authenticated;

set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select throws_ok($$insert into public.ai_jobs (user_id, kind, input, idempotency_key) values ('11111111-1111-1111-1111-111111111111', 'interview_prep', '{}', 'key-free-0001')$$,
  '42501', 'plan_required', 'Free user cannot queue interview_prep by inserting directly');
select lives_ok($$insert into public.ai_jobs (user_id, kind, input, idempotency_key) values ('11111111-1111-1111-1111-111111111111', 'summary', '{}', 'key-free-0002')$$,
  'Free user can still queue other AI kinds');

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select lives_ok($$insert into public.ai_jobs (user_id, kind, input, idempotency_key) values ('22222222-2222-2222-2222-222222222222', 'interview_prep', '{}', 'key-pro-0001')$$,
  'Professional subscriber can queue interview_prep');

set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
select throws_ok($$insert into public.ai_jobs (user_id, kind, input, idempotency_key) values ('33333333-3333-3333-3333-333333333333', 'interview_prep', '{}', 'key-lapsed-01')$$,
  '42501', 'plan_required', 'a lapsed Professional plan loses access');

reset role;
select is((select count(*)::int from public.ai_jobs where kind = 'interview_prep'), 1, 'only the Professional subscriber has an interview_prep job');
select has_trigger('public', 'ai_jobs', 'ai_jobs_plan_gate', 'plan-gate trigger exists');

select * from finish();
rollback;
