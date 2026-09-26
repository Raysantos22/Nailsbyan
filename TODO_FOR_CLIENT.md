# TODO for client — Nails by An

Updated after An's answers to the setup form and the price list (Sept 2026).

✏️ = An can change it herself in **/admin** once she has a login. 🛠 = needs developer / setup.

## ✅ Done (from An's answers)
- Business: **Nails by An — "Where beautiful nails meet creativity and self-care"**
- Address: Blk 6 Lot 25 Lorna St., Xevera Subd., Tabun, Mabalacat City, Pampanga (shown with a map)
- Phone: 0916 430 9505
- Hours: **Mon–Sat 7:00 AM–4:00 PM**, Sunday closed
- Staff: **An only** (the sample second nail tech was removed)
- Services & prices: from the price list (gel ₱349, BIAB ₱449, extensions ₱549, removal with new set / removal only, +₱50 if done by another salon, "price may vary — send your nail inspo")
- Deposit **₱200**; no-show forfeits the deposit
- Payment: GCash **and** bank transfer
- Logo: "NailsbyAn — NAIL AND ART" (header and footer)
- Photos: studio + 20 real sets in the Gallery

## Still needed
### Must have before taking real bookings
- [ ] ✏️ **GCash / bank QR code photo** (form #16). The site still shows a fake "SAMPLE QR". Upload it in Admin → Settings → Payment QR code, or send it and I'll add it.
- [ ] 🛠 **Admin login for An.** Which email should she use? (Then Supabase → Authentication → Add user + 1 SQL line; see README.)

### Please confirm (sensible defaults are in place)
- [ ] ✏️ **Service durations.** Not on the price list; I estimated: Gel Mani/Pedi **1 hr**, BIAB **1 hr 30**, Soft Gel Extension **2 hr**, Toe Nail Extension **1 hr 30**, removal-only **20–30 min**, removal with new set **+15–20 min**. These control which time slots are offered, so they matter.
- [ ] ✏️ **Book up to how many days ahead?** Currently 30 days. (form #9)
- [ ] ✏️ **Minimum notice before an appointment?** Currently 2 hours. (form #10)
- [ ] ✏️ **Cancellation / rescheduling policy.** Currently: "Please message us on Facebook Messenger as early as possible." (form #11)
- [ ] ✏️ **Email address.** Optional; none shown now. (form #3)
- [ ] ✏️ **Nail art pricing.** Currently "price may vary — send your inspo" (no fixed add-on price). Add fixed prices if she has them.

### Notifications (form #22–23)
- [ ] 🛠 An chose **Messenger** confirmations. Customers already get a "Send payment proof on Messenger" button with their booking reference pre-filled. Fully automatic Messenger messages from the Page need Page admin access for setup (form #24) and a Meta webhook, which is a follow-up job.
- [ ] How should **An** be notified of new bookings? (form #23) Options: email, SMS, or just checking the /admin dashboard.

### Domain & Facebook
- [ ] 🛠 **Domain** (form #17–18). Currently https://nailsbyan.vercel.app. Ideas: nailsbyan.ph, nailsbyan.com.
- [ ] 🛠 **Facebook Page admin/editor access** (form #24), for the "Book now" button and Messenger setup.
- [ ] Instagram Business account linked? (form #25). The price list shows **@NailsbyAn**; confirm if that's Instagram.
- [ ] ✏️ **Brand colours** (form #20). The site uses soft blush / ivory to match the photos; say if she wants something else.
- [ ] ✏️ **Testimonials.** The 3 "Sample Customer" reviews are placeholders; replace them with real Facebook reviews (Admin → Settings).

### Spam protection
- [ ] 🛠 Captcha on the booking form (Cloudflare Turnstile, free). Each phone number is already limited to 3 unpaid bookings.

## Technical notes
- Meta retired the embeddable Messenger chat widget in 2024, so the site uses a floating "Message us" button (m.me link) instead.
- Website opening hours are for display. Bookable times come from An's working hours in Admin → Staff, plus any time off she blocks.
- Unpaid bookings auto-cancel after 24 hours (adjustable in Admin → Settings).
