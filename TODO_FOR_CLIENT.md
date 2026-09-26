# TODO for client — Nails by An

The only real information provided so far is the **business name** ("Nails by An") and the
**Facebook Page** (https://www.facebook.com/profile.php?id=61556891524730). Everything below is a
placeholder or an assumption and needs a real answer before launch.

✏️ = the owner can change it themselves in **/admin** after launch. No developer needed.
🛠 = needs a developer / setup step.

## Must answer before launch

### Business
- [ ] ✏️ **Address**, or "mobile / home-service only". Currently "Address to follow (placeholder)". The map on the Contact page stays hidden until a real address is set.
- [ ] ✏️ **Phone.** Currently `+63 900 000 0000`.
- [ ] ✏️ **Email.** Currently `hello@example.com`.
- [ ] ✏️ **Opening hours.** Assumed Mon–Sat 9:00 AM–6:00 PM, Sunday closed.
- [ ] ✏️ **Short description / tagline.** Currently generic placeholder text.
- [ ] 🛠 **Country / timezone / currency.** Assumed **Philippines** (`Asia/Manila`, ₱ PHP) because GCash was mentioned. If the salon is elsewhere, change `timezone` and `currency` in `supabase/seed.sql` (or the `businesses` row) and `DEFAULT_COUNTRY_CODE` (SMS).

### Services (all placeholders: names, prices, durations)
- [ ] ✏️ Replace the menu. Current placeholder menu (₱):

  | Category | Service | Price | Minutes |
  |---|---|---|---|
  | Manicure | Classic Manicure | 350 | 45 |
  | Manicure | Gel Polish Manicure | 650 | 60 |
  | Pedicure | Classic Pedicure | 450 | 60 |
  | Pedicure | Gel Polish Pedicure | 750 | 75 |
  | Pedicure | Foot Spa Pedicure | 850 | 90 |
  | Extensions | Soft Gel Extensions | 1,200 | 120 |
  | Extensions | Polygel Extensions | 1,400 | 120 |
  | Add-on | Nail Art | 200 | 30 |
  | Add-on | Gel / Extension Removal | 150 | 20 |
  | Add-on | French Tips | 150 | 15 |
  | Add-on | Paraffin Hand Treatment | 250 | 15 |

### Staff
- [ ] ✏️ **Who takes bookings?** Assumed **"An"** (owner / lead nail artist), working Mon–Sat 9–6.
- [ ] ✏️ **"Nail Tech 2 (placeholder)"** is a fake second tech that only exists to demonstrate "any available". **Rename or deactivate it before launch**, otherwise customers can book a person who doesn't exist.
- [ ] ✏️ Staff working hours, if different from salon hours. These are what control bookable times.
- [ ] ✏️ Staff photos. Currently placeholder avatars.

### Booking rules
- [ ] ✏️ **Book up to how many days ahead?** Assumed 30.
- [ ] ✏️ **Minimum notice before an appointment?** Assumed 2 hours.
- [ ] ✏️ **Cancellation / rescheduling policy.** Placeholder: "Free cancellation or rescheduling up to 24 hours before…".
- [ ] ✏️ **No-show policy.** Placeholder: "Missed appointments without notice forfeit the deposit."
- [ ] ✏️ **Time-slot interval.** Assumed every 30 minutes.
- [ ] Customers can cancel their own booking online **only while it's unpaid**. Confirmed bookings must be changed via Messenger. Is that OK?

### Payments
- [ ] ✏️ **Deposit required? How much?** Assumed **₱200** per booking (capped at the booking total).
- [ ] ✏️ **Preferred method.** Assumed **GCash**.
- [ ] ✏️ **Payment QR code image.** Currently a fake "SAMPLE QR" that cannot be scanned. Upload the real one in Admin → Settings → Payment QR code.
- [ ] ✏️ How long to hold unpaid bookings. Assumed **24 hours**.
- [ ] ✏️ Payment instructions text (Admin → Settings).

### Branding
- [ ] ✏️ **Logo.** Currently a placeholder "An" circle. Upload it in Admin → Settings.
- [ ] 🛠 **Brand colours.** Currently a placeholder blush/rose palette (`src/index.css`, `@theme` block). Send hex codes.
- [ ] ✏️ **Photos (10+ of salon / nail work).** The gallery currently shows 8 placeholder illustrations. Upload real ones in Admin → Gallery and delete the placeholders.
- [ ] ✏️ **Testimonials.** The 3 "Sample Customer" reviews are fake. Replace them with real Facebook reviews (Admin → Settings → Testimonials).
- [ ] 🛠 Favicon / social share image. Currently a generic nail icon.

### Spam protection
- [ ] 🛠 **Captcha on the booking form** (Cloudflare Turnstile, free). The database already limits each phone number to 3 unpaid bookings, but a captcha stops bots holding slots with random numbers. Recommended before launch.

### Domain & hosting
- [ ] 🛠 **Domain.** Does the client already own one? If not, which name?
- [ ] 🛠 Create the Supabase project + Vercel project (steps in README §4), then set the env vars.

### Notifications
- [ ] 🛠 **Customer confirmations via:** Email / SMS / Messenger? Assumed email + SMS.
  - Email needs a Resend account + verified sending domain (`RESEND_API_KEY`, `RESEND_FROM`).
  - SMS needs a Twilio account + number or sender ID (`TWILIO_*`). SMS costs money per message.
- [ ] 🛠 **Owner alerts for new bookings via:** email and/or SMS. Set `OWNER_NOTIFY_EMAIL` / `OWNER_NOTIFY_PHONE`.
- [ ] 🛠 **Owner admin login email.** Then run `npm run create-admin`.

### Facebook access
- [ ] 🛠 **Page admin access for the developer account?** (yes/no). Needed for Messenger automation and to confirm the Page username.
- [ ] 🛠 **Page username.** Messenger links use the numeric ID (`m.me/61556891524730`). If the Page has a vanity username, set it in Admin → Settings → Messenger ID.
- [ ] 🛠 **Linked Instagram Business account?** (handle). No Instagram feed has been built: Meta's Basic Display API was shut down in Dec 2024, and a feed now needs a Business account + Graph API token.
- [ ] 🛠 **Login with Facebook** (optional for customers) needs a Meta app (App ID + secret) configured in Supabase Auth.

## Assumptions & technical notes

- **Messenger chat widget.** Meta discontinued the embeddable Messenger Chat Plugin in May 2024. The site instead shows a floating "Message us" button that opens `m.me/<page>`. The payment screen pre-fills the booking reference in that message.
- **Messenger confirmations.** Meta only lets a Page message people who messaged it first, which needs a Messenger webhook to capture their page-scoped ID. The provider is built and wired up, but it logs as "skipped" until the webhook and a Page access token are set up. This would be a follow-up task if wanted.
- **Facebook Page Plugin** on the home page shows the Page timeline. Facebook controls what it displays, and some browsers with strict tracking protection hide it.
- **Opening hours vs. staff hours.** The opening hours on the website are for display only. Bookable times come from each staff member's working hours (Admin → Staff), plus any time off.
- **Guests are matched by mobile number.** Bookings with the same number are grouped under one guest record. Each booking keeps the name/phone/email typed for it, and confirmations always go to those details. Customers who log in get their own record, which is never merged with a guest record just because the phone matches (this protects privacy).
- **Revenue stat** = total price of confirmed + completed bookings starting this month. Deposits received are shown separately.
