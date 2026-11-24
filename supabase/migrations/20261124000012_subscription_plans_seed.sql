-- Plan catalogue is reference data (the app and billing read prices from here), so it ships as a migration, not only as dev seed.
-- Prices are in halalas (SAR minor units). Edit prices by updating these rows; the server always charges the price stored here.
insert into public.subscription_plans (id, name, currency, monthly_price_minor, yearly_price_minor, one_time_download_price_minor, trial_days, limits, sort_order) values
  ('FREE',         'Free',         'SAR', 0,    0,     null, 0, '{"resumes":1,"ai_requests_month":5,"exports_month":2,"docx":false,"premium_templates":false}', 0),
  ('STANDARD',     'Standard',     'SAR', 1900, 15900, 1500, 0, '{"resumes":5,"ai_requests_month":50,"exports_month":20,"docx":true,"premium_templates":false}', 1),
  ('PROFESSIONAL', 'Professional', 'SAR', 3900, 27900, null, 0, '{"resumes":20,"ai_requests_month":200,"exports_month":100,"docx":true,"premium_templates":true}', 2),
  ('PREMIUM',      'Premium',      'SAR', 5900, 42900, null, 0, '{"resumes":null,"ai_requests_month":500,"exports_month":null,"docx":true,"premium_templates":true}', 3)
on conflict (id) do nothing;
