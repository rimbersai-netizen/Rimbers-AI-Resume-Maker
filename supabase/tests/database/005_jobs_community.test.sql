-- Phase 15 — job pipeline + community RLS (pgTAP).
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);
insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.local', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.local', 'authenticated', 'authenticated');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select lives_ok($$insert into public.job_preferences (user_id, roles, work_modes, min_salary, posted_within_days)
  values ('11111111-1111-1111-1111-111111111111', '{engineer}', '{remote}', 100000, 1)$$, 'owner saves preferences');
select throws_ok($$update public.job_preferences set work_modes = '{moon}' where user_id = '11111111-1111-1111-1111-111111111111'$$, '23514', null, 'invalid work mode rejected');
select lives_ok($$insert into public.job_pipeline (user_id, source, external_id, state, title, company, url, match_score)
  values ('11111111-1111-1111-1111-111111111111', 'remotive', '42', 'saved', 'Engineer', 'Acme', 'https://example.com/j/42', 88)$$, 'owner saves a job');
select throws_ok($$insert into public.job_pipeline (user_id, source, external_id, state, title, company, url)
  values ('11111111-1111-1111-1111-111111111111', 'remotive', '43', 'saved', 'Engineer', 'Acme', 'javascript:alert(1)')$$, '23514', null, 'only http(s) job links are accepted');
select throws_ok($$insert into public.job_pipeline (user_id, source, external_id, state, title, company)
  values ('11111111-1111-1111-1111-111111111111', 'remotive', '42', 'applied', 'Engineer', 'Acme')$$, '23505', null, 'one pipeline row per job');

select is((select public.ensure_community_handle()) ~ '^[a-z]+_[a-z]+_[0-9]{2,4}$', true, 'server generates an anonymous handle');
select is((select public.ensure_community_handle()), (select handle from public.community_handles), 'handle is stable');
select lives_ok($$insert into public.community_posts (user_id, handle, kind, title, body)
  values ('11111111-1111-1111-1111-111111111111', (select handle from public.community_handles), 'win', 'Got an interview', 'Tailoring helped a lot.')$$, 'member posts under own handle');
select throws_ok($$insert into public.community_posts (user_id, handle, kind, title, body)
  values ('11111111-1111-1111-1111-111111111111', 'admin_staff_01', 'win', 'Fake staff post', 'impersonation attempt')$$, '42501', null, 'cannot post under another handle');

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select is((select count(*)::int from public.job_pipeline), 0, 'other user cannot see the pipeline');
select is((select count(*)::int from public.job_preferences), 0, 'other user cannot see preferences');
select is((select count(*)::int from public.community_posts), 1, 'any member can read the community feed');
select throws_ok($$insert into public.community_reactions (post_id, user_id)
  values ((select id from public.community_posts limit 1), '11111111-1111-1111-1111-111111111111')$$, '42501', null, 'cannot react as someone else');

select * from finish();
rollback;
