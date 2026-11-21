-- Phase 2A/2C — Row Level Security and private storage.
-- Default deny: RLS is enabled on EVERY public table; only listed policies grant access.
-- Server-only writes (billing, AI results, usage) go through the service role, which bypasses RLS.

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- owner full CRUD
do $$
declare t text;
begin
  foreach t in array array[
    'master_profiles','personal_details','work_experiences','education_records','skills',
    'certifications','languages','projects','resume_documents','resume_versions','resume_sections',
    'job_descriptions','ats_results','cover_letters']
  loop
    execute format($f$create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))$f$, t || '_owner_select', t);
    execute format($f$create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))$f$, t || '_owner_insert', t);
    execute format($f$create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))$f$, t || '_owner_update', t);
    execute format($f$create policy %I on public.%I for delete to authenticated using (user_id = (select auth.uid()))$f$, t || '_owner_delete', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- owner read-only (server writes)
do $$
declare t text;
begin
  foreach t in array array['ai_usage','subscriptions','payments','entitlements','usage_quotas','document_exports','import_jobs']
  loop
    execute format($f$create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))$f$, t || '_owner_select', t);
  end loop;
end $$;

-- profiles: read/update own row (created by trigger)
create policy profiles_owner_select on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_owner_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- uploads: owner may create/read/delete metadata (file itself lives in storage)
create policy uploaded_documents_owner_select on public.uploaded_documents for select to authenticated using (user_id = (select auth.uid()));
create policy uploaded_documents_owner_insert on public.uploaded_documents for insert to authenticated with check (user_id = (select auth.uid()));
create policy uploaded_documents_owner_delete on public.uploaded_documents for delete to authenticated using (user_id = (select auth.uid()));

-- requests a client may enqueue; processing is server-side
create policy import_jobs_owner_insert on public.import_jobs for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'queued' and extracted is null);
create policy document_exports_owner_insert on public.document_exports for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'queued' and storage_path is null);

-- AI jobs: clients can only enqueue (never write outputs) and read their own.
create policy ai_jobs_owner_select on public.ai_jobs for select to authenticated using (user_id = (select auth.uid()));
create policy ai_jobs_owner_insert on public.ai_jobs for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'queued' and output is null
              and attempts = 0 and provider is null and model is null);

-- support + deletion requests
create policy support_requests_owner_select on public.support_requests for select to authenticated using (user_id = (select auth.uid()));
create policy support_requests_owner_insert on public.support_requests for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'open');
create policy deletion_requests_owner_select on public.deletion_requests for select to authenticated using (user_id = (select auth.uid()));
create policy deletion_requests_owner_insert on public.deletion_requests for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending' and processed_at is null);

-- ---------------------------------------------------------------- public catalog
create policy resume_templates_public_read on public.resume_templates for select to anon, authenticated using (status = 'published');
create policy template_versions_public_read on public.template_versions for select to anon, authenticated
  using (published_at is not null and exists (select 1 from public.resume_templates rt where rt.id = template_id and rt.status = 'published'));
create policy country_rules_public_read on public.country_rules for select to anon, authenticated using (status = 'published');
create policy country_rule_sources_public_read on public.country_rule_sources for select to anon, authenticated
  using (exists (select 1 from public.country_rules cr where cr.country_code = country_rule_sources.country_code and cr.status = 'published'));
create policy subscription_plans_public_read on public.subscription_plans for select to anon, authenticated using (is_active);

-- ---------------------------------------------------------------- admin
create policy admin_roles_self_read on public.admin_roles for select to authenticated
  using (user_id = (select auth.uid()) or public.has_admin_role(array['super_admin']));
create policy admin_roles_super_write on public.admin_roles for all to authenticated
  using (public.has_admin_role(array['super_admin'])) with check (public.has_admin_role(array['super_admin']));

do $$
declare t text;
begin
  foreach t in array array['resume_templates','template_versions','country_rules','country_rule_sources']
  loop
    execute format($f$create policy %I on public.%I for all to authenticated
      using (public.has_admin_role(array['super_admin','admin','content_editor']))
      with check (public.has_admin_role(array['super_admin','admin','content_editor']))$f$, t || '_admin_write', t);
  end loop;
end $$;

create policy subscription_plans_admin_write on public.subscription_plans for all to authenticated
  using (public.has_admin_role(array['super_admin','admin','finance'])) with check (public.has_admin_role(array['super_admin','admin','finance']));
create policy coupons_admin_all on public.coupons for all to authenticated
  using (public.has_admin_role(array['super_admin','admin','finance'])) with check (public.has_admin_role(array['super_admin','admin','finance']));
create policy payments_admin_read on public.payments for select to authenticated using (public.has_admin_role(array['super_admin','admin','finance']));
create policy subscriptions_admin_read on public.subscriptions for select to authenticated using (public.has_admin_role(array['super_admin','admin','finance','support']));
create policy support_requests_admin_all on public.support_requests for all to authenticated
  using (public.has_admin_role(array['super_admin','admin','support'])) with check (public.has_admin_role(array['super_admin','admin','support']));
create policy audit_logs_admin_read on public.audit_logs for select to authenticated using (public.has_admin_role(array['super_admin','admin']));
create policy ai_usage_admin_read on public.ai_usage for select to authenticated using (public.has_admin_role(array['super_admin','admin']));
create policy deletion_requests_admin_read on public.deletion_requests for select to authenticated using (public.has_admin_role(array['super_admin','admin','support']));

-- Audited write helper: the only way a signed-in client can add to audit_logs.
create or replace function public.write_audit_log(p_action text, p_entity_type text, p_entity_id text, p_metadata jsonb default '{}')
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
$$;
revoke all on function public.write_audit_log(text, text, text, jsonb) from public;
grant execute on function public.write_audit_log(text, text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------- private storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('resume-uploads', 'resume-uploads', false, 10485760,
    array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain']),
  ('resume-exports', 'resume-exports', false, 20971520,
    array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('profile-photos', 'profile-photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- Objects live at <bucket>/<user_id>/...; users may only touch their own folder.
create policy storage_owner_read on storage.objects for select to authenticated
  using (bucket_id in ('resume-uploads','resume-exports','profile-photos')
         and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy storage_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('resume-uploads','profile-photos')
              and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy storage_owner_delete on storage.objects for delete to authenticated
  using (bucket_id in ('resume-uploads','resume-exports','profile-photos')
         and (storage.foldername(name))[1] = (select auth.uid())::text);
-- resume-exports are written only by the document worker (service role).
