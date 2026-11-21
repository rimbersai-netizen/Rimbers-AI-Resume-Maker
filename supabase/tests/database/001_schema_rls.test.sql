-- Phase 2A/2C database tests (pgTAP). Run: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(54);

-- ---------------------------------------------------------------- structure
select has_table('public', t, 'table ' || t || ' exists') from unnest(array[
  'profiles','master_profiles','personal_details','work_experiences','education_records','skills',
  'certifications','languages','projects','resume_documents','resume_versions','resume_sections',
  'resume_templates','template_versions','country_rules','country_rule_sources','uploaded_documents',
  'import_jobs','ai_jobs','ai_usage','ats_results','job_descriptions','cover_letters','document_exports',
  'subscription_plans','subscriptions','payments','entitlements','usage_quotas','coupons','admin_roles',
  'audit_logs','support_requests','deletion_requests']) as t;  -- 34 tests

select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0, 'RLS enabled on every public table');

-- ---------------------------------------------------------------- fixtures (two users)
insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.local', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.local', 'authenticated', 'authenticated');

select is((select count(*)::int from public.profiles where id in
  ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222')), 2,
  'profile rows auto-created for new auth users');

insert into public.master_profiles (id, user_id, is_primary) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', true),
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', true);
insert into public.resume_documents (id, user_id, title, country_code, locale, template_id, page_size) values
  ('aaaaaaaa-0000-0000-0000-0000000000d1', '11111111-1111-1111-1111-111111111111', 'A CV', 'SA', 'ar', 'ats-minimal-01', 'A4');

-- ---------------------------------------------------------------- constraints
select throws_ok($$insert into public.work_experiences (master_profile_id, user_id, employer, title, start_date, end_date, is_current)
  values ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Acme','Eng','2020','2021',true)$$,
  '23514', null, 'current role cannot have end date');

-- ---------------------------------------------------------------- user A session
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select is((select count(*)::int from public.master_profiles), 1, 'A sees only own master profile');
select is((select count(*)::int from public.resume_templates), 2, 'authenticated sees only published templates');

select throws_ok($$insert into public.work_experiences (master_profile_id, user_id, employer, title)
  values ('bbbbbbbb-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','X','Y')$$,
  '42501', null, 'A cannot insert rows as B');

select throws_ok($$insert into public.work_experiences (master_profile_id, user_id, employer, title)
  values ('bbbbbbbb-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','X','Y')$$,
  '23503', null, 'A cannot attach rows to B''s master profile (composite FK)');

select throws_ok($$insert into public.ai_jobs (user_id, kind, status, input, idempotency_key)
  values ('11111111-1111-1111-1111-111111111111','summary','succeeded','{}','key-00000001')$$,
  '42501', null, 'client cannot create a pre-completed AI job');

select lives_ok($$insert into public.ai_jobs (user_id, kind, input, idempotency_key)
  values ('11111111-1111-1111-1111-111111111111','summary','{}','key-00000002')$$,
  'client can enqueue an AI job');

-- ---------------------------------------------------------------- user B session
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select is((select count(*)::int from public.resume_documents), 0, 'B cannot see A''s resume');

-- B's update/delete against A's resume affect zero rows
update public.resume_documents set title = 'hacked' where id = 'aaaaaaaa-0000-0000-0000-0000000000d1';
delete from public.resume_documents where id = 'aaaaaaaa-0000-0000-0000-0000000000d1';
reset role;
select is((select title from public.resume_documents where id = 'aaaaaaaa-0000-0000-0000-0000000000d1'), 'A CV',
  'B cannot modify or delete A''s resume');

-- audit log: write via helper as user A, then prove it is immutable
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select lives_ok($$select public.write_audit_log('test.action','resume','r1','{}')$$, 'user can append audit entry via helper');
select is((select count(*)::int from public.audit_logs), 0, 'non-admin cannot read audit logs');
reset role;
select is((select actor_id from public.audit_logs where action = 'test.action'), '11111111-1111-1111-1111-111111111111'::uuid,
  'audit entry records the real actor');
select throws_ok($$update public.audit_logs set action = 'x'$$, 'P0001', 'audit_logs is append-only', 'audit_logs rows cannot be updated');
select throws_ok($$delete from public.audit_logs$$, 'P0001', 'audit_logs is append-only', 'audit_logs rows cannot be deleted');
select throws_ok($$truncate public.audit_logs$$, 'P0001', 'audit_logs is append-only', 'audit_logs cannot be truncated');

-- anon sees only published catalog, no user data
set local role anon;
select is((select count(*)::int from public.resume_templates), 2, 'anon sees only published templates');
select is((select count(*)::int from public.subscription_plans), 4, 'anon sees active plans');
select is((select count(*)::int from public.profiles), 0, 'anon sees no profiles');
reset role;

select * from finish();
rollback;
