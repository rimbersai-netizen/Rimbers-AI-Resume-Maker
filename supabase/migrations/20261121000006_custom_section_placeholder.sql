-- The 'custom' section key is a placeholder for ALL of the profile's custom sections (each carries its own
-- heading in master_profiles.extras). custom_heading is an optional display override for any section.
alter table public.resume_sections drop constraint custom_needs_heading;
