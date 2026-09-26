# Nails by An — Booking Website

A mobile-first booking site for **Nails by An**
([Facebook Page](https://www.facebook.com/profile.php?id=61556891524730)). It is built with
React + Vite + Tailwind on the front end and Supabase (Postgres, Auth, Storage, Edge Functions)
on the back end.

- **Customers** browse services, pick staff or "any available", choose a real free time, and book as a guest.
- **Payment** is a manual deposit. After booking, the customer sees the salon's GCash or bank QR code and
  sends proof of payment on Messenger.
- **The owner** confirms the payment in `/admin`. The booking is then confirmed and the customer gets an email/SMS.
- **Unpaid bookings** auto-cancel after 24 hours (configurable), which frees the slot.

> Anything that still needs real client info is listed in **[TODO_FOR_CLIENT.md](TODO_FOR_CLIENT.md)**.

---

## 1. Quick start (no backend needed: demo mode)

```bash
npm install
npm run dev          # http://localhost:5173
```

When `VITE_SUPABASE_URL` is not set, the site runs in **demo mode**:

- The real SQL migrations and seed data run inside the browser in [PGlite](https://pglite.dev) (Postgres compiled to WASM).
- Booking rules, availability, conflict checks and expiry therefore behave **exactly** as they will in production.
- Demo data is saved in that browser's IndexedDB. *Admin → Settings → Reset demo data* wipes it.
- The admin login is `admin@demo.test` / `demo1234`.
- Emails and SMS are not sent. They appear in the notification log as "skipped".

Demo mode is good for showing the client the site before the Supabase project exists.

## 2. Architecture

```
React SPA (Vite, React Router, Tailwind)
  ├─ Public: Home · Services · Gallery · Book Now · Contact · My Booking
  ├─ /admin (role-gated): Dashboard · Bookings (list + day calendar) · Services · Staff · Gallery · Settings
  └─ src/lib/api/  ← one API surface, two implementations
        supabaseApi.js  (production)      demoApi.js (PGlite, same SQL)
                │
Supabase
  ├─ Postgres  supabase/migrations/*.sql
  │    tables: businesses, services, staff, staff_schedules, staff_time_off, customers,
  │            bookings, booking_services, payments, notifications_log, admin_users,
  │            gallery_photos, testimonials
  │    RLS: public reads the menu; customers read only their own bookings;
  │         admins (admin_users) manage everything for their business
  │    functions: get_available_slots / get_available_dates / create_booking /
  │         admin_confirm_payment / admin_set_booking_status / admin_list_bookings /
  │         admin_stats / expire_unpaid_bookings / get_booking_by_reference / get_my_bookings
  │    exclusion constraint: one staff member can never have overlapping active bookings
  │    pg_cron: expire_unpaid_bookings() every 15 min
  │    trigger: booking → confirmed  ⇒  pg_net → send-confirmation edge function
  ├─ Storage   bucket "media"  (<business_id>/{gallery,payment,staff,branding}/…)
  ├─ Auth      email/password (admin) · Facebook + email magic link (customers, optional)
  └─ Edge Functions  supabase/functions/
       create-booking          validates input, then calls create_booking() (race-safe)
       send-confirmation       email (Resend) / SMS (Twilio) / Messenger via a provider interface
       expire-unpaid-bookings  fallback scheduler if pg_cron is unavailable
```

**Why the booking logic lives in Postgres.** `create_booking()` does the following in one transaction:

1. Re-validates the services.
2. Expires stale pending bookings.
3. Finds a free staff member, taking a per-staff advisory lock and re-checking.
4. Inserts the booking, its service lines and a payment row with status `awaiting_proof`.

The `bookings_no_overlap` exclusion constraint is a final backstop, so two customers can never get the
same slot. Availability is computed from `staff_schedules` minus active bookings and `staff_time_off`,
stepped by `slot_interval_minutes`, and respects the minimum notice and the booking window. All times
are handled in the business timezone (`Asia/Manila`), whatever timezone the visitor is in.

## 3. Local development with Supabase (needs Docker)

```bash
# 1. Start local Supabase (Postgres, Auth, Storage, Edge runtime)
npx supabase start            # prints API URL, anon key, service_role key

# 2. Apply migrations + seed
npx supabase db reset         # runs supabase/migrations/* then supabase/seed.sql

# 3. Configure the frontend
cp .env.example .env.local    # set VITE_SUPABASE_URL=http://127.0.0.1:54321, VITE_SUPABASE_ANON_KEY,
                              # SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL, ADMIN_PASSWORD

# 4. Admin login + sample bookings
npm run seed:dev              # creates the admin user and ~6 sample bookings

# 5. Edge functions (in another terminal)
cp .env.example supabase/functions/.env   # keep only the edge-function secrets
npm run functions:serve

# 6. Run the site
npm run dev
```

The local confirmation trigger needs the Vault secrets from step 3 of section 4. Locally, use
`http://host.docker.internal:54321` as `project_url`. Without the secrets, confirmations still work
and the dashboard's **Resend confirmation** button sends the message.

## 4. Deploying

### Supabase Cloud

> Before going live, add a captcha (Cloudflare Turnstile or hCaptcha) to the booking form. The database
> already caps each phone number at 3 unpaid bookings, but a determined bot could still hold many slots.

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push                        # applies all migrations (includes pg_cron job + storage bucket)
psql "$DATABASE_URL" -f supabase/seed.sql   # or paste seed.sql into the SQL editor (first time only)
```

1. **Enable extensions** under *Database → Extensions*: `pg_cron` and `pg_net` (and `btree_gist`, which the
   migration also enables).
2. **Edge function secrets.** See `.env.example`:
   ```bash
   npx supabase secrets set SITE_URL=https://your-domain.com ALLOWED_ORIGIN=https://your-domain.com \
     RESEND_API_KEY=... RESEND_FROM="Nails by An <bookings@your-domain.com>" \
     TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... TWILIO_FROM=... \
     OWNER_NOTIFY_EMAIL=owner@... NOTIFY_CHANNELS=email,sms
   npm run functions:deploy
   ```
3. **Let the database call the confirmation function.** In the SQL editor:
   ```sql
   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
   select vault.create_secret('<long random string>', 'notify_webhook_secret');
   ```
   Then set the same value as a function secret: `npx supabase secrets set NOTIFY_WEBHOOK_SECRET=<same string>`.
4. **Create the owner's admin login:** `npm run create-admin`, with `.env.local` pointing at the cloud
   project.
5. **Auth URLs.** Under *Authentication → URL Configuration*, set Site URL to `https://your-domain.com` and add
   `https://your-domain.com/my-bookings` to the redirect URLs.
6. **(Optional) Login with Facebook.**
   1. Create a Meta app with Facebook Login.
   2. Add `https://<project-ref>.supabase.co/auth/v1/callback` as a valid OAuth redirect URI.
   3. Paste the App ID and secret into *Authentication → Providers → Facebook*.

### Vercel (frontend)

1. Import the repo. The framework preset is **Vite**. `vercel.json` already rewrites every route to the SPA.
2. Set these environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `VITE_BUSINESS_SLUG`.
3. Add the custom domain and point DNS at Vercel.

## 5. How payments work (no gateway)

1. The customer books, and the booking is saved as **pending** with a payment row of `awaiting_proof`.
2. The confirmation screen shows the QR code (Admin → Settings), the deposit amount, and a
   **Send payment proof on Messenger** button. That button opens `m.me/<page>` with the booking reference pre-filled.
3. The owner checks GCash or the bank app, then clicks **Confirm payment** on the booking in `/admin`.
   They can add a reference note.
4. The booking becomes **confirmed** and the payment **received**. The trigger calls `send-confirmation`,
   which emails or texts the customer. Every attempt is logged in `notifications_log`, and a retry never
   double-sends.
5. If nobody confirms within `pending_expiry_hours` (24 by default), `expire_unpaid_bookings()` cancels the
   booking. Availability ignores stale pending bookings even between cron runs. A late payment can still be
   confirmed from the dashboard if the slot is still free.

## 6. Notifications

`supabase/functions/_shared/notifications/` defines a `NotificationProvider` interface
(`isConfigured`, `addressFor`, `send`) and has three providers: Resend (email), Twilio (SMS) and the
Messenger Send API. Booking code only calls `notify(recipient, message)`. To add or swap a channel, add a
provider to `ALL_PROVIDERS` and list it in `NOTIFY_CHANNELS`.

> **Messenger:** Meta retired the embeddable Messenger *Chat Plugin* in 2024, so the site uses a floating
> "Message us" button that links to `m.me/<page>`. Sending Messenger confirmations requires a Page
> access token and the customer's page-scoped ID. Meta only provides that ID after the customer has
> messaged the Page, which needs a Messenger webhook. Until then that channel is logged as `skipped`
> (see TODO_FOR_CLIENT.md).

## 7. Tests

| Command | What it checks |
|---|---|
| `npm run test:db` | 48 Postgres tests. They run the real migrations in PGlite and cover availability, multi-service durations, conflict and race safety, expiry, admin actions, stats, RLS, storage policies and the security-review regressions (no account takeover by phone, per-phone cap on unpaid bookings, atomic schedule saves). |
| `npm run test:functions` | Deno unit tests for notification templates, E.164 phone formatting and the provider HTTP calls. |
| `npm run check:functions` | Type-checks the edge functions. |
| `npm run test:e2e` | Playwright on desktop and a Pixel 7 viewport, against demo mode. Covers the full guest booking, the QR/payment screen, booking lookup, slot conflicts, validation, admin confirm/cancel/complete, CRUD, uploads and horizontal-scroll checks. |
| `npm run lint` | oxlint |

The first run of `npm run test:e2e` needs `npx playwright install chromium`.

## 8. Project structure

```
src/
  pages/            Home, Services, Gallery, Book, Contact, MyBookings, NotFound
  pages/admin/      AdminApp (auth gate + layout), Dashboard, Bookings, Services, Staff, Gallery, Settings
  components/       Layout (header/footer/Messenger button), FacebookPagePlugin, booking/PaymentInstructions, ui
  lib/              api/ (supabase + demo implementations), BusinessContext, AuthContext, format, services
supabase/
  migrations/       schema · RLS · booking functions · storage + cron
  seed.sql          client data (placeholders marked)
  functions/        create-booking · send-confirmation · expire-unpaid-bookings · _shared · tests
scripts/            create-admin.mjs · seed-dev.mjs
tests/db/           Postgres tests (vitest + PGlite)
tests/e2e/          Playwright
public/placeholders placeholder logo, gallery art, staff avatars, sample QR (replace!)
```
