-- Phase 3 — master profile save/load tests (pgTAP).
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.local', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.local', 'authenticated', 'authenticated');
insert into public.master_profiles (id, user_id, is_primary) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', true),
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', true);

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

create temp table doc as select $j${
  "schemaVersion": 1,
  "summary": "Engineer.",
  "personal": {"fullName": "Ayesha Khan", "email": "ayesha@example.com", "location": {"city": "Riyadh", "country": "SA"}, "linkedin": "https://linkedin.com/in/a"},
  "experience": [
    {"id": "e0000000-0000-0000-0000-000000000001", "employer": "Tech Solutions", "title": "Senior Engineer", "employmentType": "full_time",
     "dates": {"start": "2021-01", "current": true}, "bullets": [{"id": "b1", "text": "Led a team of 4", "provenance": "user"}]},
    {"id": "e0000000-0000-0000-0000-000000000002", "employer": "Startup", "title": "Engineer", "dates": {"start": "2018-06", "end": "2020-12", "current": false}, "bullets": []}
  ],
  "education": [{"id": "d0000000-0000-0000-0000-000000000001", "institution": "KSU", "qualification": "B.Sc.", "dates": {"start": "2014", "end": "2018", "current": false}}],
  "skills": [{"id": "50000000-0000-0000-0000-000000000001", "name": "React"}, {"id": "50000000-0000-0000-0000-000000000002", "name": "SQL"}],
  "certifications": [], "languages": [{"id": "70000000-0000-0000-0000-000000000001", "language": "Arabic", "proficiency": "native"}],
  "projects": [], "publications": [], "awards": [{"id": "x1", "title": "Employee of the Year"}], "volunteer": [], "references": [], "customSections": []
}$j$::jsonb as j;
grant select on doc to authenticated;

select lives_ok($$select public.save_master_profile('aaaaaaaa-0000-0000-0000-000000000001', (select j from doc), null, 'First')$$, 'save succeeds');

select is((select public.get_master_profile('aaaaaaaa-0000-0000-0000-000000000001') -> 'profile' -> 'personal' ->> 'fullName'), 'Ayesha Khan', 'personal round-trips');
select is((select jsonb_array_length(public.get_master_profile('aaaaaaaa-0000-0000-0000-000000000001') -> 'profile' -> 'experience')), 2, 'experience count');
select is((select public.get_master_profile('aaaaaaaa-0000-0000-0000-000000000001') -> 'profile' -> 'experience' -> 0 ->> 'employer'), 'Tech Solutions', 'order preserved');
select is((select public.get_master_profile('aaaaaaaa-0000-0000-0000-000000000001') -> 'profile' -> 'experience' -> 0 -> 'bullets' -> 0 ->> 'provenance'), 'user', 'bullet provenance kept');
select is((select public.get_master_profile('aaaaaaaa-0000-0000-0000-000000000001') -> 'profile' -> 'awards' -> 0 ->> 'title'), 'Employee of the Year', 'extras round-trip');
select is((select count(*)::int from public.master_profile_versions), 1, 'snapshot version created');

-- update: remove 2nd role, reorder skills, rename a skill to a name previously used (no unique clash)
select lives_ok($$select public.save_master_profile('aaaaaaaa-0000-0000-0000-000000000001',
  jsonb_set(jsonb_set((select j from doc), '{experience}', jsonb_build_array((select j -> 'experience' -> 0 from doc))),
  '{skills}', '[{"id":"50000000-0000-0000-0000-000000000002","name":"React"},{"id":"50000000-0000-0000-0000-000000000003","name":"SQL"}]'::jsonb))$$,
  'update with removal + skill swap succeeds');
select is((select count(*)::int from public.work_experiences where master_profile_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 1, 'removed role deleted');
select is((select string_agg(name, ',' order by sort_order) from public.skills where master_profile_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'React,SQL', 'skills replaced in order');

-- optimistic concurrency
select throws_ok($$select public.save_master_profile('aaaaaaaa-0000-0000-0000-000000000001', (select j from doc), '2000-01-01T00:00:00Z')$$,
  '40001', 'conflict', 'stale updatedAt → conflict');

-- atomicity: invalid row (current role with end date) rolls back the whole save
select throws_ok($$select public.save_master_profile('aaaaaaaa-0000-0000-0000-000000000001',
  jsonb_set((select j from doc), '{personal,fullName}', '"Changed Name"') ||
  '{"experience":[{"id":"e0000000-0000-0000-0000-000000000009","employer":"X","title":"Y","dates":{"start":"2020","end":"2021","current":true}}]}'::jsonb)$$,
  '23514', null, 'constraint violation aborts save');
select is((select full_name from public.personal_details where master_profile_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'Ayesha Khan', 'failed save left no partial changes');

-- cross-user
select throws_ok($$select public.save_master_profile('bbbbbbbb-0000-0000-0000-000000000001', (select j from doc))$$, 'P0002', 'profile not found', 'cannot save into another user''s profile');
select is((select public.get_master_profile('bbbbbbbb-0000-0000-0000-000000000001')), null, 'cannot load another user''s profile');

-- hijack: reuse A's experience id while B
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select throws_ok($$select public.save_master_profile('bbbbbbbb-0000-0000-0000-000000000001',
  '{"personal":{"fullName":"B"},"experience":[{"id":"e0000000-0000-0000-0000-000000000001","employer":"Evil","title":"T","dates":{}}]}'::jsonb)$$,
  null, null, 'reusing another user''s row id fails');

select * from finish();
rollback;
