-- Phase 3 — Master profile load/save (atomic), extra sections, and profile versioning.
-- Functions are SECURITY INVOKER: every statement runs under the caller's RLS policies.

alter table public.master_profiles
  add column extras jsonb not null default '{}'::jsonb check (jsonb_typeof(extras) = 'object');
comment on column public.master_profiles.extras is
  'publications, awards, volunteer, references, customSections (arrays of @gars/resume-schema GenericEntry/CustomSection)';

create table public.master_profile_versions (
  id uuid primary key default gen_random_uuid(),
  master_profile_id uuid not null,
  user_id uuid not null,
  version_no int not null check (version_no > 0),
  snapshot jsonb not null,
  label text check (char_length(label) <= 120),
  created_at timestamptz not null default now(),
  unique (master_profile_id, version_no),
  foreign key (master_profile_id, user_id) references public.master_profiles (id, user_id) on delete cascade
);
create index master_profile_versions_profile_idx on public.master_profile_versions (master_profile_id, version_no desc);
alter table public.master_profile_versions enable row level security;
alter table public.master_profile_versions force row level security;
create policy master_profile_versions_owner_select on public.master_profile_versions for select to authenticated using (user_id = (select auth.uid()));
create policy master_profile_versions_owner_insert on public.master_profile_versions for insert to authenticated with check (user_id = (select auth.uid()));
create policy master_profile_versions_owner_delete on public.master_profile_versions for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- load
create or replace function public.get_master_profile(p_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'meta', jsonb_build_object('id', mp.id, 'updatedAt', mp.updated_at, 'name', mp.name),
    'profile', jsonb_strip_nulls(jsonb_build_object(
      'schemaVersion', 1,
      'summary', mp.summary,
      'personal', coalesce((select jsonb_strip_nulls(jsonb_build_object(
          'fullName', pd.full_name, 'professionalTitle', pd.professional_title, 'email', pd.email, 'phone', pd.phone,
          'location', jsonb_strip_nulls(jsonb_build_object('city', pd.city, 'region', pd.region, 'country', pd.country_code)),
          'linkedin', pd.linkedin_url, 'website', pd.website_url, 'portfolio', pd.portfolio_url,
          'photoPath', pd.photo_path, 'workAuthorization', pd.work_authorization))
        from public.personal_details pd where pd.master_profile_id = mp.id), jsonb_build_object('fullName', '')),
      'experience', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
          'id', w.id, 'employer', w.employer, 'title', w.title, 'employmentType', w.employment_type, 'location', w.location,
          'dates', jsonb_strip_nulls(jsonb_build_object('start', w.start_date, 'end', w.end_date, 'current', w.is_current)),
          'description', w.description, 'bullets', w.bullets)) order by w.sort_order)
        from public.work_experiences w where w.master_profile_id = mp.id), '[]'::jsonb),
      'education', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
          'id', e.id, 'institution', e.institution, 'qualification', e.qualification, 'field', e.field,
          'dates', jsonb_strip_nulls(jsonb_build_object('start', e.start_date, 'end', e.end_date, 'current', false)),
          'grade', e.grade, 'notes', e.notes)) order by e.sort_order)
        from public.education_records e where e.master_profile_id = mp.id), '[]'::jsonb),
      'skills', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', s.id, 'name', s.name, 'category', s.category, 'level', s.level)) order by s.sort_order)
        from public.skills s where s.master_profile_id = mp.id), '[]'::jsonb),
      'certifications', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', c.id, 'name', c.name, 'issuer', c.issuer,
          'issued', c.issued_on, 'expires', c.expires_on, 'credentialUrl', c.credential_url)) order by c.sort_order)
        from public.certifications c where c.master_profile_id = mp.id), '[]'::jsonb),
      'languages', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', l.id, 'language', l.language, 'proficiency', l.proficiency)) order by l.sort_order)
        from public.languages l where l.master_profile_id = mp.id), '[]'::jsonb),
      'projects', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', p.id, 'name', p.name, 'role', p.role,
          'dates', case when p.start_date is null and p.end_date is null then null
                        else jsonb_strip_nulls(jsonb_build_object('start', p.start_date, 'end', p.end_date, 'current', false)) end,
          'description', p.description, 'url', p.url)) order by p.sort_order)
        from public.projects p where p.master_profile_id = mp.id), '[]'::jsonb),
      'publications', coalesce(mp.extras -> 'publications', '[]'::jsonb),
      'awards', coalesce(mp.extras -> 'awards', '[]'::jsonb),
      'volunteer', coalesce(mp.extras -> 'volunteer', '[]'::jsonb),
      'references', coalesce(mp.extras -> 'references', '[]'::jsonb),
      'customSections', coalesce(mp.extras -> 'customSections', '[]'::jsonb)
    ))
  )
  from public.master_profiles mp
  where mp.id = p_id;  -- RLS hides other users' profiles → NULL
$$;

-- ---------------------------------------------------------------- save (atomic, optimistic concurrency)
-- p_data: a MasterProfile validated server-side with @gars/resume-schema; DB-backed item ids must be uuids.
-- p_expected_updated_at: the updatedAt the client last loaded; mismatch → 'conflict' (another tab/device saved).
create or replace function public.save_master_profile(
  p_id uuid, p_data jsonb, p_expected_updated_at timestamptz default null, p_snapshot_label text default null
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_current timestamptz;
  v_updated timestamptz;
  v_version int;
  pd jsonb := p_data -> 'personal';
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;

  select updated_at into v_current from public.master_profiles where id = p_id and user_id = v_uid for update;
  if not found then raise exception 'profile not found' using errcode = 'P0002'; end if;
  if p_expected_updated_at is not null and v_current <> p_expected_updated_at then
    raise exception 'conflict' using errcode = '40001', detail = v_current::text;
  end if;

  update public.master_profiles set
    summary = nullif(p_data ->> 'summary', ''),
    extras = jsonb_build_object(
      'publications', coalesce(p_data -> 'publications', '[]'), 'awards', coalesce(p_data -> 'awards', '[]'),
      'volunteer', coalesce(p_data -> 'volunteer', '[]'), 'references', coalesce(p_data -> 'references', '[]'),
      'customSections', coalesce(p_data -> 'customSections', '[]'))
  where id = p_id
  returning updated_at into v_updated;

  insert into public.personal_details as t (master_profile_id, user_id, full_name, professional_title, email, phone, city, region,
    country_code, linkedin_url, website_url, portfolio_url, photo_path, work_authorization)
  values (p_id, v_uid, pd ->> 'fullName', pd ->> 'professionalTitle', pd ->> 'email', pd ->> 'phone', pd -> 'location' ->> 'city',
    pd -> 'location' ->> 'region', pd -> 'location' ->> 'country', pd ->> 'linkedin', pd ->> 'website', pd ->> 'portfolio',
    pd ->> 'photoPath', pd ->> 'workAuthorization')
  on conflict (master_profile_id) do update set
    full_name = excluded.full_name, professional_title = excluded.professional_title, email = excluded.email, phone = excluded.phone,
    city = excluded.city, region = excluded.region, country_code = excluded.country_code, linkedin_url = excluded.linkedin_url,
    website_url = excluded.website_url, portfolio_url = excluded.portfolio_url, photo_path = excluded.photo_path,
    work_authorization = excluded.work_authorization, updated_at = now();

  -- Each collection: delete removed rows, then upsert in order. ON CONFLICT on another user's id fails RLS.
  delete from public.work_experiences where master_profile_id = p_id
    and id not in (select (x ->> 'id')::uuid from jsonb_array_elements(coalesce(p_data -> 'experience', '[]')) x);
  insert into public.work_experiences as t (id, master_profile_id, user_id, employer, title, employment_type, location,
    start_date, end_date, is_current, description, bullets, sort_order)
  select (x ->> 'id')::uuid, p_id, v_uid, x ->> 'employer', x ->> 'title', x ->> 'employmentType', x ->> 'location',
    x -> 'dates' ->> 'start', x -> 'dates' ->> 'end', coalesce((x -> 'dates' ->> 'current')::boolean, false),
    x ->> 'description', coalesce(x -> 'bullets', '[]'), (ord - 1)::int
  from jsonb_array_elements(coalesce(p_data -> 'experience', '[]')) with ordinality as a(x, ord)
  on conflict (id) do update set employer = excluded.employer, title = excluded.title, employment_type = excluded.employment_type,
    location = excluded.location, start_date = excluded.start_date, end_date = excluded.end_date, is_current = excluded.is_current,
    description = excluded.description, bullets = excluded.bullets, sort_order = excluded.sort_order, updated_at = now()
  where t.master_profile_id = p_id;

  delete from public.education_records where master_profile_id = p_id
    and id not in (select (x ->> 'id')::uuid from jsonb_array_elements(coalesce(p_data -> 'education', '[]')) x);
  insert into public.education_records as t (id, master_profile_id, user_id, institution, qualification, field, start_date, end_date, grade, notes, sort_order)
  select (x ->> 'id')::uuid, p_id, v_uid, x ->> 'institution', x ->> 'qualification', x ->> 'field',
    x -> 'dates' ->> 'start', x -> 'dates' ->> 'end', x ->> 'grade', x ->> 'notes', (ord - 1)::int
  from jsonb_array_elements(coalesce(p_data -> 'education', '[]')) with ordinality as a(x, ord)
  on conflict (id) do update set institution = excluded.institution, qualification = excluded.qualification, field = excluded.field,
    start_date = excluded.start_date, end_date = excluded.end_date, grade = excluded.grade, notes = excluded.notes,
    sort_order = excluded.sort_order, updated_at = now()
  where t.master_profile_id = p_id;

  -- Skills: unique per (profile, lower(name)) — replace wholesale to avoid transient duplicate conflicts on reorder/rename.
  delete from public.skills where master_profile_id = p_id;
  insert into public.skills (id, master_profile_id, user_id, name, category, level, sort_order)
  select (x ->> 'id')::uuid, p_id, v_uid, x ->> 'name', x ->> 'category', x ->> 'level', (ord - 1)::int
  from jsonb_array_elements(coalesce(p_data -> 'skills', '[]')) with ordinality as a(x, ord);

  delete from public.certifications where master_profile_id = p_id;
  insert into public.certifications (id, master_profile_id, user_id, name, issuer, issued_on, expires_on, credential_url, sort_order)
  select (x ->> 'id')::uuid, p_id, v_uid, x ->> 'name', x ->> 'issuer', x ->> 'issued', x ->> 'expires', x ->> 'credentialUrl', (ord - 1)::int
  from jsonb_array_elements(coalesce(p_data -> 'certifications', '[]')) with ordinality as a(x, ord);

  delete from public.languages where master_profile_id = p_id;
  insert into public.languages (id, master_profile_id, user_id, language, proficiency, sort_order)
  select (x ->> 'id')::uuid, p_id, v_uid, x ->> 'language', x ->> 'proficiency', (ord - 1)::int
  from jsonb_array_elements(coalesce(p_data -> 'languages', '[]')) with ordinality as a(x, ord);

  delete from public.projects where master_profile_id = p_id;
  insert into public.projects (id, master_profile_id, user_id, name, role, start_date, end_date, description, url, sort_order)
  select (x ->> 'id')::uuid, p_id, v_uid, x ->> 'name', x ->> 'role', x -> 'dates' ->> 'start', x -> 'dates' ->> 'end',
    x ->> 'description', x ->> 'url', (ord - 1)::int
  from jsonb_array_elements(coalesce(p_data -> 'projects', '[]')) with ordinality as a(x, ord);

  if p_snapshot_label is not null then
    select coalesce(max(version_no), 0) + 1 into v_version from public.master_profile_versions where master_profile_id = p_id;
    insert into public.master_profile_versions (master_profile_id, user_id, version_no, snapshot, label)
    values (p_id, v_uid, v_version, p_data, nullif(p_snapshot_label, ''));
  end if;

  return jsonb_build_object('updatedAt', v_updated, 'version', v_version);
end $$;

revoke all on function public.get_master_profile(uuid) from public, anon;
revoke all on function public.save_master_profile(uuid, jsonb, timestamptz, text) from public, anon;
grant execute on function public.get_master_profile(uuid) to authenticated;
grant execute on function public.save_master_profile(uuid, jsonb, timestamptz, text) to authenticated;
