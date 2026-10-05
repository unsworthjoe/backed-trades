-- Backed. database, step 12: settings the founders can change, alerts for
-- them, and a log of what admins did.

-- A single row. The engine reads it every time, so changes apply at once.
create table public.app_settings (
  id boolean primary key default true check (id),
  reply_window_minutes integer not null default 120,
  offer_reminder_minutes integer not null default 60,
  working_day_start time not null default '07:00',
  working_day_end time not null default '20:00',
  offers_per_wave integer not null default 3,
  callout_window_minutes integer not null default 30,
  callout_wave_minutes integer not null default 10,
  decline_limit integer not null default 5,
  miss_limit integer not null default 3,
  not_my_kind_limit integer not null default 3,
  default_queue_cap integer not null default 15,
  contact_due_hours integer not null default 24,
  unmatched_alert_hours integer not null default 24,
  signoff_reminder_hours integer[] not null default '{6, 12, 24}',
  auto_close_hours integer not null default 48,
  review_window_days integer not null default 14,
  id_image_retention_days integer not null default 30,
  customer_rating_min_count integer not null default 3,
  low_rating_min_count integer not null default 5,
  low_rating_threshold numeric(3, 2) not null default 3.00,
  updated_at timestamptz not null default now(),
  check (working_day_end > working_day_start)
);

insert into public.app_settings default values;

create trigger app_settings_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();

create type public.admin_alert_kind as enum (
  'job_unmatched', 'no_contact', 'low_customer_rating', 'trade_paused', 'insurance_expiring'
);

create table public.admin_alerts (
  id uuid primary key default gen_random_uuid(),
  kind public.admin_alert_kind not null,
  job_id uuid references public.jobs on delete cascade,
  user_id uuid references public.profiles on delete cascade,
  details jsonb not null default '{}',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users on delete set null
);

create index admin_alerts_open on public.admin_alerts (created_at) where resolved_at is null;

create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  admin_id uuid references auth.users on delete set null,
  action text not null,
  target_table text,
  target_id text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
