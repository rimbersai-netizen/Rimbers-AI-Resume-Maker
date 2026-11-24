-- Phase 12B — saved LinkedIn drafts (headline/about). Separate from extras so save_master_profile never overwrites it.
alter table public.master_profiles
  add column linkedin jsonb not null default '{}'::jsonb
  check (jsonb_typeof(linkedin) = 'object'
     and char_length(coalesce(linkedin ->> 'headline', '')) <= 220
     and char_length(coalesce(linkedin ->> 'about', '')) <= 2600);
