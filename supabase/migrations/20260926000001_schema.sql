-- =====================================================================
-- Nails by An — core schema
-- Tables: businesses, services, staff, staff_schedules, staff_time_off,
--         customers, bookings, booking_services, payments,
--         notifications_log, admin_users, gallery_photos, testimonials
-- =====================================================================

create schema if not exists extensions;
-- Needed for the "no overlapping bookings per staff member" exclusion constraint.
create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type public.booking_status as enum ('pending', 'confirmed', 'cancelled', 'completed', 'no_show');
create type public.payment_status as enum ('awaiting_proof', 'received');
create type public.admin_role as enum ('owner', 'staff');

-- ---------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- businesses
-- ---------------------------------------------------------------------
create table public.businesses (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text not null unique,
  name                  text not null,
  tagline               text,
  description           text,
  address               text,
  phone                 text,
  email                 text,
  -- {"mon": {"open": "09:00", "close": "18:00"}, "sun": null, ...}  (null = closed)
  hours_json            jsonb not null default '{}'::jsonb,
  logo_url              text,
  payment_qr_url        text,
  payment_method_label  text default 'GCash',
  payment_instructions  text,
  facebook_page_url     text,
  -- Page ID or username used for m.me/<id> Messenger links
  messenger_id          text,
  instagram_handle      text,
  timezone              text not null default 'Asia/Manila',
  currency              text not null default 'PHP',
  deposit_amount        numeric(10,2) not null default 0 check (deposit_amount >= 0),
  booking_window_days   int not null default 30 check (booking_window_days between 1 and 365),
  min_notice_hours      int not null default 2 check (min_notice_hours between 0 and 336),
  slot_interval_minutes int not null default 30 check (slot_interval_minutes between 5 and 240),
  pending_expiry_hours  int not null default 24 check (pending_expiry_hours between 1 and 168),
  cancellation_policy   text,
  no_show_policy        text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create trigger businesses_updated_at before update on public.businesses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- services  (add-ons are services with is_addon = true; parent_service_id
-- optionally restricts an add-on to one main service)
-- ---------------------------------------------------------------------
create table public.services (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references public.businesses(id) on delete cascade,
  category           text not null default 'Services',
  name               text not null,
  description        text,
  price              numeric(10,2) not null check (price >= 0),
  duration_minutes   int not null check (duration_minutes > 0 and duration_minutes <= 600),
  is_addon           boolean not null default false,
  parent_service_id  uuid references public.services(id) on delete set null,
  is_active          boolean not null default true,
  sort_order         int not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (parent_service_id is null or is_addon)
);
create index services_business_idx on public.services (business_id, is_active, sort_order);
create trigger services_updated_at before update on public.services
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- staff (people who perform services)
-- ---------------------------------------------------------------------
create table public.staff (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  name         text not null,
  bio          text,
  photo_url    text,
  is_active    boolean not null default true,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index staff_business_idx on public.staff (business_id, is_active);
create trigger staff_updated_at before update on public.staff
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- staff_schedules: weekly working hours (day_of_week 0 = Sunday … 6 = Saturday,
-- times are local to businesses.timezone). Multiple rows per day allowed
-- (e.g. split shifts).
-- ---------------------------------------------------------------------
create table public.staff_schedules (
  id           uuid primary key default gen_random_uuid(),
  staff_id     uuid not null references public.staff(id) on delete cascade,
  day_of_week  smallint not null check (day_of_week between 0 and 6),
  start_time   time not null,
  end_time     time not null,
  check (end_time > start_time)
);
create index staff_schedules_staff_idx on public.staff_schedules (staff_id, day_of_week);

-- ---------------------------------------------------------------------
-- staff_time_off: one-off blocks (holidays, leave, lunch, etc.)
-- ---------------------------------------------------------------------
create table public.staff_time_off (
  id         uuid primary key default gen_random_uuid(),
  staff_id   uuid not null references public.staff(id) on delete cascade,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  reason     text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index staff_time_off_staff_idx on public.staff_time_off (staff_id, starts_at);

-- ---------------------------------------------------------------------
-- customers
--   * Guests are grouped by phone number (one guest row per number).
--   * A logged-in customer (email / Facebook) gets their own row keyed by
--     auth_user_id. A login is never attached to an existing guest row just
--     because the phone matches — that would let anyone who knows a phone
--     number read someone else's bookings.
--   * The contact details used for a booking are snapshotted on bookings.
-- ---------------------------------------------------------------------
create table public.customers (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  phone             text not null,
  -- digits only, used for de-duplication of guest customers
  phone_normalized  text generated always as (regexp_replace(phone, '[^0-9]', '', 'g')) stored,
  email             text,
  facebook_user_id  text,
  auth_user_id      uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index customers_guest_phone_key on public.customers (phone_normalized) where auth_user_id is null;
create unique index customers_auth_user_key on public.customers (auth_user_id) where auth_user_id is not null;
create index customers_phone_idx on public.customers (phone_normalized);
create trigger customers_updated_at before update on public.customers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- bookings
--   service_id  = primary (first) service; full list in booking_services
--   staff_id    = nullable per spec, but create_booking always assigns one
--                 (even for "any available") so overlaps can be enforced.
-- ---------------------------------------------------------------------
create table public.bookings (
  id                uuid primary key default gen_random_uuid(),
  reference         text not null unique
                      default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  business_id       uuid not null references public.businesses(id) on delete cascade,
  service_id        uuid references public.services(id) on delete set null,
  staff_id          uuid references public.staff(id) on delete set null,
  customer_id       uuid not null references public.customers(id) on delete restrict,
  -- contact details as entered for THIS booking (used for notifications)
  customer_name     text not null,
  customer_phone    text not null,
  customer_email    text,
  start_time        timestamptz not null,
  end_time          timestamptz not null,
  status            public.booking_status not null default 'pending',
  notes             text,
  total_price       numeric(10,2) not null default 0,
  total_duration    int not null default 0,
  cancelled_reason  text,
  confirmed_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (end_time > start_time),
  -- Hard guarantee: one staff member can never hold two active bookings
  -- that overlap in time, even under concurrent inserts.
  constraint bookings_no_overlap exclude using gist (
    staff_id with =,
    tstzrange(start_time, end_time, '[)') with &&
  ) where (status in ('pending', 'confirmed'))
);
create index bookings_business_start_idx on public.bookings (business_id, start_time);
create index bookings_staff_start_idx on public.bookings (staff_id, start_time);
create index bookings_customer_idx on public.bookings (customer_id);
create index bookings_customer_phone_idx on public.bookings (regexp_replace(customer_phone, '[^0-9]', '', 'g'));
create index bookings_pending_idx on public.bookings (created_at) where status = 'pending';
create trigger bookings_updated_at before update on public.bookings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- booking_services: every service/add-on in a booking, with the price and
-- duration captured at booking time (menu edits don't rewrite history)
-- ---------------------------------------------------------------------
create table public.booking_services (
  id                uuid primary key default gen_random_uuid(),
  booking_id        uuid not null references public.bookings(id) on delete cascade,
  service_id        uuid references public.services(id) on delete set null,
  service_name      text not null,
  price             numeric(10,2) not null,
  duration_minutes  int not null,
  position          int not null default 0
);
create index booking_services_booking_idx on public.booking_services (booking_id);

-- ---------------------------------------------------------------------
-- payments: manual QR deposits. No money is captured programmatically;
-- a row records that a deposit is expected and whether the owner has
-- seen it arrive.
-- ---------------------------------------------------------------------
create table public.payments (
  id               uuid primary key default gen_random_uuid(),
  booking_id       uuid not null unique references public.bookings(id) on delete cascade,
  status           public.payment_status not null default 'awaiting_proof',
  method           text,
  amount_expected  numeric(10,2) not null default 0,
  reference_note   text,
  received_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- notifications_log
-- ---------------------------------------------------------------------
create table public.notifications_log (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid references public.bookings(id) on delete cascade,
  channel     text not null,             -- email | sms | messenger
  kind        text not null default 'booking_confirmed',
  recipient   text,
  status      text not null,             -- sent | failed | skipped
  error       text,
  sent_at     timestamptz not null default now()
);
create index notifications_log_booking_idx on public.notifications_log (booking_id, channel, kind);

-- ---------------------------------------------------------------------
-- admin_users: which auth users can manage which business
-- ---------------------------------------------------------------------
create table public.admin_users (
  user_id      uuid not null references auth.users(id) on delete cascade,
  business_id  uuid not null references public.businesses(id) on delete cascade,
  role         public.admin_role not null default 'owner',
  created_at   timestamptz not null default now(),
  primary key (user_id, business_id)
);

-- ---------------------------------------------------------------------
-- gallery_photos (files live in the "media" storage bucket)
-- ---------------------------------------------------------------------
create table public.gallery_photos (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses(id) on delete cascade,
  image_url     text not null,
  storage_path  text,
  caption       text,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);
create index gallery_photos_business_idx on public.gallery_photos (business_id, sort_order, created_at desc);

-- ---------------------------------------------------------------------
-- testimonials (shown on the home page)
-- ---------------------------------------------------------------------
create table public.testimonials (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  author_name  text not null,
  body         text not null,
  rating       smallint check (rating between 1 and 5),
  source       text default 'Facebook',
  is_published boolean not null default true,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);
create index testimonials_business_idx on public.testimonials (business_id, is_published, sort_order);
