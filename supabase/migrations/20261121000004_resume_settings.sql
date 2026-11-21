-- Phase 4C/5C — per-resume presentation settings and atomic layout save.

alter table public.resume_documents
  add column settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object');
comment on column public.resume_documents.settings is
  'hiddenItemIds[], dateFormat override, overridden[] (which country recommendations the user changed)';

-- Save title/country/locale/template/page/photo/settings and the section order in one transaction.
-- p_layout: {title, countryCode, locale, templateId, pageSize, includePhoto, settings, sections: [{key, visible, heading?}]}
create or replace function public.save_resume_layout(p_id uuid, p_layout jsonb, p_expected_updated_at timestamptz default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_current timestamptz;
  v_updated timestamptz;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select updated_at into v_current from public.resume_documents where id = p_id and user_id = v_uid and deleted_at is null for update;
  if not found then raise exception 'resume not found' using errcode = 'P0002'; end if;
  if p_expected_updated_at is not null and v_current <> p_expected_updated_at then
    raise exception 'conflict' using errcode = '40001';
  end if;

  update public.resume_documents set
    title = coalesce(p_layout ->> 'title', title),
    country_code = coalesce(p_layout ->> 'countryCode', country_code),
    locale = coalesce(p_layout ->> 'locale', locale),
    template_id = coalesce(p_layout ->> 'templateId', template_id),
    page_size = coalesce(p_layout ->> 'pageSize', page_size),
    include_photo = coalesce((p_layout ->> 'includePhoto')::boolean, include_photo),
    settings = coalesce(p_layout -> 'settings', settings)
  where id = p_id
  returning updated_at into v_updated;

  if p_layout ? 'sections' then
    delete from public.resume_sections where resume_id = p_id;
    insert into public.resume_sections (resume_id, user_id, section_key, custom_heading, sort_order, is_visible)
    select p_id, v_uid, s ->> 'key', s ->> 'heading', (ord - 1)::int, coalesce((s ->> 'visible')::boolean, true)
    from jsonb_array_elements(p_layout -> 'sections') with ordinality as a(s, ord);
  end if;

  return jsonb_build_object('updatedAt', v_updated);
end $$;

revoke all on function public.save_resume_layout(uuid, jsonb, timestamptz) from public, anon;
grant execute on function public.save_resume_layout(uuid, jsonb, timestamptz) to authenticated;
