-- =====================================================================
-- Row Level Security
--   * Public (anon) can read the menu, staff, gallery, testimonials and
--     business profile.
--   * Customers (logged in) can read only their own customer row and
--     bookings.
--   * Admins (admin_users) can read/write everything for their business.
--   * Bookings are only ever created through create_booking() (called by
--     the create-booking edge function with the service role), so there
--     are no client INSERT policies on bookings/customers/payments.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper functions (security definer so policies don't recurse through
-- each other's RLS)
-- ---------------------------------------------------------------------
create or replace function public.is_business_admin(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users au
    where au.user_id = auth.uid() and au.business_id = p_business_id
  );
$$;

create or replace function public.owns_customer(p_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.customers c
    where c.id = p_customer_id and c.auth_user_id = auth.uid()
  );
$$;

create or replace function public.is_customer_admin(p_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.bookings b
    join public.admin_users au on au.business_id = b.business_id and au.user_id = auth.uid()
    where b.customer_id = p_customer_id
  );
$$;

create or replace function public.can_view_booking(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.bookings b
    where b.id = p_booking_id
      and (public.is_business_admin(b.business_id) or public.owns_customer(b.customer_id))
  );
$$;

create or replace function public.is_booking_admin(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.bookings b
    where b.id = p_booking_id and public.is_business_admin(b.business_id)
  );
$$;

create or replace function public.is_staff_admin(p_staff_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff s
    where s.id = p_staff_id and public.is_business_admin(s.business_id)
  );
$$;

-- ---------------------------------------------------------------------
-- Grants (RLS below narrows these down row by row)
-- ---------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant select on
  public.businesses, public.services, public.staff, public.staff_schedules,
  public.gallery_photos, public.testimonials
  to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
-- Customers may only edit their name/email (never phone or auth link).
revoke update on public.customers from authenticated;
grant update (name, email) on public.customers to authenticated;

-- ---------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------
alter table public.businesses        enable row level security;
alter table public.services          enable row level security;
alter table public.staff             enable row level security;
alter table public.staff_schedules   enable row level security;
alter table public.staff_time_off    enable row level security;
alter table public.customers         enable row level security;
alter table public.bookings          enable row level security;
alter table public.booking_services  enable row level security;
alter table public.payments          enable row level security;
alter table public.notifications_log enable row level security;
alter table public.admin_users       enable row level security;
alter table public.gallery_photos    enable row level security;
alter table public.testimonials      enable row level security;

-- businesses -----------------------------------------------------------
create policy "businesses: public read" on public.businesses
  for select to anon, authenticated using (true);
create policy "businesses: admin update" on public.businesses
  for update to authenticated
  using (public.is_business_admin(id)) with check (public.is_business_admin(id));

-- services -------------------------------------------------------------
create policy "services: public read active" on public.services
  for select to anon, authenticated
  using (is_active or public.is_business_admin(business_id));
create policy "services: admin insert" on public.services
  for insert to authenticated with check (public.is_business_admin(business_id));
create policy "services: admin update" on public.services
  for update to authenticated
  using (public.is_business_admin(business_id)) with check (public.is_business_admin(business_id));
create policy "services: admin delete" on public.services
  for delete to authenticated using (public.is_business_admin(business_id));

-- staff ----------------------------------------------------------------
create policy "staff: public read active" on public.staff
  for select to anon, authenticated
  using (is_active or public.is_business_admin(business_id));
create policy "staff: admin insert" on public.staff
  for insert to authenticated with check (public.is_business_admin(business_id));
create policy "staff: admin update" on public.staff
  for update to authenticated
  using (public.is_business_admin(business_id)) with check (public.is_business_admin(business_id));
create policy "staff: admin delete" on public.staff
  for delete to authenticated using (public.is_business_admin(business_id));

-- staff_schedules ------------------------------------------------------
create policy "staff_schedules: public read" on public.staff_schedules
  for select to anon, authenticated using (true);
create policy "staff_schedules: admin insert" on public.staff_schedules
  for insert to authenticated with check (public.is_staff_admin(staff_id));
create policy "staff_schedules: admin update" on public.staff_schedules
  for update to authenticated
  using (public.is_staff_admin(staff_id)) with check (public.is_staff_admin(staff_id));
create policy "staff_schedules: admin delete" on public.staff_schedules
  for delete to authenticated using (public.is_staff_admin(staff_id));

-- staff_time_off (private: reasons may be personal) --------------------
create policy "staff_time_off: admin read" on public.staff_time_off
  for select to authenticated using (public.is_staff_admin(staff_id));
create policy "staff_time_off: admin insert" on public.staff_time_off
  for insert to authenticated with check (public.is_staff_admin(staff_id));
create policy "staff_time_off: admin update" on public.staff_time_off
  for update to authenticated
  using (public.is_staff_admin(staff_id)) with check (public.is_staff_admin(staff_id));
create policy "staff_time_off: admin delete" on public.staff_time_off
  for delete to authenticated using (public.is_staff_admin(staff_id));

-- customers ------------------------------------------------------------
create policy "customers: own or admin read" on public.customers
  for select to authenticated
  using (auth_user_id = auth.uid() or public.is_customer_admin(id));
create policy "customers: own or admin update" on public.customers
  for update to authenticated
  using (auth_user_id = auth.uid() or public.is_customer_admin(id))
  with check (auth_user_id = auth.uid() or public.is_customer_admin(id));

-- bookings -------------------------------------------------------------
create policy "bookings: own or admin read" on public.bookings
  for select to authenticated
  using (public.owns_customer(customer_id) or public.is_business_admin(business_id));
create policy "bookings: admin update" on public.bookings
  for update to authenticated
  using (public.is_business_admin(business_id)) with check (public.is_business_admin(business_id));
create policy "bookings: admin delete" on public.bookings
  for delete to authenticated using (public.is_business_admin(business_id));

-- booking_services -----------------------------------------------------
create policy "booking_services: visible with booking" on public.booking_services
  for select to authenticated using (public.can_view_booking(booking_id));

-- payments -------------------------------------------------------------
create policy "payments: visible with booking" on public.payments
  for select to authenticated using (public.can_view_booking(booking_id));
create policy "payments: admin update" on public.payments
  for update to authenticated
  using (public.is_booking_admin(booking_id)) with check (public.is_booking_admin(booking_id));

-- notifications_log ----------------------------------------------------
create policy "notifications_log: admin read" on public.notifications_log
  for select to authenticated using (public.is_booking_admin(booking_id));

-- admin_users ----------------------------------------------------------
create policy "admin_users: read own membership" on public.admin_users
  for select to authenticated using (user_id = auth.uid());

-- gallery_photos -------------------------------------------------------
create policy "gallery_photos: public read" on public.gallery_photos
  for select to anon, authenticated using (true);
create policy "gallery_photos: admin insert" on public.gallery_photos
  for insert to authenticated with check (public.is_business_admin(business_id));
create policy "gallery_photos: admin update" on public.gallery_photos
  for update to authenticated
  using (public.is_business_admin(business_id)) with check (public.is_business_admin(business_id));
create policy "gallery_photos: admin delete" on public.gallery_photos
  for delete to authenticated using (public.is_business_admin(business_id));

-- testimonials ---------------------------------------------------------
create policy "testimonials: public read published" on public.testimonials
  for select to anon, authenticated
  using (is_published or public.is_business_admin(business_id));
create policy "testimonials: admin insert" on public.testimonials
  for insert to authenticated with check (public.is_business_admin(business_id));
create policy "testimonials: admin update" on public.testimonials
  for update to authenticated
  using (public.is_business_admin(business_id)) with check (public.is_business_admin(business_id));
create policy "testimonials: admin delete" on public.testimonials
  for delete to authenticated using (public.is_business_admin(business_id));
