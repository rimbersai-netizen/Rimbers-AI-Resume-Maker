-- Phase 12A — cover letters + exports (pgTAP).
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);
insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.local', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.local', 'authenticated', 'authenticated');
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select lives_ok($$insert into public.cover_letters (id, user_id, title, body, job_title, company, page_size)
  values ('c0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Site Engineer', 'Dear Hiring Manager,', 'Site Engineer', 'Red Sea', 'A4')$$, 'owner creates a letter');
select lives_ok($$insert into public.document_exports (user_id, cover_letter_id, format) values ('11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-000000000001', 'pdf')$$, 'owner queues a letter export');
select throws_ok($$insert into public.document_exports (user_id, format) values ('11111111-1111-1111-1111-111111111111', 'pdf')$$, '23514', null, 'export needs a resume or a letter');
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select is((select count(*)::int from public.cover_letters), 0, 'other user cannot read the letter');
select throws_ok($$insert into public.document_exports (user_id, cover_letter_id, format) values ('22222222-2222-2222-2222-222222222222', 'c0000000-0000-0000-0000-000000000001', 'pdf')$$, '23503', null, 'cannot export another user''s letter (composite FK)');
select throws_ok($$insert into public.cover_letters (user_id, title, body) values ('11111111-1111-1111-1111-111111111111', 'x', 'y')$$, '42501', null, 'cannot create letters as another user');
select * from finish();
rollback;
