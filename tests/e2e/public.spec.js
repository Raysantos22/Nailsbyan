import { test, expect } from '@playwright/test'
import { chooseStaff, bookAppointment, expectNoHorizontalScroll, waitForApp, watchErrors } from './helpers.js'

test('public pages render real data without errors or horizontal scroll', async ({ page }) => {
  const errors = watchErrors(page)

  await page.goto('/')
  await waitForApp(page)
  await expect(page.getByRole('heading', { level: 1, name: /Pretty nails/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Popular services' })).toBeVisible()
  await expect(page.getByText('Gel Manicure').first()).toBeVisible()
  await expect(page.locator('iframe[title="Facebook Page"]')).toHaveAttribute('src', /profile\.php%3Fid%3D61556891524730/)
  await expect(page.getByRole('link', { name: 'Message us on Facebook Messenger' })).toHaveAttribute('href', 'https://m.me/61556891524730')
  await expectNoHorizontalScroll(page)

  await page.goto('/services')
  for (const cat of ['Gel', 'Hard Gel / BIAB', 'Extensions', 'Removal only', 'Add-ons']) {
    await expect(page.getByRole('heading', { name: cat, exact: true })).toBeVisible()
  }
  await expect(page.getByText('₱449').first()).toBeVisible()
  await expect(page.getByText('1 hr 30 min').first()).toBeVisible()
  await expectNoHorizontalScroll(page)

  await page.goto('/gallery')
  await expect(page.getByRole('button', { name: /Open photo/ })).toHaveCount(20)
  await page.getByRole('button', { name: /Open photo/ }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expectNoHorizontalScroll(page)

  await page.goto('/contact')
  await expect(page.getByRole('heading', { name: 'Opening hours' })).toBeVisible()
  await expect(page.getByText('Sunday').first()).toBeVisible()
  await expect(page.getByText('Closed').first()).toBeVisible()
  await expectNoHorizontalScroll(page)

  await page.goto('/my-bookings')
  await expect(page.getByRole('heading', { name: 'Find a booking' })).toBeVisible()
  await expectNoHorizontalScroll(page)

  await page.goto('/nope')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()

  expect(errors).toEqual([])
})

test('guest books end-to-end, sees QR + payment steps, and can look the booking up', async ({ page }) => {
  const errors = watchErrors(page)
  const { reference } = await bookAppointment(page)

  expect(reference).toMatch(/^[0-9A-F]{8}$/)
  await expect(page.getByTestId('payment-instructions')).toBeVisible()
  await expect(page.getByTestId('payment-qr')).toBeVisible()
  await expect(page.getByText('Awaiting payment').first()).toBeVisible()
  await expect(page.getByRole('heading', { name: /Pay your ₱200 deposit/ })).toBeVisible()
  await expect(page.getByText('₱399').first()).toBeVisible() // 349 + 50 removal add-on
  const messenger = page.getByRole('link', { name: 'Send payment proof on Messenger' })
  await expect(messenger).toHaveAttribute('href', new RegExp(`^https://m\\.me/61556891524730\\?text=.*${reference}`))
  await expectNoHorizontalScroll(page)

  // Look it up again as a guest
  await page.goto('/my-bookings')
  await page.getByLabel('Booking reference').fill(reference.toLowerCase())
  await page.getByLabel('Mobile number used').fill('09175551234')
  await page.getByRole('button', { name: 'Find booking' }).click()
  await expect(page.getByTestId('booking-reference')).toHaveText(reference)
  await expect(page.getByTestId('payment-qr')).toBeVisible()

  // Wrong phone → not found
  await page.getByLabel('Mobile number used').fill('09999999999')
  await page.getByRole('button', { name: 'Find booking' }).click()
  await expect(page.getByText(/couldn’t find a booking/)).toBeVisible()

  expect(errors).toEqual([])
})

test('a booked slot is no longer offered for the same staff member', async ({ page }) => {
  const first = await bookAppointment(page, { services: ['Gel Pedicure'], staff: 'An', phone: '0917 000 0001' })

  await page.goto('/book')
  await waitForApp(page)
  await page.getByRole('checkbox', { name: /^Gel Pedicure/ }).check()
  await page.getByRole('button', { name: 'Continue' }).click()
  await chooseStaff(page, 'An')
  // Open the booked date. If that day is now fully booked it is disabled,
  // which also proves the slot is gone; otherwise the booked time must be missing.
  await expect(page.locator('[role=option][aria-selected=true]')).toBeVisible()
  const day = first.dateLabel.split(',').slice(0, 2).join(',')
  const dateBtn = page.locator(`[role=option][aria-label^="${day}"]`)
  if (await dateBtn.isDisabled()) return
  await dateBtn.click()
  await expect(page.locator('button[aria-pressed]').first()).toBeVisible()
  await expect(page.locator('button[aria-pressed]', { hasText: new RegExp(`^${first.time}$`) })).toHaveCount(0)
})

test('add-ons need a main service; validation blocks bad details', async ({ page }) => {
  await page.goto('/book')
  await waitForApp(page)
  await expect(page.getByRole('checkbox', { name: /^Gel Removal \(with new set\)/ })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled()
  await page.getByRole('checkbox', { name: /^Gel Manicure/ }).check()
  await expect(page.getByRole('checkbox', { name: /^Gel Removal \(with new set\)/ })).toBeEnabled()
  await page.getByRole('checkbox', { name: /^Gel Removal \(with new set\)/ }).check()
  // Unticking the main service drops the add-on
  await page.getByRole('checkbox', { name: /^Gel Manicure/ }).uncheck()
  await expect(page.getByRole('checkbox', { name: /^Gel Removal \(with new set\)/ })).not.toBeChecked()

  await page.getByRole('checkbox', { name: /^Toe Nail Extension/ }).check()
  await page.getByRole('button', { name: 'Continue' }).click()
  await chooseStaff(page)
  // An works alone, so there is no Staff step
  await expect(page.getByRole('list', { name: 'Booking steps' })).not.toContainText('Staff')
  await page.locator('button[aria-pressed]').first().click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByLabel(/Mobile number/).fill('12')
  await page.getByLabel(/Email/).fill('not-an-email')
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByText('Please enter your name.')).toBeVisible()
  await expect(page.getByText('Please enter a valid mobile number.')).toBeVisible()
  await expect(page.getByText('Please enter a valid email address.')).toBeVisible()
  await expect(page.getByText('Please accept the booking policy to continue.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Check your booking' })).toHaveCount(0)
})
