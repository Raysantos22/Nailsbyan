-- Test fixture for tests/db (a frozen copy of the original sample seed).
-- The booking tests rely on this fixed menu: two staff, 11 services with
-- known durations. Real client data lives in supabase/seed.sql.
-- =====================================================================
-- Seed data for Nails by An.
-- Only the business name and Facebook Page are real client info so far.
-- Everything marked PLACEHOLDER is listed in TODO_FOR_CLIENT.md and must
-- be replaced before launch (most of it can be edited in /admin).
-- Safe to re-run: uses fixed ids + upserts.
-- =====================================================================

insert into public.businesses (
  id, slug, name, tagline, description, address, phone, email, hours_json,
  logo_url, payment_qr_url, payment_method_label, payment_instructions,
  facebook_page_url, messenger_id, instagram_handle, timezone, currency,
  deposit_amount, booking_window_days, min_notice_hours, slot_interval_minutes,
  pending_expiry_hours, cancellation_policy, no_show_policy
) values (
  '11111111-1111-4111-8111-111111111111',
  'nails-by-an',
  'Nails by An',
  'Pretty, long-lasting nails — book your slot in a minute.',                -- PLACEHOLDER
  'Nails by An offers clean, detailed manicures, pedicures, gel and nail art in a relaxed, friendly space.', -- PLACEHOLDER
  'Address to follow (placeholder)',                                           -- PLACEHOLDER
  '+63 900 000 0000',                                                          -- PLACEHOLDER
  'hello@example.com',                                                         -- PLACEHOLDER
  '{"mon":{"open":"09:00","close":"18:00"},"tue":{"open":"09:00","close":"18:00"},"wed":{"open":"09:00","close":"18:00"},"thu":{"open":"09:00","close":"18:00"},"fri":{"open":"09:00","close":"18:00"},"sat":{"open":"09:00","close":"18:00"},"sun":null}', -- PLACEHOLDER
  '/placeholders/logo.svg',                                                    -- PLACEHOLDER
  '/placeholders/payment-qr.svg',                                              -- PLACEHOLDER
  'GCash',                                                                     -- PLACEHOLDER
  'Scan the QR code to pay your deposit, then send a screenshot of your payment (or the reference number) to us on Facebook Messenger with your booking reference. We''ll confirm your slot as soon as we see it.',
  'https://www.facebook.com/profile.php?id=61556891524730',
  '61556891524730',
  null,
  'Asia/Manila',                                                               -- PLACEHOLDER (assumed Philippines — GCash)
  'PHP',                                                                       -- PLACEHOLDER
  200,                                                                         -- PLACEHOLDER deposit
  30,                                                                          -- PLACEHOLDER
  2,                                                                           -- PLACEHOLDER
  30,
  24,
  'Free cancellation or rescheduling up to 24 hours before your appointment. Deposits for later cancellations may not be refunded. (placeholder policy)', -- PLACEHOLDER
  'Missed appointments without notice forfeit the deposit. (placeholder policy)' -- PLACEHOLDER
)
on conflict (id) do update set
  slug = excluded.slug, name = excluded.name, tagline = excluded.tagline,
  description = excluded.description, address = excluded.address, phone = excluded.phone,
  email = excluded.email, hours_json = excluded.hours_json, logo_url = excluded.logo_url,
  payment_qr_url = excluded.payment_qr_url, payment_method_label = excluded.payment_method_label,
  payment_instructions = excluded.payment_instructions, facebook_page_url = excluded.facebook_page_url,
  messenger_id = excluded.messenger_id, timezone = excluded.timezone, currency = excluded.currency,
  deposit_amount = excluded.deposit_amount, booking_window_days = excluded.booking_window_days,
  min_notice_hours = excluded.min_notice_hours, slot_interval_minutes = excluded.slot_interval_minutes,
  pending_expiry_hours = excluded.pending_expiry_hours,
  cancellation_policy = excluded.cancellation_policy, no_show_policy = excluded.no_show_policy;

-- ---------------------------------------------------------------------
-- Services (ALL PLACEHOLDER — names, prices and durations)
-- ---------------------------------------------------------------------
insert into public.services (id, business_id, category, name, description, price, duration_minutes, is_addon, parent_service_id, sort_order) values
  ('22222222-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Manicure',   'Classic Manicure',       'Shape, cuticle care, hand massage and regular polish.',        350,  45, false, null, 10),
  ('22222222-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Manicure',   'Gel Polish Manicure',    'Long-lasting, high-shine gel polish that lasts 2–3 weeks.',    650,  60, false, null, 20),
  ('22222222-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'Pedicure',   'Classic Pedicure',       'Soak, scrub, shaping, cuticle care and regular polish.',       450,  60, false, null, 30),
  ('22222222-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'Pedicure',   'Gel Polish Pedicure',    'Full pedicure finished with chip-free gel polish.',            750,  75, false, null, 40),
  ('22222222-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', 'Pedicure',   'Foot Spa Pedicure',      'Extended soak, exfoliation, mask and massage.',                850,  90, false, null, 50),
  ('22222222-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', 'Extensions', 'Soft Gel Extensions',    'Full set of lightweight soft gel tips with gel polish.',      1200, 120, false, null, 60),
  ('22222222-0000-4000-8000-000000000007', '11111111-1111-4111-8111-111111111111', 'Extensions', 'Polygel Extensions',     'Strong, natural-looking polygel full set.',                   1400, 120, false, null, 70),
  ('22222222-0000-4000-8000-000000000008', '11111111-1111-4111-8111-111111111111', 'Add-ons',    'Nail Art',               'Hand-painted designs, chrome, cat-eye or charms (full set).',  200,  30, true,  null, 80),
  ('22222222-0000-4000-8000-000000000009', '11111111-1111-4111-8111-111111111111', 'Add-ons',    'Gel / Extension Removal','Safe removal of existing gel or extensions.',                  150,  20, true,  null, 90),
  ('22222222-0000-4000-8000-000000000010', '11111111-1111-4111-8111-111111111111', 'Add-ons',    'French Tips',            'Classic or coloured French tips.',                             150,  15, true,  null, 100),
  ('22222222-0000-4000-8000-000000000011', '11111111-1111-4111-8111-111111111111', 'Add-ons',    'Paraffin Hand Treatment','Warm paraffin wax for soft, hydrated hands.',                  250,  15, true,  null, 110)
on conflict (id) do update set
  category = excluded.category, name = excluded.name, description = excluded.description,
  price = excluded.price, duration_minutes = excluded.duration_minutes, is_addon = excluded.is_addon,
  parent_service_id = excluded.parent_service_id, sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------
-- Staff (PLACEHOLDER — "An" assumed to be the owner/nail tech; the second
-- tech exists only to demonstrate "any available". Rename or deactivate.)
-- ---------------------------------------------------------------------
insert into public.staff (id, business_id, name, bio, photo_url, is_active, sort_order) values
  ('33333333-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'An',
   'Owner and lead nail artist.', '/placeholders/staff-1.svg', true, 1),
  ('33333333-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Nail Tech 2 (placeholder)',
   'Placeholder team member — rename or deactivate in Admin → Staff.', '/placeholders/staff-2.svg', true, 2)
on conflict (id) do update set
  name = excluded.name, bio = excluded.bio, photo_url = excluded.photo_url,
  is_active = excluded.is_active, sort_order = excluded.sort_order;

-- Schedules: An Mon–Sat 09:00–18:00; tech 2 Tue–Sat 10:00–18:00 (PLACEHOLDER)
delete from public.staff_schedules
 where staff_id in ('33333333-0000-4000-8000-000000000001', '33333333-0000-4000-8000-000000000002');
insert into public.staff_schedules (staff_id, day_of_week, start_time, end_time)
select '33333333-0000-4000-8000-000000000001'::uuid, d, '09:00'::time, '18:00'::time from generate_series(1, 6) as d
union all
select '33333333-0000-4000-8000-000000000002'::uuid, d, '10:00'::time, '18:00'::time from generate_series(2, 6) as d;

-- ---------------------------------------------------------------------
-- Gallery: real Nails by An work (files in public/gallery/)
-- ---------------------------------------------------------------------
delete from public.gallery_photos
 where business_id = '11111111-1111-4111-8111-111111111111' and image_url like '/placeholders/%';
insert into public.gallery_photos (id, business_id, image_url, caption, sort_order) values
  ('44444444-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '/gallery/set-01.webp', 'Soft white ombré almond set', 1),
  ('44444444-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', '/gallery/set-02.webp', 'Soft white ombré almond set', 11),
  ('44444444-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', '/gallery/set-03.webp', 'Butter yellow polka dots with 3D flowers', 2),
  ('44444444-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', '/gallery/set-04.webp', 'Butter yellow polka dots with 3D flowers', 12),
  ('44444444-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', '/gallery/set-05.webp', 'Ocean blue marble with gold foil', 3),
  ('44444444-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', '/gallery/set-06.webp', 'Ocean blue marble with gold foil', 13),
  ('44444444-0000-4000-8000-000000000007', '11111111-1111-4111-8111-111111111111', '/gallery/set-07.webp', 'Ruby red glitter gel', 4),
  ('44444444-0000-4000-8000-000000000008', '11111111-1111-4111-8111-111111111111', '/gallery/set-08.webp', 'Ruby red glitter gel', 14),
  ('44444444-0000-4000-8000-000000000009', '11111111-1111-4111-8111-111111111111', '/gallery/set-09.webp', 'Nude with white pinstripes', 5),
  ('44444444-0000-4000-8000-000000000010', '11111111-1111-4111-8111-111111111111', '/gallery/set-10.webp', 'Nude with white pinstripes', 15),
  ('44444444-0000-4000-8000-000000000011', '11111111-1111-4111-8111-111111111111', '/gallery/set-11.webp', 'Classic latte nude gel', 6),
  ('44444444-0000-4000-8000-000000000012', '11111111-1111-4111-8111-111111111111', '/gallery/set-12.webp', 'Classic latte nude gel', 16),
  ('44444444-0000-4000-8000-000000000013', '11111111-1111-4111-8111-111111111111', '/gallery/set-13.webp', 'Chrome polka dot French tips', 7),
  ('44444444-0000-4000-8000-000000000014', '11111111-1111-4111-8111-111111111111', '/gallery/set-14.webp', 'Sheer nude polka dot French', 17),
  ('44444444-0000-4000-8000-000000000015', '11111111-1111-4111-8111-111111111111', '/gallery/set-15.webp', 'Pearl chrome glazed nails', 8),
  ('44444444-0000-4000-8000-000000000016', '11111111-1111-4111-8111-111111111111', '/gallery/set-16.webp', 'Pearl chrome glazed nails', 18),
  ('44444444-0000-4000-8000-000000000017', '11111111-1111-4111-8111-111111111111', '/gallery/set-17.webp', 'Sage green & pink blush art', 9),
  ('44444444-0000-4000-8000-000000000018', '11111111-1111-4111-8111-111111111111', '/gallery/set-18.webp', 'Sage green & pink blush art', 19),
  ('44444444-0000-4000-8000-000000000019', '11111111-1111-4111-8111-111111111111', '/gallery/set-19.webp', 'Lilac florals with gold lines', 10),
  ('44444444-0000-4000-8000-000000000020', '11111111-1111-4111-8111-111111111111', '/gallery/set-20.webp', 'Lilac florals with gold lines', 20)
on conflict (id) do update set image_url = excluded.image_url, caption = excluded.caption, sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------
-- Testimonials (PLACEHOLDER — replace with real Facebook reviews)
-- ---------------------------------------------------------------------
insert into public.testimonials (id, business_id, author_name, body, rating, source, sort_order) values
  ('55555555-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Sample Customer A',
   'So neat and detailed — my gel lasted almost three weeks! (sample review)', 5, 'Facebook', 1),
  ('55555555-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Sample Customer B',
   'Booking was easy and An was so friendly. Love my nail art. (sample review)', 5, 'Facebook', 2),
  ('55555555-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'Sample Customer C',
   'Clean tools, relaxing pedicure, fair prices. Will be back! (sample review)', 5, 'Facebook', 3)
on conflict (id) do update set author_name = excluded.author_name, body = excluded.body;
