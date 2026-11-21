-- Phase 4C/5C — resume layout save (pgTAP).
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.local', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.local', 'authenticated', 'authenticated');
insert into public.resume_documents (id, user_id, title, country_code, locale, template_id, page_size) values
  ('aaaaaaaa-0000-0000-0000-0000000000d1', '11111111-1111-1111-1111-111111111111', 'CV', 'US', 'en', 'ats-minimal-01', 'Letter');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select lives_ok($$select public.save_resume_layout('aaaaaaaa-0000-0000-0000-0000000000d1',
  '{"countryCode":"SA","locale":"ar","templateId":"modern-01","pageSize":"A4","includePhoto":true,
    "settings":{"hiddenItemIds":["x"],"overridden":["locale"]},
    "sections":[{"key":"summary"},{"key":"experience"},{"key":"skills","visible":false},{"key":"custom","heading":"Memberships"}]}')$$,
  'layout saves');
select is((select country_code || '|' || locale || '|' || page_size || '|' || include_photo::text from public.resume_documents), 'SA|ar|A4|true', 'document fields updated');
select is((select settings -> 'hiddenItemIds' ->> 0 from public.resume_documents), 'x', 'settings stored');
select is((select string_agg(section_key || ':' || is_visible::text, ',' order by sort_order) from public.resume_sections), 'summary:true,experience:true,skills:false,custom:true', 'sections in order with visibility');

select throws_ok($$select public.save_resume_layout('aaaaaaaa-0000-0000-0000-0000000000d1', '{"templateId":"no-such-template"}')$$, '23503', null, 'unknown template rejected (FK)');
select throws_ok($$select public.save_resume_layout('aaaaaaaa-0000-0000-0000-0000000000d1', '{"pageSize":"A3"}')$$, '23514', null, 'invalid page size rejected');
select throws_ok($$select public.save_resume_layout('aaaaaaaa-0000-0000-0000-0000000000d1', '{"title":"x"}', '2000-01-01T00:00:00Z')$$, '40001', 'conflict', 'stale updatedAt → conflict');
select lives_ok($$select public.save_resume_layout('aaaaaaaa-0000-0000-0000-0000000000d1', '{"sections":[{"key":"summary"},{"key":"custom"}]}')$$, 'custom placeholder section needs no heading');

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select throws_ok($$select public.save_resume_layout('aaaaaaaa-0000-0000-0000-0000000000d1', '{"title":"hacked"}')$$, 'P0002', 'resume not found', 'other user cannot modify');

select * from finish();
rollback;
