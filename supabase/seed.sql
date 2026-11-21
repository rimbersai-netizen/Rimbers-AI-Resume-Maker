-- Local development seed (no real user data).
insert into public.subscription_plans (id, name, currency, monthly_price_minor, yearly_price_minor, one_time_download_price_minor, trial_days, limits, sort_order) values
  ('FREE',         'Free',         'SAR', 0,    0,     null, 0, '{"resumes":1,"ai_requests_month":5,"exports_month":2,"docx":false,"premium_templates":false}', 0),
  ('STANDARD',     'Standard',     'SAR', 1900, 15900, 1500, 0, '{"resumes":5,"ai_requests_month":50,"exports_month":20,"docx":true,"premium_templates":false}', 1),
  ('PROFESSIONAL', 'Professional', 'SAR', 3900, 27900, null, 7, '{"resumes":20,"ai_requests_month":200,"exports_month":100,"docx":true,"premium_templates":true}', 2),
  ('PREMIUM',      'Premium',      'SAR', 5900, 42900, null, 7, '{"resumes":null,"ai_requests_month":500,"exports_month":null,"docx":true,"premium_templates":true}', 3)
on conflict (id) do nothing;

insert into public.resume_templates (id, name, category, status, supports_rtl) values
  ('ats-minimal-01', 'ATS Minimal', 'ats_minimal', 'published', true),
  ('modern-pro-01',  'Modern Pro',  'modern',      'published', true),
  ('draft-test-01',  'Draft Test',  'classic',     'draft',     false)
on conflict (id) do nothing;
