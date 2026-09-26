import { describe, it, expect, beforeEach } from 'vitest'
import { createDb, as, BUSINESS_ID, STAFF_AN, STAFF_2, SVC, nextLocalDate, manila } from './harness.js'

const ADMIN_USER = 'aaaaaaaa-0000-4000-8000-000000000001'
const OTHER_USER = 'aaaaaaaa-0000-4000-8000-000000000002'
const CUSTOMER_USER = 'aaaaaaaa-0000-4000-8000-000000000003'

let db
const q = async (sql, params) => (await db.query(sql, params)).rows
const slots = (serviceIds, date, staffId = null) =>
  q('select * from get_available_slots($1, $2, $3, $4)', [BUSINESS_ID, serviceIds, date, staffId])
const localTimes = (rows) =>
  rows.map((r) =>
    new Date(r.slot_start).toLocaleTimeString('en-GB', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' }),
  )
const book = (overrides = {}) => {
  const a = {
    services: [SVC.gelMani],
    start: null,
    name: 'Test Customer',
    phone: '0917 123 4567',
    email: 'test@example.com',
    notes: null,
    staff: null,
    authUser: null,
    ...overrides,
  }
  return q('select create_booking($1, $2, $3, $4, $5, $6, $7, $8, $9) as b', [
    BUSINESS_ID, a.services, a.start, a.name, a.phone, a.email, a.notes, a.staff, a.authUser,
  ]).then((r) => r[0].b)
}
const expectError = async (promise, text) => {
  await expect(promise).rejects.toThrow(text)
}

beforeEach(async () => {
  db = await createDb()
  await q('insert into auth.users (id, email) values ($1, $2), ($3, $4), ($5, $6)', [
    ADMIN_USER, 'owner@example.com', OTHER_USER, 'other@example.com', CUSTOMER_USER, 'cust@example.com',
  ])
  await q('insert into admin_users (user_id, business_id, role) values ($1, $2, $3)', [ADMIN_USER, BUSINESS_ID, 'owner'])
}, 30000)

describe('seed', () => {
  it('loads business, services, staff and schedules', async () => {
    expect((await q('select count(*)::int as n from services'))[0].n).toBe(11)
    expect((await q('select count(*)::int as n from staff where is_active'))[0].n).toBe(2)
    expect((await q('select count(*)::int as n from staff_schedules'))[0].n).toBe(11)
    const [biz] = await q('select * from businesses')
    expect(biz.name).toBe('Nails by An')
    expect(biz.facebook_page_url).toBe('https://www.facebook.com/profile.php?id=61556891524730')
  })
})

describe('availability', () => {
  it('Monday: only An works, 60-min service → 09:00…17:00 every 30 min', async () => {
    const rows = await slots([SVC.gelMani], nextLocalDate(1))
    expect(rows).toHaveLength(17)
    expect(localTimes(rows)[0]).toBe('09:00')
    expect(localTimes(rows).at(-1)).toBe('17:00')
    expect(rows.every((r) => r.staff_ids.length === 1 && r.staff_ids[0] === STAFF_AN)).toBe(true)
  })

  it('Tuesday: both staff from 10:00', async () => {
    const rows = await slots([SVC.gelMani], nextLocalDate(2))
    const at = (t) => rows[localTimes(rows).indexOf(t)]
    expect(at('09:00').staff_ids).toEqual([STAFF_AN])
    expect(at('10:00').staff_ids.sort()).toEqual([STAFF_AN, STAFF_2].sort())
  })

  it('filters by chosen staff', async () => {
    const rows = await slots([SVC.gelMani], nextLocalDate(2), STAFF_2)
    expect(localTimes(rows)[0]).toBe('10:00')
    expect(rows.every((r) => r.staff_ids[0] === STAFF_2)).toBe(true)
  })

  it('Sunday (closed) has no slots', async () => {
    expect(await slots([SVC.gelMani], nextLocalDate(0))).toHaveLength(0)
  })

  it('multiple services add up their durations (120 + 30 = 150 min → last start 15:30)', async () => {
    const rows = await slots([SVC.softGel, SVC.nailArt], nextLocalDate(1))
    expect(localTimes(rows).at(-1)).toBe('15:30')
    expect(new Date(rows[0].slot_end) - new Date(rows[0].slot_start)).toBe(150 * 60000)
  })

  it('past dates and dates beyond the booking window return nothing', async () => {
    expect(await slots([SVC.gelMani], '2020-01-06')).toHaveLength(0)
    const far = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10)
    expect(await slots([SVC.gelMani], far)).toHaveLength(0)
  })

  it('respects minimum notice', async () => {
    await q('update businesses set min_notice_hours = 336, booking_window_days = 60')
    expect(await slots([SVC.gelMani], nextLocalDate(1))).toHaveLength(0)
  })

  it('existing bookings remove overlapping slots only', async () => {
    const date = nextLocalDate(1)
    await book({ start: manila(date, '10:00') }) // 10:00–11:00 with An
    const times = localTimes(await slots([SVC.gelMani], date))
    expect(times).toContain('09:00')
    expect(times).not.toContain('09:30')
    expect(times).not.toContain('10:00')
    expect(times).not.toContain('10:30')
    expect(times).toContain('11:00')
  })

  it('staff time off removes slots', async () => {
    const date = nextLocalDate(1)
    await q('insert into staff_time_off (staff_id, starts_at, ends_at) values ($1, $2, $3)', [
      STAFF_AN, manila(date, '12:00'), manila(date, '13:00'),
    ])
    const times = localTimes(await slots([SVC.classicMani], date))
    expect(times).toContain('11:00')
    expect(times).not.toContain('11:30') // 11:30–12:15 overlaps
    expect(times).not.toContain('12:30')
    expect(times).toContain('13:00')
  })

  it('get_available_dates counts slots per day and shows closed days as 0', async () => {
    const mon = nextLocalDate(1)
    const sun = new Date(new Date(mon).getTime() - 86400000).toISOString().slice(0, 10)
    const rows = await q('select * from get_available_dates($1, $2, $3, $4)', [BUSINESS_ID, [SVC.gelMani], sun, mon])
    expect(rows).toHaveLength(2)
    expect(rows[0].slot_count).toBe(0)
    expect(rows[1].slot_count).toBe(17)
  })
})

describe('service validation', () => {
  it('rejects add-ons on their own', async () => {
    await expectError(slots([SVC.nailArt], nextLocalDate(1)), 'Add-ons must be booked together')
  })
  it('rejects unknown / inactive services', async () => {
    await q('update services set is_active = false where id = $1', [SVC.gelMani])
    await expectError(slots([SVC.gelMani], nextLocalDate(1)), 'no longer available')
  })
  it('rejects add-ons tied to a different parent', async () => {
    await q('update services set parent_service_id = $1 where id = $2', [SVC.softGel, SVC.removal])
    await expectError(slots([SVC.gelMani, SVC.removal], nextLocalDate(1)), 'without the service it belongs to')
    expect(await slots([SVC.softGel, SVC.removal], nextLocalDate(1))).not.toHaveLength(0)
  })
  it('rejects duplicates and empty selections', async () => {
    await expectError(slots([SVC.gelMani, SVC.gelMani], nextLocalDate(1)), 'selected twice')
    await expectError(slots([], nextLocalDate(1)), 'at least one service')
  })
})

describe('create_booking', () => {
  it('creates a pending booking with lines and an awaiting_proof payment', async () => {
    const date = nextLocalDate(1)
    const b = await book({ services: [SVC.gelMani, SVC.nailArt], start: manila(date, '09:00'), notes: 'Pink chrome please' })
    expect(b.status).toBe('pending')
    expect(b.staff_id).toBe(STAFF_AN)
    expect(b.staff_name).toBe('An')
    expect(Number(b.total_price)).toBe(850)
    expect(b.total_duration).toBe(90)
    expect(b.services.map((s) => s.name)).toEqual(['Gel Polish Manicure', 'Nail Art'])
    expect(b.reference).toMatch(/^[0-9A-F]{8}$/)
    expect(b.payment_status).toBe('awaiting_proof')
    expect(Number(b.deposit_amount)).toBe(200)
    expect(new Date(b.end_time) - new Date(b.start_time)).toBe(90 * 60000)
    const [pay] = await q('select * from payments where booking_id = $1', [b.booking_id])
    expect(pay.status).toBe('awaiting_proof')
    expect(pay.method).toBe('GCash')
  })

  it('"any available" spreads bookings across free staff, then refuses a third', async () => {
    const date = nextLocalDate(2)
    const start = manila(date, '10:00')
    const b1 = await book({ start, phone: '09170000001' })
    const b2 = await book({ start, phone: '09170000002' })
    expect(new Set([b1.staff_id, b2.staff_id])).toEqual(new Set([STAFF_AN, STAFF_2]))
    await expectError(book({ start, phone: '09170000003' }), 'no longer available')
  })

  it('refuses a specific staff member who is busy even if someone else is free', async () => {
    const date = nextLocalDate(2)
    await book({ start: manila(date, '10:00'), staff: STAFF_2 })
    await expectError(book({ start: manila(date, '10:30'), staff: STAFF_2, phone: '09179999999' }), 'no longer available')
    const other = await book({ start: manila(date, '10:30'), phone: '09179999999' })
    expect(other.staff_id).toBe(STAFF_AN)
  })

  it('refuses times that are not on the slot grid or outside working hours', async () => {
    const date = nextLocalDate(1)
    await expectError(book({ start: manila(date, '09:10') }), 'no longer available')
    await expectError(book({ start: manila(date, '17:30') }), 'no longer available') // would end 18:30
    await expectError(book({ start: manila(nextLocalDate(0), '10:00') }), 'no longer available')
  })

  it('validates customer details', async () => {
    const start = manila(nextLocalDate(1), '09:00')
    await expectError(book({ start, name: ' ' }), 'enter your name')
    await expectError(book({ start, phone: '12' }), 'valid phone')
    await expectError(book({ start, email: 'not-an-email' }), 'valid email')
  })

  it('groups guests by phone digits without overwriting details; each booking keeps its own contact snapshot', async () => {
    const date = nextLocalDate(1)
    const b1 = await book({ start: manila(date, '09:00'), phone: '+63 917 555 0101', name: 'Maria', email: 'maria@example.com' })
    await book({ start: manila(date, '11:00'), phone: '0063-917-555-0101', name: 'Maria S.' })
    // Matching is on digits only: '+63 917…' and '(+63) 917…' are the same guest.
    const b3 = await book({ start: manila(date, '13:00'), phone: '(+63) 917 555 0101', name: 'Someone Else', email: 'attacker@example.com' })
    const rows = await q("select id, name, email from customers where phone_normalized = '639175550101'")
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Maria')
    expect(rows[0].email).toBe('maria@example.com')
    const snap = await q('select id, customer_name, customer_email from bookings where id = any($1) order by start_time', [[b1.booking_id, b3.booking_id]])
    expect(snap.map((r) => [r.customer_name, r.customer_email])).toEqual([
      ['Maria', 'maria@example.com'],
      ['Someone Else', 'attacker@example.com'],
    ])
    expect(b3.customer_name).toBe('Someone Else')
  })

  it('caps unpaid bookings at 3 per phone number', async () => {
    const date = nextLocalDate(1)
    for (const t of ['09:00', '11:00', '13:00']) await book({ start: manila(date, t), phone: '0917 888 0000' })
    await expectError(book({ start: manila(date, '15:00'), phone: '0917-888-0000' }), '3 unpaid bookings')
    // a different number is fine
    await book({ start: manila(date, '15:00'), phone: '0917 888 0001' })
  })

  it('the exclusion constraint blocks overlapping inserts even outside create_booking', async () => {
    const date = nextLocalDate(1)
    const b = await book({ start: manila(date, '10:00') })
    const [{ customer_id }] = await q('select customer_id from bookings where id = $1', [b.booking_id])
    await expectError(
      q("insert into bookings (business_id, staff_id, customer_id, customer_name, customer_phone, start_time, end_time) values ($1, $2, $3, 'X', '0917', $4, $5)", [
        BUSINESS_ID, STAFF_AN, customer_id, manila(date, '10:30'), manila(date, '11:30'),
      ]),
      'bookings_no_overlap',
    )
  })

  it('cancelled bookings free their slot', async () => {
    const date = nextLocalDate(1)
    const b = await book({ start: manila(date, '10:00') })
    await q("update bookings set status = 'cancelled' where id = $1", [b.booking_id])
    const again = await book({ start: manila(date, '10:00'), phone: '09171112222' })
    expect(again.status).toBe('pending')
  })
})

describe('auto-expiry of unpaid bookings', () => {
  it('stale pending bookings stop blocking availability and get cancelled', async () => {
    const date = nextLocalDate(1)
    const b = await book({ start: manila(date, '10:00') })
    expect(localTimes(await slots([SVC.gelMani], date))).not.toContain('10:00')

    await q("update bookings set created_at = now() - interval '25 hours' where id = $1", [b.booking_id])
    expect(localTimes(await slots([SVC.gelMani], date))).toContain('10:00')

    const [{ n }] = await q('select expire_unpaid_bookings() as n')
    expect(n).toBe(1)
    const [row] = await q('select status, cancelled_reason from bookings where id = $1', [b.booking_id])
    expect(row.status).toBe('cancelled')
    expect(row.cancelled_reason).toMatch(/24 hours/)
  })

  it('create_booking expires the stale booking and takes the slot', async () => {
    const date = nextLocalDate(1)
    const old = await book({ start: manila(date, '10:00') })
    await q("update bookings set created_at = now() - interval '25 hours' where id = $1", [old.booking_id])
    const fresh = await book({ start: manila(date, '10:00'), phone: '09173334444' })
    expect(fresh.status).toBe('pending')
    const [row] = await q('select status from bookings where id = $1', [old.booking_id])
    expect(row.status).toBe('cancelled')
  })

  it('confirmed bookings never expire', async () => {
    const date = nextLocalDate(1)
    const b = await book({ start: manila(date, '10:00') })
    await as(db, 'authenticated', ADMIN_USER, () => q('select admin_confirm_payment($1)', [b.booking_id]))
    await q("update bookings set created_at = now() - interval '48 hours' where id = $1", [b.booking_id])
    expect((await q('select expire_unpaid_bookings() as n'))[0].n).toBe(0)
  })
})

describe('admin actions', () => {
  it('confirm payment flips booking → confirmed and payment → received', async () => {
    const b = await book({ start: manila(nextLocalDate(1), '10:00') })
    const res = await as(db, 'authenticated', ADMIN_USER, () =>
      q('select admin_confirm_payment($1, $2) as r', [b.booking_id, 'GCash ref 1234']),
    )
    expect(res[0].r.status).toBe('confirmed')
    expect(res[0].r.payment_status).toBe('received')
    const [pay] = await q('select * from payments where booking_id = $1', [b.booking_id])
    expect(pay.reference_note).toBe('GCash ref 1234')
    expect(pay.received_at).not.toBeNull()
  })

  it('non-admins cannot confirm, cancel or list', async () => {
    const b = await book({ start: manila(nextLocalDate(1), '10:00') })
    await as(db, 'authenticated', OTHER_USER, async () => {
      await expectError(q('select admin_confirm_payment($1)', [b.booking_id]), 'Not authorised')
      await expectError(q("select admin_set_booking_status($1, 'cancelled')", [b.booking_id]), 'Not authorised')
      await expectError(
        q("select admin_list_bookings($1, now() - interval '1 day', now() + interval '60 days')", [BUSINESS_ID]),
        'Not authorised',
      )
      await expectError(q('select admin_stats($1)', [BUSINESS_ID]), 'Not authorised')
    })
  })

  it('status transitions: cancel, complete, no-show', async () => {
    const date = nextLocalDate(1)
    const b1 = await book({ start: manila(date, '09:00') })
    const b2 = await book({ start: manila(date, '11:00'), phone: '09175550000' })
    await as(db, 'authenticated', ADMIN_USER, async () => {
      await expectError(q("select admin_set_booking_status($1, 'completed')", [b1.booking_id]), 'Only confirmed')
      await expectError(q("select admin_set_booking_status($1, 'confirmed')", [b1.booking_id]), 'Confirm Payment')
      const c = await q("select admin_set_booking_status($1, 'cancelled', 'Client asked') as r", [b1.booking_id])
      expect(c[0].r.status).toBe('cancelled')
      await q('select admin_confirm_payment($1)', [b2.booking_id])
      const n = await q("select admin_set_booking_status($1, 'no_show') as r", [b2.booking_id])
      expect(n[0].r.status).toBe('no_show')
    })
  })

  it('a late payment can re-confirm an expired booking unless the slot was taken', async () => {
    const date = nextLocalDate(1)
    const old = await book({ start: manila(date, '10:00') })
    await q("update bookings set created_at = now() - interval '25 hours' where id = $1", [old.booking_id])
    await q('select expire_unpaid_bookings()')
    await as(db, 'authenticated', ADMIN_USER, () => q('select admin_confirm_payment($1)', [old.booking_id]))
    expect((await q('select status from bookings where id = $1', [old.booking_id]))[0].status).toBe('confirmed')

    const other = await book({ start: manila(date, '14:00') })
    await q("update bookings set created_at = now() - interval '25 hours' where id = $1", [other.booking_id])
    await book({ start: manila(date, '14:00'), phone: '09176667777' }) // takes the slot, expiring `other`
    await as(db, 'authenticated', ADMIN_USER, () =>
      expectError(q('select admin_confirm_payment($1)', [other.booking_id]), 'since been taken'),
    )
  })

  it('admin_list_bookings returns nested data and filters by staff/status', async () => {
    const date = nextLocalDate(2)
    await book({ start: manila(date, '10:00'), staff: STAFF_AN })
    await book({ start: manila(date, '10:00'), staff: STAFF_2, phone: '09178889999', name: 'Second' })
    const all = await as(db, 'authenticated', ADMIN_USER, () =>
      q("select admin_list_bookings($1, now(), now() + interval '30 days') as r", [BUSINESS_ID]),
    )
    expect(all[0].r).toHaveLength(2)
    expect(all[0].r[0].customer.phone).toBeTruthy()
    expect(all[0].r[0].payment.status).toBe('awaiting_proof')
    expect(all[0].r[0].services[0].name).toBe('Gel Polish Manicure')
    const onlyTwo = await as(db, 'authenticated', ADMIN_USER, () =>
      q("select admin_list_bookings($1, now(), now() + interval '30 days', $2) as r", [BUSINESS_ID, STAFF_2]),
    )
    expect(onlyTwo[0].r.map((b) => b.customer.name)).toEqual(['Second'])
    const confirmed = await as(db, 'authenticated', ADMIN_USER, () =>
      q("select admin_list_bookings($1, now(), now() + interval '30 days', null, 'confirmed') as r", [BUSINESS_ID]),
    )
    expect(confirmed[0].r).toHaveLength(0)
  })

  it('admin_stats counts bookings and confirmed revenue', async () => {
    const [{ today }] = await q("select (now() at time zone 'Asia/Manila')::date::text as today")
    // A booking in the current week & month: insert directly (might be in the past, bypassing notice rules).
    const [{ id: cust }] = await q("insert into customers (name, phone) values ('Stats', '09990000000') returning id")
    await q(
      `insert into bookings (business_id, staff_id, customer_id, customer_name, customer_phone, start_time, end_time, status, total_price)
       values ($1, $2, $3, 'Stats', '0999', $4, $5, 'confirmed', 650), ($1, $2, $3, 'Stats', '0999', $6, $7, 'cancelled', 999)`,
      [BUSINESS_ID, STAFF_AN, cust, manila(today, '03:00'), manila(today, '04:00'), manila(today, '05:00'), manila(today, '06:00')],
    )
    const [{ s }] = await as(db, 'authenticated', ADMIN_USER, () => q('select admin_stats($1) as s', [BUSINESS_ID]))
    expect(s.bookings_this_week).toBe(1)
    expect(Number(s.revenue_this_month)).toBe(650)
    expect(s.today_count).toBe(1)
    expect(s.currency).toBe('PHP')
  })

  it('confirming never fails when pg_net / vault are absent (notification trigger is best-effort)', async () => {
    const b = await book({ start: manila(nextLocalDate(1), '10:00') })
    await as(db, 'authenticated', ADMIN_USER, () => q('select admin_confirm_payment($1)', [b.booking_id]))
    expect((await q('select status from bookings where id = $1', [b.booking_id]))[0].status).toBe('confirmed')
  })
})

describe('row level security & privileges', () => {
  it('anon can read the public menu but not bookings/customers, and cannot call create_booking', async () => {
    await as(db, 'anon', null, async () => {
      expect((await q('select count(*)::int as n from services'))[0].n).toBe(11)
      expect((await q('select count(*)::int as n from gallery_photos'))[0].n).toBe(20)
      await expectError(q('select * from bookings'), 'permission denied')
      await expectError(q('select * from customers'), 'permission denied')
      await expectError(
        q("select create_booking($1, $2, now(), 'x', '0917', null)", [BUSINESS_ID, [SVC.gelMani]]),
        'permission denied',
      )
      await expectError(q('select expire_unpaid_bookings()'), 'permission denied')
      // public RPCs work
      expect(await slots([SVC.gelMani], nextLocalDate(1))).toHaveLength(17)
    })
  })

  it('anon cannot see inactive services or write to the menu', async () => {
    await q('update services set is_active = false where id = $1', [SVC.gelMani])
    await as(db, 'anon', null, async () => {
      expect((await q('select count(*)::int as n from services'))[0].n).toBe(10)
      await expectError(q("update services set price = 1 where id = $1", [SVC.classicMani]), 'permission denied')
    })
  })

  it('customers see only their own bookings; admins see all for their business', async () => {
    const date = nextLocalDate(1)
    await book({ start: manila(date, '09:00'), authUser: CUSTOMER_USER, phone: '09171230000' })
    await book({ start: manila(date, '11:00'), phone: '09174560000', name: 'Someone Else' })

    await as(db, 'authenticated', CUSTOMER_USER, async () => {
      expect(await q('select id from bookings')).toHaveLength(1)
      expect(await q('select id from customers')).toHaveLength(1)
      expect(await q('select id from payments')).toHaveLength(1)
      const [{ r }] = await q('select get_my_bookings() as r')
      expect(r).toHaveLength(1)
      // cannot update bookings (no admin rights)
      await q("update bookings set status = 'confirmed'")
      expect((await q("select count(*)::int as n from bookings where status = 'confirmed'"))[0].n).toBe(0)
    })
    await as(db, 'authenticated', OTHER_USER, async () => {
      expect(await q('select id from bookings')).toHaveLength(0)
      expect(await q('select id from customers')).toHaveLength(0)
    })
    await as(db, 'authenticated', ADMIN_USER, async () => {
      expect(await q('select id from bookings')).toHaveLength(2)
      expect(await q('select id from customers')).toHaveLength(2)
    })
  })

  it('authenticated users cannot insert bookings directly', async () => {
    const [{ id: cust }] = await q("insert into customers (name, phone) values ('X', '09990001111') returning id")
    const date = nextLocalDate(1)
    await as(db, 'authenticated', CUSTOMER_USER, () =>
      expectError(
        q("insert into bookings (business_id, staff_id, customer_id, customer_name, customer_phone, start_time, end_time) values ($1, $2, $3, 'X', '0917', $4, $5)", [
          BUSINESS_ID, STAFF_AN, cust, manila(date, '10:00'), manila(date, '11:00'),
        ]),
        'row-level security',
      ),
    )
  })

  it('admins can manage the menu; non-admins cannot', async () => {
    await as(db, 'authenticated', ADMIN_USER, async () => {
      await q("insert into services (business_id, name, price, duration_minutes) values ($1, 'New', 100, 30)", [BUSINESS_ID])
      await q('update businesses set tagline = $1 where id = $2', ['Updated', BUSINESS_ID])
    })
    expect((await q("select tagline from businesses"))[0].tagline).toBe('Updated')
    await as(db, 'authenticated', OTHER_USER, async () => {
      await expectError(
        q("insert into services (business_id, name, price, duration_minutes) values ($1, 'Hack', 1, 30)", [BUSINESS_ID]),
        'row-level security',
      )
      await q("update businesses set tagline = 'hacked'")
    })
    expect((await q("select tagline from businesses"))[0].tagline).toBe('Updated')
  })

  it('storage policies only allow admins to write under their business folder', async () => {
    await as(db, 'authenticated', ADMIN_USER, () =>
      q("insert into storage.objects (bucket_id, name) values ('media', $1)", [`${BUSINESS_ID}/gallery/a.jpg`]),
    )
    await as(db, 'authenticated', OTHER_USER, () =>
      expectError(
        q("insert into storage.objects (bucket_id, name) values ('media', $1)", [`${BUSINESS_ID}/gallery/b.jpg`]),
        'row-level security',
      ),
    )
    await as(db, 'authenticated', ADMIN_USER, () =>
      expectError(q("insert into storage.objects (bucket_id, name) values ('media', 'not-a-uuid/x.jpg')"), 'row-level security'),
    )
  })

  it('guests can look up a booking by reference + phone only', async () => {
    const b = await book({ start: manila(nextLocalDate(1), '09:00'), phone: '0917 222 3333' })
    await as(db, 'anon', null, async () => {
      const [{ r }] = await q('select get_booking_by_reference($1, $2) as r', [b.reference.toLowerCase(), '09172223333'])
      expect(r.booking_id).toBe(b.booking_id)
      const [{ r: none }] = await q('select get_booking_by_reference($1, $2) as r', [b.reference, '09170000000'])
      expect(none).toBeNull()
    })
  })

  it('customers can cancel their own pending booking but not a confirmed one', async () => {
    const date = nextLocalDate(1)
    const b1 = await book({ start: manila(date, '09:00'), authUser: CUSTOMER_USER, phone: '09171230000' })
    const b2 = await book({ start: manila(date, '11:00'), authUser: CUSTOMER_USER, phone: '09171230000' })
    await as(db, 'authenticated', ADMIN_USER, () => q('select admin_confirm_payment($1)', [b2.booking_id]))
    await as(db, 'authenticated', CUSTOMER_USER, async () => {
      const [{ r }] = await q('select cancel_my_booking($1) as r', [b1.booking_id])
      expect(r.status).toBe('cancelled')
      await expectError(q('select cancel_my_booking($1)', [b2.booking_id]), 'already confirmed')
    })
    await as(db, 'authenticated', OTHER_USER, () =>
      expectError(q('select cancel_my_booking($1)', [b2.booking_id]), 'not found'),
    )
  })
})

describe('review fixes (security regressions)', () => {
  it('a logged-in user cannot take over a guest’s bookings by booking with their phone number', async () => {
    const date = nextLocalDate(1)
    const victim = await book({ start: manila(date, '09:00'), phone: '0917 321 0000', name: 'Victim', notes: 'private note' })
    // attacker logs in and books using the victim's phone
    await book({ start: manila(date, '11:00'), phone: '0917 321 0000', name: 'Attacker', authUser: OTHER_USER })
    const [guest] = await q("select auth_user_id from customers where phone_normalized = '09173210000' and auth_user_id is null")
    expect(guest).toBeTruthy()
    await as(db, 'authenticated', OTHER_USER, async () => {
      const [{ r }] = await q('select get_my_bookings() as r')
      expect(r.map((b) => b.customer_name)).toEqual(['Attacker'])
      await expectError(q('select cancel_my_booking($1)', [victim.booking_id]), 'not found')
    })
  })

  it('customers can edit their name but not their phone or auth link', async () => {
    await book({ start: manila(nextLocalDate(1), '09:00'), authUser: CUSTOMER_USER, phone: '09171230000' })
    await as(db, 'authenticated', CUSTOMER_USER, async () => {
      await q("update customers set name = 'New Name'")
      await expectError(q("update customers set phone = '0999 111 2222'"), 'permission denied')
      await expectError(q('update customers set auth_user_id = null'), 'permission denied')
    })
    expect((await q('select name from customers where auth_user_id = $1', [CUSTOMER_USER]))[0].name).toBe('New Name')
  })

  it('only auto-cancelled, future bookings can be reinstated', async () => {
    const date = nextLocalDate(1)
    const b = await book({ start: manila(date, '09:00') })
    await as(db, 'authenticated', ADMIN_USER, async () => {
      await q("select admin_set_booking_status($1, 'cancelled', 'Client asked')", [b.booking_id])
      await expectError(q('select admin_confirm_payment($1)', [b.booking_id]), 'auto-cancelled')
    })
    // auto-cancelled but staff now has time off → refused
    const b2 = await book({ start: manila(date, '13:00'), phone: '09170001234' })
    await q("update bookings set created_at = now() - interval '25 hours' where id = $1", [b2.booking_id])
    await q('select expire_unpaid_bookings()')
    await q('insert into staff_time_off (staff_id, starts_at, ends_at) values ($1, $2, $3)', [STAFF_AN, manila(date, '12:00'), manila(date, '18:00')])
    await as(db, 'authenticated', ADMIN_USER, () => expectError(q('select admin_confirm_payment($1)', [b2.booking_id]), 'time off'))
  })

  it('admin_replace_staff_schedule is atomic and admin-only', async () => {
    const before = await q('select count(*)::int as n from staff_schedules where staff_id = $1', [STAFF_AN])
    await as(db, 'authenticated', OTHER_USER, () =>
      expectError(q("select admin_replace_staff_schedule($1, '[]')", [STAFF_AN]), 'Not authorised'),
    )
    // invalid row (end before start) → whole call fails, old schedule kept
    await as(db, 'authenticated', ADMIN_USER, () =>
      expectError(
        q('select admin_replace_staff_schedule($1, $2)', [STAFF_AN, JSON.stringify([
          { day_of_week: 1, start_time: '09:00', end_time: '12:00' },
          { day_of_week: 2, start_time: '15:00', end_time: '10:00' },
        ])]),
        'staff_schedules_check',
      ),
    )
    expect(await q('select count(*)::int as n from staff_schedules where staff_id = $1', [STAFF_AN])).toEqual(before)
    await as(db, 'authenticated', ADMIN_USER, () =>
      q('select admin_replace_staff_schedule($1, $2)', [STAFF_AN, JSON.stringify([{ day_of_week: 0, start_time: '10:00', end_time: '16:00' }])]),
    )
    expect((await q('select day_of_week from staff_schedules where staff_id = $1', [STAFF_AN])).map((r) => r.day_of_week)).toEqual([0])
  })

  it('malformed storage paths are denied, not errors', async () => {
    await as(db, 'authenticated', ADMIN_USER, () =>
      expectError(q("insert into storage.objects (bucket_id, name) values ('media', $1)", ['-'.repeat(36) + '/x.jpg']), 'row-level security'),
    )
  })

  it('create_booking only expires stale bookings of the staff it books (not globally)', async () => {
    const date = nextLocalDate(2)
    const stale = await book({ start: manila(date, '10:00'), staff: STAFF_2, phone: '09170000009' })
    await q("update bookings set created_at = now() - interval '25 hours' where id = $1", [stale.booking_id])
    await book({ start: manila(date, '15:00'), staff: STAFF_AN, phone: '09170000010' })
    expect((await q('select status from bookings where id = $1', [stale.booking_id]))[0].status).toBe('pending')
    // but it still doesn't block availability
    expect(localTimes(await slots([SVC.gelMani], date, STAFF_2))).toContain('10:00')
  })
})

describe('real client seed (supabase/seed.sql)', () => {
  it('loads cleanly with the Nails by An price list, one staff member and 7am–4pm hours', async () => {
    const real = await createDb({ seed: 'real' })
    const rows = (sql, p) => real.query(sql, p).then((r) => r.rows)
    const [biz] = await rows('select * from businesses')
    expect(biz.phone).toBe('0916 430 9505')
    expect(Number(biz.deposit_amount)).toBe(200)
    const services = await rows('select name, price::int as price, is_addon from services where is_active order by sort_order')
    expect(services.slice(0, 5).map((s) => [s.name, s.price])).toEqual([
      ['Gel Manicure', 349],
      ['Gel Pedicure', 349],
      ['Hard Gel Overlay / BIAB', 449],
      ['Soft Gel Extension', 549],
      ['Toe Nail Extension', 549],
    ])
    expect(services.filter((s) => s.is_addon)).toHaveLength(4)
    expect(await rows('select name from staff where is_active')).toEqual([{ name: 'An' }])
    expect((await rows('select count(*)::int as n from gallery_photos'))[0].n).toBe(20)
    // Monday: 60-min gel manicure, 07:00 → last start 15:00, every 30 min = 17 slots
    const mon = nextLocalDate(1)
    const slotsReal = await rows("select * from get_available_slots($1, array['22222222-0000-4000-8000-000000000001']::uuid[], $2)", [BUSINESS_ID, mon])
    expect(slotsReal).toHaveLength(17)
    expect(localTimes(slotsReal)[0]).toBe('07:00')
    await real.close()
  })
})
