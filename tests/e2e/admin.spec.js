import { test, expect } from '@playwright/test'
import { PNG, adminLogin, bookAppointment, expectNoHorizontalScroll, watchErrors } from './helpers.js'

test('owner confirms a payment: booking → confirmed, stats update, notifications logged', async ({ page }) => {
  const errors = watchErrors(page)
  const { reference } = await bookAppointment(page, { name: 'Payment Tester', phone: '0917 222 3333' })

  await adminLogin(page)
  await expect(page.getByTestId('stat-pending')).toContainText('1')
  await expect(page.getByTestId('stat-revenue')).toContainText('₱0')

  const card = page.locator(`[data-testid=admin-booking][data-reference="${reference}"]`).first()
  await expect(card).toContainText('Payment Tester')
  await expect(card).toContainText('Awaiting payment')
  await card.getByRole('button', { name: 'Confirm payment' }).click()
  await card.getByLabel('Payment reference / note (optional)').fill('GCash ref 9876')
  await card.getByRole('button', { name: /Payment received — confirm/ }).click()

  await expect(page.getByTestId('stat-pending')).toContainText('0')
  await expect(page.getByText('No bookings waiting for payment.')).toBeVisible()

  // Bookings list shows it confirmed with the payment note and notification log
  await page.getByRole('link', { name: 'Bookings', exact: true }).click()
  await page.getByLabel('Range').selectOption('31')
  const listed = page.locator(`[data-testid=admin-booking][data-reference="${reference}"]`)
  await expect(listed).toContainText('Confirmed')
  await expect(listed).toContainText('GCash ref 9876')
  await expect(listed).toContainText('received')
  await expect(listed).toContainText('email: skipped')
  await expect(listed).toContainText('sms: skipped')

  // Filter by status
  await page.getByLabel('Filter by status').selectOption('pending')
  await expect(page.getByText('No bookings in this range.')).toBeVisible()
  await page.getByLabel('Filter by status').selectOption('confirmed')
  await expect(listed).toBeVisible()

  // Mark completed (clear the status filter first so the card stays visible)
  await page.getByLabel('Filter by status').selectOption('')
  await listed.getByRole('button', { name: 'Completed' }).click()
  await expect(listed.getByRole('button', { name: 'Mark no-show instead' })).toBeVisible()
  await expect(listed.locator('.badge')).toHaveText('Completed')

  // Guest now sees it confirmed (no payment box)
  await page.goto('/my-bookings')
  await page.getByLabel('Booking reference').fill(reference)
  await page.getByLabel('Mobile number used').fill('0917 222 3333')
  await page.getByRole('button', { name: 'Find booking' }).click()
  await expect(page.getByText('Completed').first()).toBeVisible()
  await expect(page.getByTestId('payment-instructions')).toHaveCount(0)

  expect(errors).toEqual([])
})

test('owner cancels a booking and the slot is released; day calendar renders', async ({ page }) => {
  const { reference, time, dateLabel } = await bookAppointment(page, { services: ['Classic Manicure'], staff: 'An', phone: '0917 444 5555' })

  await adminLogin(page)
  const card = page.locator(`[data-testid=admin-booking][data-reference="${reference}"]`).first()
  page.once('dialog', (d) => d.accept('Client asked to cancel'))
  await card.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByText('No bookings waiting for payment.')).toBeVisible()

  // Day calendar
  await page.getByRole('link', { name: 'Bookings', exact: true }).click()
  await page.getByRole('button', { name: 'Day', exact: true }).click()
  await expect(page.getByTestId('calendar-column').filter({ hasText: /^An$/ })).toBeVisible()
  await expectNoHorizontalScroll(page)

  // Slot is bookable again for An
  await page.goto('/book')
  await page.getByRole('checkbox', { name: /^Classic Manicure/ }).check()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('radio', { name: /^An\b/ }).check({ force: true })
  await page.getByRole('button', { name: 'Continue' }).click()
  const selected = page.locator('[role=option][aria-selected=true]')
  await expect(selected).toBeVisible()
  expect((await selected.getAttribute('aria-label')).split(',')[0]).toBe(dateLabel.split(',')[0])
  await expect(page.locator('button[aria-pressed]', { hasText: new RegExp(`^${time}$`) })).toHaveCount(1)
})

test('admin manages services, staff hours, gallery and the payment QR', async ({ page }) => {
  const errors = watchErrors(page)
  await adminLogin(page)

  // Services: add → appears on public menu; hide → disappears
  await page.getByRole('link', { name: 'Services', exact: true }).click()
  await page.getByRole('button', { name: 'Add service' }).click()
  await page.getByLabel('Name *').fill('Chrome Powder Set')
  await page.getByLabel('Category').fill('Manicure')
  await page.getByLabel('Price *').fill('900')
  await page.getByLabel('Duration (minutes) *').fill('75')
  await page.getByLabel('Description').fill('Mirror-shine chrome finish.')
  await page.getByRole('button', { name: 'Save service' }).click()
  await expect(page.getByText('Chrome Powder Set')).toBeVisible()

  await page.goto('/services')
  await expect(page.getByText('Chrome Powder Set')).toBeVisible()
  await expect(page.getByText('₱900')).toBeVisible()

  await page.goto('/admin/services')
  await page.getByRole('button', { name: 'Hide Chrome Powder Set' }).click()
  await expect(page.getByRole('button', { name: 'Show Chrome Powder Set' })).toBeVisible()
  await page.goto('/services')
  await expect(page.getByRole('heading', { name: 'Manicure', exact: true })).toBeVisible()
  await expect(page.getByText('Chrome Powder Set')).toHaveCount(0)

  // Staff hours: give "Nail Tech 2" Sunday hours → Sunday becomes bookable for them
  await page.goto('/admin/staff')
  await page.getByRole('button', { name: 'Working hours' }).nth(1).click()
  const dialog = page.getByRole('dialog')
  await dialog.locator('div', { hasText: /^Sunday/ }).getByRole('button', { name: 'Add hours' }).click()
  await dialog.getByRole('button', { name: 'Save schedule' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText(/Sun 9 AM–6 PM/)).toBeVisible()

  // Time off form works
  await page.getByLabel('Reason (private)').fill('Holiday')
  await page.getByRole('button', { name: 'Block time' }).click()
  await expect(page.getByText('Holiday').first()).toBeVisible()

  // Gallery upload
  await page.goto('/admin/gallery')
  await expect(page.locator('img[loading=lazy]')).toHaveCount(20)
  await page.locator('input[type=file]').setInputFiles({ name: 'set.png', mimeType: 'image/png', buffer: PNG })
  await expect(page.locator('img[loading=lazy]')).toHaveCount(21)
  await page.goto('/gallery')
  await expect(page.getByRole('button', { name: /Open photo/ })).toHaveCount(21)

  // Payment QR upload → shown to customers
  await page.goto('/admin/settings')
  await page.getByLabel('Upload new QR code').setInputFiles({ name: 'qr.png', mimeType: 'image/png', buffer: PNG })
  await expect(page.getByTestId('admin-qr')).toHaveAttribute('src', /^data:image\/png/)

  // Settings save
  await page.getByLabel('Deposit amount (PHP)').fill('300')
  await page.getByRole('button', { name: 'Save settings' }).click()
  await expect(page.getByText('Saved ✓')).toBeVisible()

  await bookAppointment(page, { services: ['Classic Pedicure'], phone: '0917 777 8888' })
  await expect(page.getByTestId('payment-qr')).toHaveAttribute('src', /^data:image\/png/)
  await expect(page.getByRole('heading', { name: /Pay your ₱300 deposit/ })).toBeVisible()

  expect(errors).toEqual([])
})

test('non-admin cannot reach dashboard without logging in; logout works', async ({ page }) => {
  await page.goto('/admin/bookings')
  await expect(page.getByRole('heading', { name: 'Staff login' })).toBeVisible({ timeout: 60_000 })
  await page.getByLabel('Password').fill('wrong')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByText(/Demo mode: sign in with/)).toBeVisible()
  await page.getByLabel('Password').fill('demo1234')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('heading', { name: 'Bookings' })).toBeVisible()
  await page.getByRole('button', { name: /Log out/ }).click()
  await expect(page.getByRole('heading', { name: 'Staff login' })).toBeVisible()
})
