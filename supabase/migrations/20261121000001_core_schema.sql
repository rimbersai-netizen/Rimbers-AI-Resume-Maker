-- Phase 2A — Core schema for Global AI Resume Studio.
-- Conventions:
--   * Every user-owned row carries user_id (uuid -> auth.users) for simple, indexable RLS.
--   * Child rows use composite FKs (parent_id, user_id) -> parent(id, user_id) so a user can never
--     attach data to another user's parent row, even with a crafted request.
--   * Partial dates (YYYY | YYYY-MM | YYYY-MM-DD) are stored as text, matching @gars/resume-schema.
--   * Money is stored in minor units (integer) + ISO currency.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- helpers
create domain public.partial_date as text
  check (value ~ '^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$');

create domain public.country_code as text check (value ~ '^[A-Z]{2}$');

-- BCP 47 language tag, e.g. en, ar, pt-BR, zh-Hans
create domain public.locale_tag as text check (value ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$');

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------- accounts
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 120),
  -- App UI language is independent of resume language (see docs/localization).
  app_locale public.locale_tag not null default 'en',
  app_locale_source text not null default 'default'
    check (app_locale_source in ('manual', 'device', 'country', 'default')),
  country_code public.country_code,
  marketing_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('super_admin', 'admin', 'support', 'content_editor', 'finance')),
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create or replace function public.has_admin_role(roles text[] default null) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.admin_roles ar
    where ar.user_id = auth.uid()
      and (roles is null or ar.role = any(roles))
  );
$$;
revoke all on function public.has_admin_role(text[]) from public;
grant execute on function public.has_admin_role(text[]) to authenticated;

-- Create a profile row whenever an auth user is created.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- master profile
create table public.master_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Main' check (char_length(name) between 1 and 120),
  summary text check (char_length(summary) <= 5000),
  is_primary boolean not null default false,
  schema_version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create unique index master_profiles_one_primary on public.master_profiles (user_id) where is_primary;
create index master_profiles_user_idx on public.master_profiles (user_id);

create table public.personal_details (
  master_profile_id uuid primary key,
  user_id uuid not null,
  full_name text not null check (char_length(full_name) between 1 and 200),
  professional_title text check (char_length(professional_title) <= 200),
  email text check (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text check (char_length(phone) <= 40),
  city text check (char_length(city) <= 200),
  region text check (char_length(region) <= 200),
  country_code public.country_code,
  linkedin_url text check (linkedin_url ~ '^https?://'),
  website_url text check (website_url ~ '^https?://'),
  portfolio_url text check (portfolio_url ~ '^https?://'),
  photo_path text check (char_length(photo_path) <= 300), -- private storage path, never a public URL
  work_authorization text check (char_length(work_authorization) <= 200),
  updated_at timestamptz not null default now(),
  foreign key (master_profile_id, user_id) references public.master_profiles (id, user_id) on delete cascade
);

create table public.work_experiences (
  id uuid primary key default gen_random_uuid(),
  master_profile_id uuid not null,
  user_id uuid not null,
  employer text not null check (char_length(employer) between 1 and 200),
  title text not null check (char_length(title) between 1 and 200),
  employment_type text check (employment_type in ('full_time','part_time','contract','internship','freelance','temporary','volunteer')),
  location text check (char_length(location) <= 200),
  start_date public.partial_date,
  end_date public.partial_date,
  is_current boolean not null default false,
  description text check (char_length(description) <= 5000),
  -- [{id, text, provenance: user|import|ai_accepted}]
  bullets jsonb not null default '[]'::jsonb check (jsonb_typeof(bullets) = 'array'),
  sort_order int not null default 0,
  updated_at timestamptz not null default now(),
  foreign key (master_profile_id, user_id) references public.master_profiles (id, user_id) on delete cascade,
  constraint work_current_has_no_end check (not (is_current and end_date is not null)),
  constraint work_dates_ordered check (start_date is null or end_date is null or start_date <= rpad(end_date, char_length(start_date), '9'))
);
create index work_experiences_profile_idx on public.work_experiences (master_profile_id, sort_order);
create index work_experiences_user_idx on public.work_experiences (user_id);

create table public.education_records (
  id uuid primary key default gen_random_uuid(),
  master_profile_id uuid not null,
  user_id uuid not null,
  institution text not null check (char_length(institution) between 1 and 200),
  qualification text not null check (char_length(qualification) between 1 and 200),
  field text check (char_length(field) <= 200),
  start_date public.partial_date,
  end_date public.partial_date,
  grade text check (char_length(grade) <= 100),
  notes text check (char_length(notes) <= 5000),
  sort_order int not null default 0,
  updated_at timestamptz not null default now(),
  foreign key (master_profile_id, user_id) references public.master_profiles (id, user_id) on delete cascade,
  constraint edu_dates_ordered check (start_date is null or end_date is null or start_date <= rpad(end_date, char_length(start_date), '9'))
);
create index education_records_profile_idx on public.education_records (master_profile_id, sort_order);
create index education_records_user_idx on public.education_records (user_id);

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  master_profile_id uuid not null,
  user_id uuid not null,
  name text not null check (char_length(name) between 1 and 100),
  category text check (char_length(category) <= 100),
  level text check (level in ('beginner','intermediate','advanced','expert')),
  sort_order int not null default 0,
  foreign key (master_profile_id, user_id) references public.master_profiles (id, user_id) on delete cascade
);
create unique index skills_unique_name on public.skills (master_profile_id, lower(name));
create index skills_user_idx on public.skills (user_id);

create table public.certifications (
  id uuid primary key default gen_random_uuid(),
  master_profile_id uuid not null,
  user_id uuid not null,
  name text not null check (char_length(name) between 1 and 200),
  issuer text check (char_length(issuer) <= 200),
  issued_on public.partial_date,
  expires_on public.partial_date,
  credential_url text check (credential_url ~ '^https?://'),
  sort_order int not null default 0,
  foreign key (master_profile_id, user_id) references public.master_profiles (id, user_id) on delete cascade
);
create index certifications_user_idx on public.certifications (user_id);

create table public.languages (
  id uuid primary key default gen_random_uuid(),
  master_profile_id uuid not null,
  user_id uuid not null,
  language text not null check (char_length(language) between 1 and 100),
  proficiency text check (proficiency in ('A1','A2','B1','B2','C1','C2','native')),
  sort_order int not null default 0,
  foreign key (master_profile_id, user_id) references public.master_profiles (id, user_id) on delete cascade
);
create index languages_user_idx on public.languages (user_id);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  master_profile_id uuid not null,
  user_id uuid not null,
  name text not null check (char_length(name) between 1 and 200),
  role text check (char_length(role) <= 200),
  start_date public.partial_date,
  end_date public.partial_date,
  description text check (char_length(description) <= 5000),
  url text check (url ~ '^https?://'),
  sort_order int not null default 0,
  foreign key (master_profile_id, user_id) references public.master_profiles (id, user_id) on delete cascade
);
create index projects_user_idx on public.projects (user_id);

-- ---------------------------------------------------------------- catalog (admin managed, public read)
create table public.resume_templates (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{1,63}$'),
  name text not null,
  category text not null check (category in (
    'ats_minimal','classic','modern','corporate','executive','technical','engineering','construction',
    'healthcare','finance','accounting','sales','marketing','academic','graduate','internship','legal',
    'hospitality','creative','government','international')),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  supports_rtl boolean not null default false,
  supports_docx boolean not null default true,
  is_premium boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index resume_templates_status_idx on public.resume_templates (status, category);

create table public.template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id text not null references public.resume_templates(id) on delete cascade,
  version_no int not null check (version_no > 0),
  spec jsonb not null,
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (template_id, version_no)
);

create table public.country_rules (
  country_code public.country_code primary key,
  name text not null,
  config jsonb not null,
  status text not null default 'draft' check (status in ('draft','published')),
  last_reviewed_on date,
  updated_at timestamptz not null default now()
);

create table public.country_rule_sources (
  id uuid primary key default gen_random_uuid(),
  country_code public.country_code not null references public.country_rules(country_code) on delete cascade,
  title text not null,
  url text check (url ~ '^https?://'),
  accessed_on date
);
create index country_rule_sources_country_idx on public.country_rule_sources (country_code);

-- ---------------------------------------------------------------- resumes
create table public.resume_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  master_profile_id uuid,
  title text not null check (char_length(title) between 1 and 200),
  country_code public.country_code not null,
  -- Resume language is independent of profiles.app_locale.
  locale public.locale_tag not null default 'en',
  template_id text not null references public.resume_templates(id),
  page_size text not null check (page_size in ('A4','Letter')),
  include_photo boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (master_profile_id, user_id) references public.master_profiles (id, user_id) on delete set null (master_profile_id)
);
create index resume_documents_user_idx on public.resume_documents (user_id, updated_at desc) where deleted_at is null;

create table public.resume_versions (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null,
  user_id uuid not null,
  version_no int not null check (version_no > 0),
  snapshot jsonb not null, -- validated ResumeDocument (@gars/resume-schema)
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  unique (resume_id, version_no),
  unique (id, user_id),
  foreign key (resume_id, user_id) references public.resume_documents (id, user_id) on delete cascade
);

create table public.resume_sections (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null,
  user_id uuid not null,
  section_key text not null check (section_key in (
    'summary','experience','education','skills','certifications','languages','projects',
    'publications','awards','volunteer','references','custom')),
  custom_heading text check (char_length(custom_heading) <= 120),
  sort_order int not null default 0,
  is_visible boolean not null default true,
  foreign key (resume_id, user_id) references public.resume_documents (id, user_id) on delete cascade,
  constraint custom_needs_heading check (section_key <> 'custom' or custom_heading is not null)
);
create unique index resume_sections_unique_builtin on public.resume_sections (resume_id, section_key) where section_key <> 'custom';
create index resume_sections_resume_idx on public.resume_sections (resume_id, sort_order);

create table public.job_descriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text check (char_length(title) <= 200),
  company text check (char_length(company) <= 200),
  body text not null check (char_length(body) between 1 and 20000),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);
create index job_descriptions_user_idx on public.job_descriptions (user_id, created_at desc);

create table public.ats_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  resume_id uuid not null,
  resume_version_id uuid,
  job_description_id uuid,
  overall_score int check (overall_score between 0 and 100),
  categories jsonb not null default '[]'::jsonb,
  engine_version text not null,
  created_at timestamptz not null default now(),
  foreign key (resume_id, user_id) references public.resume_documents (id, user_id) on delete cascade,
  foreign key (job_description_id, user_id) references public.job_descriptions (id, user_id) on delete set null (job_description_id)
);
create index ats_results_resume_idx on public.ats_results (resume_id, created_at desc);
create index ats_results_user_idx on public.ats_results (user_id);

create table public.cover_letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  resume_id uuid,
  job_description_id uuid,
  locale public.locale_tag not null default 'en',
  title text check (char_length(title) <= 200),
  body text not null check (char_length(body) <= 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (user_id) references auth.users(id) on delete cascade,
  foreign key (resume_id, user_id) references public.resume_documents (id, user_id) on delete set null (resume_id),
  foreign key (job_description_id, user_id) references public.job_descriptions (id, user_id) on delete set null (job_description_id)
);
create index cover_letters_user_idx on public.cover_letters (user_id, updated_at desc);

-- ---------------------------------------------------------------- files, import, export
create table public.uploaded_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  original_filename text not null check (char_length(original_filename) <= 255),
  mime_type text not null check (mime_type in (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain')),
  size_bytes int not null check (size_bytes > 0 and size_bytes <= 10485760),
  sha256 text check (sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  -- Storage path must live under the owner's folder.
  constraint uploaded_path_owner check (storage_path like user_id::text || '/%')
);
create index uploaded_documents_user_idx on public.uploaded_documents (user_id, created_at desc);
create index uploaded_documents_dupe_idx on public.uploaded_documents (user_id, sha256);

create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  uploaded_document_id uuid not null,
  status text not null default 'queued' check (status in ('queued','running','needs_review','merged','discarded','failed')),
  extracted jsonb,
  confidence numeric(4,3) check (confidence between 0 and 1),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (uploaded_document_id, user_id) references public.uploaded_documents (id, user_id) on delete cascade
);
create index import_jobs_user_idx on public.import_jobs (user_id, created_at desc);

create table public.document_exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  resume_id uuid not null,
  resume_version_id uuid,
  format text not null check (format in ('pdf','docx')),
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed')),
  storage_path text,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  foreign key (resume_id, user_id) references public.resume_documents (id, user_id) on delete cascade,
  foreign key (resume_version_id, user_id) references public.resume_versions (id, user_id) on delete set null (resume_version_id),
  constraint export_path_owner check (storage_path is null or storage_path like user_id::text || '/%')
);
create index document_exports_user_idx on public.document_exports (user_id, created_at desc);
create index document_exports_queue_idx on public.document_exports (created_at) where status = 'queued';

-- ---------------------------------------------------------------- AI
create table public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in (
    'summary','objective','rewrite_experience','achievement_bullets','grammar','tone','industry_wording',
    'tailor_resume','organize_skills','shorten','expand','cover_letter','linkedin_headline','linkedin_about',
    'interview_prep','import_extract')),
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','cancelled')),
  input jsonb not null,
  output jsonb,
  provider text,
  model text,
  attempts int not null default 0 check (attempts >= 0),
  max_attempts int not null default 3 check (max_attempts between 1 and 10),
  error_code text,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 100),
  cloud_consent boolean not null default false,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, idempotency_key)
);
create index ai_jobs_queue_idx on public.ai_jobs (created_at) where status = 'queued';
create index ai_jobs_user_idx on public.ai_jobs (user_id, created_at desc);

create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  ai_job_id uuid references public.ai_jobs(id) on delete set null,
  provider text not null,
  model text not null,
  prompt_tokens int not null default 0 check (prompt_tokens >= 0),
  completion_tokens int not null default 0 check (completion_tokens >= 0),
  duration_ms int check (duration_ms >= 0),
  cost_usd_micros bigint not null default 0 check (cost_usd_micros >= 0),
  created_at timestamptz not null default now()
);
create index ai_usage_user_idx on public.ai_usage (user_id, created_at desc);
create index ai_usage_created_idx on public.ai_usage (created_at);

-- ---------------------------------------------------------------- billing
create table public.subscription_plans (
  id text primary key check (id in ('FREE','STANDARD','PROFESSIONAL','PREMIUM')),
  name text not null,
  currency text not null default 'SAR' check (currency ~ '^[A-Z]{3}$'),
  monthly_price_minor int check (monthly_price_minor >= 0),
  yearly_price_minor int check (yearly_price_minor >= 0),
  one_time_download_price_minor int check (one_time_download_price_minor >= 0),
  trial_days int not null default 0 check (trial_days between 0 and 90),
  limits jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  sort_order int not null default 0
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null references public.subscription_plans(id),
  status text not null check (status in ('trialing','active','past_due','canceled','expired')),
  billing_period text not null check (billing_period in ('monthly','yearly','one_time')),
  provider text not null check (provider in ('moyasar','apple','google','manual')),
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_subscription_id),
  constraint period_ordered check (current_period_end is null or current_period_start is null or current_period_end > current_period_start)
);
create index subscriptions_user_idx on public.subscriptions (user_id, status);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null, -- financial records retained after account deletion
  subscription_id uuid references public.subscriptions(id) on delete set null,
  provider text not null check (provider in ('moyasar','apple','google','manual')),
  provider_payment_id text not null,
  amount_minor int not null check (amount_minor >= 0),
  refunded_amount_minor int not null default 0 check (refunded_amount_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null check (status in ('initiated','paid','failed','refunded','partially_refunded')),
  idempotency_key text not null unique,
  coupon_code text,
  created_at timestamptz not null default now(),
  unique (provider, provider_payment_id),
  constraint refund_not_exceeding check (refunded_amount_minor <= amount_minor)
);
create index payments_user_idx on public.payments (user_id, created_at desc);

create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null,
  source text not null check (source in ('plan','one_time','coupon','admin_grant','trial')),
  source_ref uuid,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  constraint entitlement_window check (valid_until is null or valid_until > valid_from)
);
create index entitlements_lookup_idx on public.entitlements (user_id, feature, valid_until);

create table public.usage_quotas (
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null,
  period_start date not null,
  used int not null default 0 check (used >= 0),
  quota int not null check (quota >= 0),
  primary key (user_id, feature, period_start)
);

create table public.coupons (
  code text primary key check (code ~ '^[A-Z0-9_-]{3,40}$'),
  percent_off int check (percent_off between 1 and 100),
  amount_off_minor int check (amount_off_minor > 0),
  currency text check (currency ~ '^[A-Z]{3}$'),
  applies_to_plan text references public.subscription_plans(id),
  max_redemptions int check (max_redemptions > 0),
  redeemed_count int not null default 0 check (redeemed_count >= 0),
  valid_until timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint one_discount_kind check ((percent_off is null) <> (amount_off_minor is null)),
  constraint amount_needs_currency check (amount_off_minor is null or currency is not null),
  constraint redemptions_cap check (max_redemptions is null or redeemed_count <= max_redemptions)
);

-- ---------------------------------------------------------------- operations
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

create or replace function public.audit_logs_append_only() returns trigger
language plpgsql as $$
begin
  raise exception 'audit_logs is append-only';
end $$;
create trigger audit_logs_no_update before update or delete on public.audit_logs
  for each row execute function public.audit_logs_append_only();
create trigger audit_logs_no_truncate before truncate on public.audit_logs
  for each statement execute function public.audit_logs_append_only();

create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  subject text not null check (char_length(subject) between 1 and 200),
  body text not null check (char_length(body) between 1 and 10000),
  status text not null default 'open' check (status in ('open','pending','resolved','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_requests_user_idx on public.support_requests (user_id, created_at desc);
create index support_requests_status_idx on public.support_requests (status, created_at);

create table public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','processing','completed','cancelled')),
  reason text check (char_length(reason) <= 1000),
  requested_at timestamptz not null default now(),
  processed_at timestamptz
);
create unique index deletion_requests_one_open on public.deletion_requests (user_id) where status in ('pending','processing');

-- ---------------------------------------------------------------- updated_at triggers
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','master_profiles','personal_details','work_experiences','education_records',
    'resume_templates','country_rules','resume_documents','cover_letters','import_jobs',
    'subscriptions','support_requests']
  loop
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()',
      t || '_touch_updated_at', t);
  end loop;
end $$;
