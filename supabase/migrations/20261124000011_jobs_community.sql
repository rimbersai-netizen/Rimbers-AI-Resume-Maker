-- Phase 15 — job discovery pipeline + community.
-- Jobs themselves are NOT stored globally (they come from public feeds on demand); a user's saved/applied jobs keep a snapshot.

-- ---------------------------------------------------------------- preferences
create table public.job_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  roles text[] not null default '{}' check (cardinality(roles) <= 20),
  work_modes text[] not null default '{}' check (work_modes <@ array['remote', 'hybrid', 'onsite']),
  countries text[] not null default '{}' check (cardinality(countries) <= 20),
  min_salary integer check (min_salary is null or (min_salary >= 0 and min_salary <= 10000000)),
  posted_within_days integer check (posted_within_days is null or posted_within_days in (1, 3, 7, 14, 30)),
  updated_at timestamptz not null default now()
);
alter table public.job_preferences enable row level security;
create policy job_preferences_owner on public.job_preferences for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- pipeline (saved -> ready -> applied ...)
create table public.job_pipeline (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null check (char_length(source) between 1 and 40),
  external_id text not null check (char_length(external_id) between 1 and 200),
  state text not null check (state in ('saved', 'passed', 'ready', 'applying', 'applied', 'needs_you', 'interview', 'offer', 'rejected')),
  title text not null check (char_length(title) between 1 and 300),
  company text not null check (char_length(company) between 1 and 200),
  url text check (url is null or url ~* '^https?://'),
  match_score integer check (match_score between 0 and 100),
  snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(snapshot) = 'object' and octet_length(snapshot::text) <= 40000),
  tailored_resume_id uuid,
  notes text check (char_length(notes) <= 2000),
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source, external_id),
  foreign key (tailored_resume_id, user_id) references public.resume_documents (id, user_id) on delete set null (tailored_resume_id)
);
create index job_pipeline_user_state_idx on public.job_pipeline (user_id, state, updated_at desc);
alter table public.job_pipeline enable row level security;
create policy job_pipeline_owner on public.job_pipeline for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
create trigger job_pipeline_touch before update on public.job_pipeline for each row execute function public.touch_updated_at();
create trigger job_preferences_touch before update on public.job_preferences for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- community
-- Authors are shown by a stable anonymous handle, never by name or email.
create table public.community_handles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z]+_[a-z]+_[0-9]{2,4}$')
);
alter table public.community_handles enable row level security;
create policy community_handles_owner on public.community_handles for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  handle text not null,
  kind text not null default 'discussion' check (kind in ('win', 'question', 'discussion', 'roast')),
  title text not null check (char_length(btrim(title)) between 3 and 140),
  body text not null check (char_length(btrim(body)) between 3 and 4000),
  hidden boolean not null default false,   -- moderation; only service role changes it
  created_at timestamptz not null default now()
);
create index community_posts_feed_idx on public.community_posts (created_at desc) where not hidden;

create table public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  handle text not null,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index community_comments_post_idx on public.community_comments (post_id, created_at) where not hidden;

create table public.community_reactions (
  post_id uuid not null references public.community_posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.community_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  post_id uuid references public.community_posts (id) on delete cascade,
  comment_id uuid references public.community_comments (id) on delete cascade,
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  created_at timestamptz not null default now(),
  check ((post_id is null) <> (comment_id is null)),
  unique (user_id, post_id, comment_id)
);

alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_reactions enable row level security;
alter table public.community_reports enable row level security;

create policy community_posts_read on public.community_posts for select to authenticated using (not hidden);
create policy community_posts_insert on public.community_posts for insert to authenticated
  with check (user_id = (select auth.uid()) and hidden = false
    and handle = (select h.handle from public.community_handles h where h.user_id = (select auth.uid())));
create policy community_posts_delete on public.community_posts for delete to authenticated using (user_id = (select auth.uid()));

create policy community_comments_read on public.community_comments for select to authenticated using (not hidden);
create policy community_comments_insert on public.community_comments for insert to authenticated
  with check (user_id = (select auth.uid()) and hidden = false
    and handle = (select h.handle from public.community_handles h where h.user_id = (select auth.uid()))
    and exists (select 1 from public.community_posts p where p.id = post_id and not p.hidden));
create policy community_comments_delete on public.community_comments for delete to authenticated using (user_id = (select auth.uid()));

create policy community_reactions_read on public.community_reactions for select to authenticated using (true);
create policy community_reactions_insert on public.community_reactions for insert to authenticated with check (user_id = (select auth.uid()));
create policy community_reactions_delete on public.community_reactions for delete to authenticated using (user_id = (select auth.uid()));

create policy community_reports_insert on public.community_reports for insert to authenticated with check (user_id = (select auth.uid()));
-- no select policy on reports: only moderators (service role) read them.

-- Abuse limits: per user per rolling day.
create or replace function public.community_rate_limit() returns trigger language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if tg_table_name = 'community_posts' then
    select count(*) into n from public.community_posts where user_id = new.user_id and created_at > now() - interval '1 day';
    if n >= 10 then raise exception 'rate limit: too many posts today' using errcode = 'P0001'; end if;
  elsif tg_table_name = 'community_comments' then
    select count(*) into n from public.community_comments where user_id = new.user_id and created_at > now() - interval '1 day';
    if n >= 60 then raise exception 'rate limit: too many comments today' using errcode = 'P0001'; end if;
  end if;
  return new;
end $$;
create trigger community_posts_rate before insert on public.community_posts for each row execute function public.community_rate_limit();
create trigger community_comments_rate before insert on public.community_comments for each row execute function public.community_rate_limit();

-- Stable handle per user, generated server-side (clients cannot choose one that impersonates someone).
create or replace function public.ensure_community_handle() returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  h text;
  adj text[] := array['calm','bright','quiet','brave','swift','kind','sharp','warm','bold','keen','steady','clever'];
  ani text[] := array['falcon','otter','heron','fox','lynx','owl','wolf','finch','panda','tiger','raven','seal'];
  tries int := 0;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select handle into h from public.community_handles where user_id = uid;
  if h is not null then return h; end if;
  loop
    h := adj[1 + floor(random() * array_length(adj, 1))::int] || '_' || ani[1 + floor(random() * array_length(ani, 1))::int] || '_' || lpad(floor(random() * 100)::int::text, 2, '0');
    begin
      insert into public.community_handles (user_id, handle) values (uid, h);
      return h;
    exception when unique_violation then
      select handle into h from public.community_handles where user_id = uid;
      if h is not null then return h; end if;
      tries := tries + 1;
      if tries > 20 then h := h || floor(random() * 100)::int::text; end if;
    end;
  end loop;
end $$;
revoke all on function public.ensure_community_handle() from public, anon;
grant execute on function public.ensure_community_handle() to authenticated;
