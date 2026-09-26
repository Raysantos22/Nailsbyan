-- =====================================================================
-- Booking logic lives in Postgres so it is atomic and identical no matter
-- who calls it (edge function, admin dashboard, tests).
--
-- Public:   get_available_slots, get_available_dates, get_booking_by_reference
-- Service:  create_booking            (only via the create-booking edge function)
-- Customer: get_my_bookings, cancel_my_booking
-- Admin:    admin_list_bookings, admin_confirm_payment, admin_set_booking_status,
--           admin_stats
-- System:   expire_unpaid_bookings    (pg_cron / scheduled edge function)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Is a booking currently holding its slot? Pending bookings stop
-- holding it once they pass the business's pending_expiry_hours, even
-- before the cron job has flipped them to "cancelled".
-- ---------------------------------------------------------------------
create or replace function public._booking_holds_slot(
  p_status public.booking_status, p_created_at timestamptz, p_expiry_hours int)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_status = 'confirmed'
      or (p_status = 'pending' and p_created_at >= now() - make_interval(hours => p_expiry_hours));
$$;

-- ---------------------------------------------------------------------
-- Auto-expire unpaid bookings (default 24h). Returns number cancelled.
-- ---------------------------------------------------------------------
create or replace function public.expire_unpaid_bookings()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  update public.bookings b
     set status = 'cancelled',
         cancelled_reason = 'Auto-cancelled: deposit not confirmed within '
                            || biz.pending_expiry_hours || ' hours'
    from public.businesses biz
   where biz.id = b.business_id
     and b.status = 'pending'
     and b.created_at < now() - make_interval(hours => biz.pending_expiry_hours);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Same, for one staff member only (used under that staff member's lock so
-- a stale pending booking can't block a new one via the exclusion constraint).
create or replace function public._expire_stale_for_staff(p_staff_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.bookings b
     set status = 'cancelled',
         cancelled_reason = 'Auto-cancelled: deposit not confirmed within '
                            || biz.pending_expiry_hours || ' hours'
    from public.businesses biz
   where biz.id = b.business_id
     and b.staff_id = p_staff_id
     and b.status = 'pending'
     and b.created_at < now() - make_interval(hours => biz.pending_expiry_hours);
$$;

-- ---------------------------------------------------------------------
-- Validate a list of service ids for a business and return them in the
-- order given. Raises a friendly error (hint = invalid_services) if the
-- selection is not bookable.
-- ---------------------------------------------------------------------
create or replace function public._validate_services(p_business_id uuid, p_service_ids uuid[])
returns table (service_id uuid, name text, price numeric, duration_minutes int, is_addon boolean, pos int)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_requested int;
  v_found int;
  v_main int;
begin
  if p_service_ids is null or cardinality(p_service_ids) = 0 then
    raise exception 'Please choose at least one service.' using hint = 'invalid_services';
  end if;
  if cardinality(p_service_ids) > 10 then
    raise exception 'Please choose at most 10 services per booking.' using hint = 'invalid_services';
  end if;

  select count(distinct x) into v_requested from unnest(p_service_ids) as x;
  if v_requested <> cardinality(p_service_ids) then
    raise exception 'The same service was selected twice.' using hint = 'invalid_services';
  end if;

  select count(*), count(*) filter (where not s.is_addon)
    into v_found, v_main
    from public.services s
   where s.id = any(p_service_ids) and s.business_id = p_business_id and s.is_active;

  if v_found <> v_requested then
    raise exception 'One or more selected services are no longer available.' using hint = 'invalid_services';
  end if;
  if v_main = 0 then
    raise exception 'Add-ons must be booked together with a main service.' using hint = 'invalid_services';
  end if;
  if exists (
    select 1 from public.services s
     where s.id = any(p_service_ids)
       and s.parent_service_id is not null
       and not (s.parent_service_id = any(p_service_ids))
  ) then
    raise exception 'An add-on was selected without the service it belongs to.' using hint = 'invalid_services';
  end if;

  return query
    select s.id, s.name, s.price, s.duration_minutes, s.is_addon, u.ord::int
      from unnest(p_service_ids) with ordinality as u(id, ord)
      join public.services s on s.id = u.id
     order by u.ord;
end;
$$;

-- ---------------------------------------------------------------------
-- Every free (staff, start, end) slot of p_duration minutes on a local
-- date: staff_schedules for that weekday, stepped by slot_interval_minutes,
-- minus active bookings and time off, within the booking window and
-- respecting the minimum notice.
-- ---------------------------------------------------------------------
create or replace function public._free_staff_slots(
  p_business_id uuid, p_duration int, p_date date, p_staff_id uuid default null)
returns table (staff_id uuid, slot_start timestamptz, slot_end timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with biz as (
    select b.*, (now() at time zone b.timezone)::date as today_local
      from public.businesses b
     where b.id = p_business_id
  ),
  sched as (
    select s.id as staff_id, ss.start_time, ss.end_time
      from public.staff s
      join public.staff_schedules ss on ss.staff_id = s.id
     where s.business_id = p_business_id
       and s.is_active
       and (p_staff_id is null or s.id = p_staff_id)
       and ss.day_of_week = extract(dow from p_date)::int
  ),
  cand as (
    select sc.staff_id,
           (gs at time zone biz.timezone) as slot_start,
           ((gs + make_interval(mins => p_duration)) at time zone biz.timezone) as slot_end
      from sched sc
     cross join biz
     cross join lateral generate_series(
            p_date + sc.start_time,
            p_date + sc.end_time - make_interval(mins => p_duration),
            make_interval(mins => biz.slot_interval_minutes)) as gs
     where p_duration > 0
       and p_date between biz.today_local and biz.today_local + biz.booking_window_days
  )
  select c.staff_id, c.slot_start, c.slot_end
    from cand c
   cross join biz
   where c.slot_start >= now() + make_interval(hours => biz.min_notice_hours)
     and not exists (
       select 1 from public.bookings bk
        where bk.staff_id = c.staff_id
          and public._booking_holds_slot(bk.status, bk.created_at, biz.pending_expiry_hours)
          and tstzrange(bk.start_time, bk.end_time, '[)') && tstzrange(c.slot_start, c.slot_end, '[)')
     )
     and not exists (
       select 1 from public.staff_time_off t
        where t.staff_id = c.staff_id
          and tstzrange(t.starts_at, t.ends_at, '[)') && tstzrange(c.slot_start, c.slot_end, '[)')
     );
$$;

-- ---------------------------------------------------------------------
-- PUBLIC: available start times for a set of services on a local date.
-- staff_ids lists who is free at that time (used for "any available").
-- ---------------------------------------------------------------------
create or replace function public.get_available_slots(
  p_business_id uuid, p_service_ids uuid[], p_date date, p_staff_id uuid default null)
returns table (slot_start timestamptz, slot_end timestamptz, staff_ids uuid[])
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_duration int;
begin
  select sum(v.duration_minutes)::int into v_duration
    from public._validate_services(p_business_id, p_service_ids) v;

  return query
    select f.slot_start, f.slot_end, array_agg(f.staff_id order by f.staff_id)
      from public._free_staff_slots(p_business_id, v_duration, p_date, p_staff_id) f
     group by f.slot_start, f.slot_end
     order by f.slot_start;
end;
$$;

-- ---------------------------------------------------------------------
-- PUBLIC: how many start times are open on each date in a range
-- (used to grey out fully-booked / closed days in the date picker).
-- ---------------------------------------------------------------------
create or replace function public.get_available_dates(
  p_business_id uuid, p_service_ids uuid[], p_from date, p_to date, p_staff_id uuid default null)
returns table (day date, slot_count int)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_duration int;
begin
  if p_to < p_from or p_to - p_from > 92 then
    raise exception 'Date range too large.' using hint = 'invalid_input';
  end if;

  select sum(v.duration_minutes)::int into v_duration
    from public._validate_services(p_business_id, p_service_ids) v;

  return query
    select d::date,
           (select count(distinct f.slot_start)::int
              from public._free_staff_slots(p_business_id, v_duration, d::date, p_staff_id) f)
      from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') as d
     order by 1;
end;
$$;

-- ---------------------------------------------------------------------
-- Shape of a booking returned to customers / the confirmation screen.
-- ---------------------------------------------------------------------
create or replace function public._booking_json(p_booking_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'booking_id',      b.id,
    'reference',       b.reference,
    'status',          b.status,
    'start_time',      b.start_time,
    'end_time',        b.end_time,
    'total_price',     b.total_price,
    'total_duration',  b.total_duration,
    'notes',           b.notes,
    'created_at',      b.created_at,
    'expires_at',      case when b.status = 'pending'
                            then b.created_at + make_interval(hours => biz.pending_expiry_hours) end,
    'staff_id',        b.staff_id,
    'staff_name',      st.name,
    'customer_name',   b.customer_name,
    'currency',        biz.currency,
    'deposit_amount',  p.amount_expected,
    'payment_status',  p.status,
    'services', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'service_id', bs.service_id, 'name', bs.service_name,
                 'price', bs.price, 'duration_minutes', bs.duration_minutes)
               order by bs.position)
          from public.booking_services bs where bs.booking_id = b.id), '[]'::jsonb)
  )
  from public.bookings b
  join public.businesses biz on biz.id = b.business_id
  left join public.staff st on st.id = b.staff_id
  left join public.payments p on p.booking_id = b.id
  where b.id = p_booking_id;
$$;

-- ---------------------------------------------------------------------
-- SERVICE ROLE ONLY: create a booking atomically.
--   1. validate input + services
--   2. cap unpaid bookings per phone number (anti-spam)
--   3. find staff free at p_start (specific staff, or least-busy that day)
--   4. take a per-staff advisory lock, expire that staff member's stale
--      pending bookings and re-check (race-safe); the bookings_no_overlap
--      exclusion constraint is the final backstop
--   5. find/create the customer, insert booking (with a contact snapshot)
--      + lines + payment row
-- ---------------------------------------------------------------------
create or replace function public.create_booking(
  p_business_id      uuid,
  p_service_ids      uuid[],
  p_start            timestamptz,
  p_customer_name    text,
  p_customer_phone   text,
  p_customer_email   text default null,
  p_notes            text default null,
  p_staff_id         uuid default null,
  p_auth_user_id     uuid default null,
  p_facebook_user_id text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  biz          public.businesses;
  v_name       text := btrim(coalesce(p_customer_name, ''));
  v_phone      text := btrim(coalesce(p_customer_phone, ''));
  v_email      text := nullif(lower(btrim(coalesce(p_customer_email, ''))), '');
  v_notes      text := nullif(btrim(coalesce(p_notes, '')), '');
  v_duration   int;
  v_total      numeric;
  v_first      uuid;
  v_local_date date;
  v_end        timestamptz;
  v_candidate  uuid;
  v_staff      uuid;
  v_customer   uuid;
  v_booking_id uuid;
  v_phone_norm text;
begin
  select * into biz from public.businesses where id = p_business_id;
  if not found then
    raise exception 'Business not found.' using hint = 'not_found';
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 100 then
    raise exception 'Please enter your name.' using hint = 'invalid_input';
  end if;
  if char_length(regexp_replace(v_phone, '[^0-9]', '', 'g')) not between 7 and 15
     or char_length(v_phone) > 30 then
    raise exception 'Please enter a valid phone number.' using hint = 'invalid_input';
  end if;
  if v_email is not null and (v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254) then
    raise exception 'Please enter a valid email address.' using hint = 'invalid_input';
  end if;
  if v_notes is not null and char_length(v_notes) > 1000 then
    raise exception 'Notes are too long (max 1000 characters).' using hint = 'invalid_input';
  end if;
  if p_start is null then
    raise exception 'Please choose a time.' using hint = 'invalid_input';
  end if;

  v_phone_norm := regexp_replace(v_phone, '[^0-9]', '', 'g');
  if (select count(*) from public.bookings b
       where b.business_id = p_business_id
         and b.status = 'pending'
         and b.start_time > now()
         and public._booking_holds_slot(b.status, b.created_at, biz.pending_expiry_hours)
         and regexp_replace(b.customer_phone, '[^0-9]', '', 'g') = v_phone_norm) >= 3 then
    raise exception 'You already have 3 unpaid bookings. Please send your deposit or message us before booking more.'
      using hint = 'too_many_pending';
  end if;

  select sum(v.duration_minutes)::int, sum(v.price), (array_agg(v.service_id order by v.pos))[1]
    into v_duration, v_total, v_first
    from public._validate_services(p_business_id, p_service_ids) v;

  v_local_date := (p_start at time zone biz.timezone)::date;
  v_end := p_start + make_interval(mins => v_duration);

  -- Candidates free at exactly this start time, least-busy first.
  for v_candidate in
    select f.staff_id
      from public._free_staff_slots(p_business_id, v_duration, v_local_date, p_staff_id) f
     where f.slot_start = p_start
     order by (select count(*) from public.bookings b2
                where b2.staff_id = f.staff_id
                  and b2.status in ('pending', 'confirmed')
                  and (b2.start_time at time zone biz.timezone)::date = v_local_date),
              f.staff_id
  loop
    perform pg_advisory_xact_lock(hashtextextended('booking-staff:' || v_candidate::text, 0));
    perform public._expire_stale_for_staff(v_candidate);
    -- Re-check now that we hold the lock (another booking may have just committed).
    if exists (
      select 1 from public._free_staff_slots(p_business_id, v_duration, v_local_date, v_candidate) f
       where f.slot_start = p_start
    ) then
      v_staff := v_candidate;
      exit;
    end if;
  end loop;

  if v_staff is null then
    raise exception 'Sorry, that time is no longer available. Please choose another time.'
      using hint = 'slot_unavailable';
  end if;

  -- Logged-in customers have their own row (never an existing guest row
  -- matched by phone). Guests share one row per phone number, and an
  -- anonymous booking never overwrites that row's details — the details
  -- typed for this booking are snapshotted on the booking itself.
  if p_auth_user_id is not null then
    select c.id into v_customer from public.customers c where c.auth_user_id = p_auth_user_id;
    if v_customer is null then
      insert into public.customers (name, phone, email, auth_user_id, facebook_user_id)
      values (v_name, v_phone, v_email, p_auth_user_id, p_facebook_user_id)
      returning id into v_customer;
    else
      update public.customers c
         set email = coalesce(c.email, v_email),
             facebook_user_id = coalesce(c.facebook_user_id, p_facebook_user_id)
       where c.id = v_customer;
    end if;
  else
    insert into public.customers as c (name, phone, email)
    values (v_name, v_phone, v_email)
    on conflict (phone_normalized) where auth_user_id is null
    do update set email = coalesce(c.email, excluded.email)
    returning c.id into v_customer;
  end if;

  begin
    insert into public.bookings
      (business_id, service_id, staff_id, customer_id, customer_name, customer_phone, customer_email,
       start_time, end_time, status, notes, total_price, total_duration)
    values
      (p_business_id, v_first, v_staff, v_customer, v_name, v_phone, v_email,
       p_start, v_end, 'pending', v_notes, v_total, v_duration)
    returning id into v_booking_id;
  exception when exclusion_violation then
    raise exception 'Sorry, that time is no longer available. Please choose another time.'
      using hint = 'slot_unavailable';
  end;

  insert into public.booking_services (booking_id, service_id, service_name, price, duration_minutes, position)
  select v_booking_id, v.service_id, v.name, v.price, v.duration_minutes, v.pos
    from public._validate_services(p_business_id, p_service_ids) v;

  insert into public.payments (booking_id, status, method, amount_expected)
  values (v_booking_id, 'awaiting_proof', biz.payment_method_label, least(biz.deposit_amount, v_total));

  return public._booking_json(v_booking_id);
end;
$$;

-- ---------------------------------------------------------------------
-- PUBLIC: guests can look a booking up again with reference + phone
-- (e.g. to see the payment QR again).
-- ---------------------------------------------------------------------
create or replace function public.get_booking_by_reference(p_reference text, p_phone text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public._booking_json(b.id)
    from public.bookings b
   where b.reference = upper(btrim(p_reference))
     and char_length(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')) >= 7
     and regexp_replace(b.customer_phone, '[^0-9]', '', 'g')
         = regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
$$;

-- ---------------------------------------------------------------------
-- CUSTOMER (logged in): my bookings, newest first.
-- ---------------------------------------------------------------------
create or replace function public.get_my_bookings()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(public._booking_json(b.id) order by b.start_time desc), '[]'::jsonb)
    from public.bookings b
    join public.customers c on c.id = b.customer_id
   where auth.uid() is not null and c.auth_user_id = auth.uid();
$$;

-- CUSTOMER: cancel an unpaid (pending) booking of their own.
create or replace function public.cancel_my_booking(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.booking_status;
begin
  select b.status into v_status
    from public.bookings b
    join public.customers c on c.id = b.customer_id
   where b.id = p_booking_id and auth.uid() is not null and c.auth_user_id = auth.uid()
   for update of b;
  if not found then
    raise exception 'Booking not found.' using hint = 'not_found';
  end if;
  if v_status <> 'pending' then
    raise exception 'This booking is already confirmed — please message us to cancel or reschedule.'
      using hint = 'invalid_status';
  end if;
  update public.bookings
     set status = 'cancelled', cancelled_reason = 'Cancelled by customer'
   where id = p_booking_id;
  return public._booking_json(p_booking_id);
end;
$$;

-- ---------------------------------------------------------------------
-- ADMIN helpers
-- ---------------------------------------------------------------------
create or replace function public._require_booking_admin(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found.' using hint = 'not_found';
  end if;
  if not public.is_business_admin(v_booking.business_id) then
    raise exception 'Not authorised.' using errcode = '42501';
  end if;
  return v_booking;
end;
$$;

-- ADMIN: list bookings in a time range with everything the dashboard needs.
create or replace function public.admin_list_bookings(
  p_business_id uuid,
  p_from        timestamptz,
  p_to          timestamptz,
  p_staff_id    uuid default null,
  p_status      public.booking_status default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.is_business_admin(p_business_id) then
    raise exception 'Not authorised.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(row_json order by start_time), '[]'::jsonb)
    into v_result
    from (
      select b.start_time,
             jsonb_build_object(
               'id',               b.id,
               'reference',        b.reference,
               'status',           b.status,
               'start_time',       b.start_time,
               'end_time',         b.end_time,
               'total_price',      b.total_price,
               'total_duration',   b.total_duration,
               'notes',            b.notes,
               'cancelled_reason', b.cancelled_reason,
               'confirmed_at',     b.confirmed_at,
               'created_at',       b.created_at,
               'expires_at',       case when b.status = 'pending'
                                        then b.created_at + make_interval(hours => biz.pending_expiry_hours) end,
               'staff',            case when st.id is null then null
                                        else jsonb_build_object('id', st.id, 'name', st.name) end,
               'customer',         jsonb_build_object('id', c.id, 'name', b.customer_name, 'phone', b.customer_phone,
                                                      'email', b.customer_email, 'facebook_user_id', c.facebook_user_id),
               'payment',          case when p.id is null then null
                                        else jsonb_build_object('status', p.status, 'method', p.method,
                                               'amount_expected', p.amount_expected,
                                               'reference_note', p.reference_note,
                                               'received_at', p.received_at) end,
               'services', coalesce((
                   select jsonb_agg(jsonb_build_object('name', bs.service_name, 'price', bs.price,
                                                       'duration_minutes', bs.duration_minutes)
                                    order by bs.position)
                     from public.booking_services bs where bs.booking_id = b.id), '[]'::jsonb),
               'notifications', coalesce((
                   select jsonb_agg(jsonb_build_object('channel', n.channel, 'status', n.status,
                                                       'sent_at', n.sent_at, 'error', n.error)
                                    order by n.sent_at desc)
                     from public.notifications_log n where n.booking_id = b.id), '[]'::jsonb)
             ) as row_json
        from public.bookings b
        join public.businesses biz on biz.id = b.business_id
        join public.customers c on c.id = b.customer_id
        left join public.staff st on st.id = b.staff_id
        left join public.payments p on p.booking_id = b.id
       where b.business_id = p_business_id
         and b.start_time >= p_from
         and b.start_time < p_to
         and (p_staff_id is null or b.staff_id = p_staff_id)
         and (p_status is null or b.status = p_status)
    ) as r;

  return v_result;
end;
$$;

-- ADMIN: owner has seen the deposit arrive → confirm booking + payment.
-- Also reinstates a booking that was AUTO-cancelled for late payment, as
-- long as it is still in the future, has a staff member and the slot is
-- still free (no other booking, no time off).
create or replace function public.admin_confirm_payment(p_booking_id uuid, p_reference_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
begin
  v_booking := public._require_booking_admin(p_booking_id);

  if v_booking.status = 'cancelled' then
    if coalesce(v_booking.cancelled_reason, '') not like 'Auto-cancelled%' then
      raise exception 'Only bookings that were auto-cancelled for late payment can be reinstated.'
        using hint = 'invalid_status';
    end if;
    if v_booking.start_time <= now() then
      raise exception 'This appointment time has already passed.' using hint = 'invalid_status';
    end if;
    if v_booking.staff_id is null then
      raise exception 'This booking no longer has a staff member — please rebook it.' using hint = 'slot_unavailable';
    end if;
    perform pg_advisory_xact_lock(hashtextextended('booking-staff:' || v_booking.staff_id::text, 0));
    perform public._expire_stale_for_staff(v_booking.staff_id);
    if exists (
      select 1 from public.staff_time_off t
       where t.staff_id = v_booking.staff_id
         and tstzrange(t.starts_at, t.ends_at, '[)') && tstzrange(v_booking.start_time, v_booking.end_time, '[)')
    ) then
      raise exception 'The staff member now has time off at that time.' using hint = 'slot_unavailable';
    end if;
  elsif v_booking.status <> 'pending' then
    raise exception 'Only pending (or auto-expired) bookings can be confirmed.' using hint = 'invalid_status';
  end if;

  begin
    update public.bookings
       set status = 'confirmed', confirmed_at = now(), cancelled_reason = null
     where id = p_booking_id;
  exception when exclusion_violation then
    raise exception 'That time slot has since been taken by another booking.' using hint = 'slot_unavailable';
  end;

  insert into public.payments (booking_id, status, received_at, reference_note)
  values (p_booking_id, 'received', now(), nullif(btrim(coalesce(p_reference_note, '')), ''))
  on conflict (booking_id) do update set
    status = 'received',
    received_at = now(),
    reference_note = coalesce(excluded.reference_note, public.payments.reference_note);

  return public._booking_json(p_booking_id);
end;
$$;

-- ADMIN: cancel / mark completed / mark no-show.
create or replace function public.admin_set_booking_status(
  p_booking_id uuid, p_status public.booking_status, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
begin
  v_booking := public._require_booking_admin(p_booking_id);

  if p_status in ('pending', 'confirmed') then
    raise exception 'Use Confirm Payment to confirm a booking.' using hint = 'invalid_status';
  end if;
  if p_status = 'cancelled' and v_booking.status not in ('pending', 'confirmed') then
    raise exception 'Only pending or confirmed bookings can be cancelled.' using hint = 'invalid_status';
  end if;
  if p_status in ('completed', 'no_show') and v_booking.status not in ('confirmed', 'completed', 'no_show') then
    raise exception 'Only confirmed bookings can be marked completed or no-show.' using hint = 'invalid_status';
  end if;

  update public.bookings
     set status = p_status,
         cancelled_reason = case when p_status = 'cancelled'
                                 then coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'Cancelled by salon')
                                 else cancelled_reason end
   where id = p_booking_id;

  return public._booking_json(p_booking_id);
end;
$$;

-- ADMIN: dashboard numbers (in the business's local time).
--   bookings_this_week  : non-cancelled bookings starting Mon–Sun this week
--   revenue_this_month  : total_price of confirmed + completed bookings this month
create or replace function public.admin_stats(p_business_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  biz         public.businesses;
  v_local_now timestamp;
  v_week_from timestamptz;
  v_week_to   timestamptz;
  v_month_from timestamptz;
  v_month_to  timestamptz;
  v_day_from  timestamptz;
  v_day_to    timestamptz;
begin
  if not public.is_business_admin(p_business_id) then
    raise exception 'Not authorised.' using errcode = '42501';
  end if;
  select * into biz from public.businesses where id = p_business_id;

  v_local_now  := now() at time zone biz.timezone;
  v_week_from  := date_trunc('week', v_local_now) at time zone biz.timezone;
  v_week_to    := (date_trunc('week', v_local_now) + interval '7 days') at time zone biz.timezone;
  v_month_from := date_trunc('month', v_local_now) at time zone biz.timezone;
  v_month_to   := (date_trunc('month', v_local_now) + interval '1 month') at time zone biz.timezone;
  v_day_from   := date_trunc('day', v_local_now) at time zone biz.timezone;
  v_day_to     := (date_trunc('day', v_local_now) + interval '1 day') at time zone biz.timezone;

  return jsonb_build_object(
    'currency', biz.currency,
    'bookings_this_week', (
      select count(*) from public.bookings b
       where b.business_id = p_business_id and b.status <> 'cancelled'
         and b.start_time >= v_week_from and b.start_time < v_week_to),
    'revenue_this_month', (
      select coalesce(sum(b.total_price), 0) from public.bookings b
       where b.business_id = p_business_id and b.status in ('confirmed', 'completed')
         and b.start_time >= v_month_from and b.start_time < v_month_to),
    'deposits_received_this_month', (
      select coalesce(sum(p.amount_expected), 0) from public.payments p
        join public.bookings b on b.id = p.booking_id
       where b.business_id = p_business_id and p.status = 'received'
         and p.received_at >= v_month_from and p.received_at < v_month_to),
    'pending_count', (
      select count(*) from public.bookings b
       where b.business_id = p_business_id and b.status = 'pending'),
    'today_count', (
      select count(*) from public.bookings b
       where b.business_id = p_business_id and b.status in ('pending', 'confirmed', 'completed')
         and b.start_time >= v_day_from and b.start_time < v_day_to),
    'no_shows_this_month', (
      select count(*) from public.bookings b
       where b.business_id = p_business_id and b.status = 'no_show'
         and b.start_time >= v_month_from and b.start_time < v_month_to)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- When a booking becomes "confirmed", ask the send-confirmation edge
-- function to notify the customer (via pg_net). Needs two Vault secrets:
--   project_url            e.g. https://<ref>.supabase.co
--   notify_webhook_secret  a random string; set the SAME value as the edge
--                          function secret NOTIFY_WEBHOOK_SECRET
-- Missing pg_net / secrets never block the confirmation itself; the admin
-- dashboard also has a "Resend confirmation" button.
-- ---------------------------------------------------------------------
create or replace function public.notify_booking_confirmed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if new.status = 'confirmed' and old.status is distinct from 'confirmed' then
    begin
      if to_regclass('vault.decrypted_secrets') is not null
         and exists (select 1 from pg_catalog.pg_proc p
                       join pg_catalog.pg_namespace n on n.oid = p.pronamespace
                      where n.nspname = 'net' and p.proname = 'http_post') then
        execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1'
          into v_url using 'project_url';
        execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1'
          into v_secret using 'notify_webhook_secret';
        if v_url is not null and v_secret is not null then
          execute 'select net.http_post(url := $1, body := $2, headers := $3)'
            using rtrim(v_url, '/') || '/functions/v1/send-confirmation',
                  jsonb_build_object('booking_id', new.id),
                  jsonb_build_object('Content-Type', 'application/json',
                                     'x-webhook-secret', v_secret);
        else
          raise warning 'notify_booking_confirmed: vault secrets project_url / notify_webhook_secret not set';
        end if;
      end if;
    exception when others then
      raise warning 'notify_booking_confirmed failed: %', sqlerrm;
    end;
  end if;
  return new;
end;
$$;

create trigger bookings_notify_confirmed
  after update of status on public.bookings
  for each row execute function public.notify_booking_confirmed();

-- ---------------------------------------------------------------------
-- ADMIN: replace a staff member's weekly schedule in one transaction.
-- p_rows: [{"day_of_week": 1, "start_time": "09:00", "end_time": "18:00"}, …]
-- ---------------------------------------------------------------------
create or replace function public.admin_replace_staff_schedule(p_staff_id uuid, p_rows jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_staff_admin(p_staff_id) then
    raise exception 'Not authorised.' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_rows, '[]'::jsonb)) <> 'array' then
    raise exception 'Invalid schedule.' using hint = 'invalid_input';
  end if;
  delete from public.staff_schedules where staff_id = p_staff_id;
  insert into public.staff_schedules (staff_id, day_of_week, start_time, end_time)
  select p_staff_id, (r->>'day_of_week')::smallint, (r->>'start_time')::time, (r->>'end_time')::time
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) as r;
end;
$$;

-- ---------------------------------------------------------------------
-- Function privileges: Postgres grants EXECUTE to PUBLIC by default, so
-- revoke everything and grant back only what each role needs.
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.get_available_slots(uuid, uuid[], date, uuid) to anon, authenticated;
grant execute on function public.get_available_dates(uuid, uuid[], date, date, uuid) to anon, authenticated;
grant execute on function public.get_booking_by_reference(text, text) to anon, authenticated;
grant execute on function public.get_my_bookings() to authenticated;
grant execute on function public.cancel_my_booking(uuid) to authenticated;
grant execute on function public.admin_list_bookings(uuid, timestamptz, timestamptz, uuid, public.booking_status) to authenticated;
grant execute on function public.admin_confirm_payment(uuid, text) to authenticated;
grant execute on function public.admin_set_booking_status(uuid, public.booking_status, text) to authenticated;
grant execute on function public.admin_stats(uuid) to authenticated;
grant execute on function public.admin_replace_staff_schedule(uuid, jsonb) to authenticated;
-- RLS helper functions are evaluated inside policies as the calling role.
grant execute on function public.is_business_admin(uuid) to anon, authenticated;
grant execute on function public.owns_customer(uuid) to anon, authenticated;
grant execute on function public.is_customer_admin(uuid) to anon, authenticated;
grant execute on function public.can_view_booking(uuid) to anon, authenticated;
grant execute on function public.is_booking_admin(uuid) to anon, authenticated;
grant execute on function public.is_staff_admin(uuid) to anon, authenticated;
-- Trigger functions run as the table owner; nothing to grant.

grant execute on all functions in schema public to service_role;
