import { expect } from '@playwright/test'

// 1x1 transparent PNG
export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

// Fail the test on uncaught errors / console errors from our own code.
export function watchErrors(page) {
  const errors = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    const loc = msg.location()?.url || ''
    // Third-party embeds (Facebook plugin, Google Maps) are outside our control.
    if (/facebook|fbcdn|google|gstatic/i.test(text + loc)) return
    if (/Failed to load resource/i.test(text) && /facebook|google/i.test(loc)) return
    errors.push(`console: ${text} @ ${loc}`)
  })
  return errors
}

export async function waitForApp(page) {
  await expect(page.getByRole('link', { name: /Nails by An — home/ }).first()).toBeVisible({ timeout: 60_000 })
}

export async function pickServices(page, services) {
  for (const s of services) {
    const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    await page.getByRole('checkbox', { name: new RegExp(`^${escaped}`) }).check()
  }
}

// Walk the whole public booking flow. Returns { reference, time, dateLabel }.
export async function bookAppointment(
  page,
  {
    services = ['Gel Manicure', 'Gel Removal (with new set)'],
    staff = 'Any available',
    name = 'E2E Customer',
    phone = '0917 555 1234',
    email = 'e2e@example.com',
    notes = 'Pink chrome please',
    pickTime = 'first',
  } = {},
) {
  await page.goto('/book')
  await waitForApp(page)
  await pickServices(page, services)
  await page.getByRole('button', { name: 'Continue' }).click()

  await page.getByRole('radio', { name: new RegExp(`^${staff}\\b`) }).check({ force: true })
  await page.getByRole('button', { name: 'Continue' }).click()

  // A date with availability is auto-selected; wait for time buttons.
  const selectedDate = page.locator('[role=option][aria-selected=true]')
  await expect(selectedDate).toBeVisible()
  const dateLabel = await selectedDate.getAttribute('aria-label')
  const times = page.locator('button[aria-pressed]')
  await expect(times.first()).toBeVisible()
  const timeButton = pickTime === 'first' ? times.first() : times.filter({ hasText: pickTime }).first()
  const time = (await timeButton.textContent()).trim()
  await timeButton.click()
  await expect(timeButton).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Continue' }).click()

  await page.getByLabel(/Full name/).fill(name)
  await page.getByLabel(/Mobile number/).fill(phone)
  if (email) await page.getByLabel(/Email/).fill(email)
  if (notes) await page.getByLabel(/Notes/).fill(notes)
  await page.getByLabel(/accept the booking policy/).check()
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByRole('heading', { name: 'Check your booking' })).toBeVisible()
  await page.getByRole('button', { name: 'Confirm booking' }).click()

  await expect(page.getByRole('heading', { name: 'Your slot is reserved!' })).toBeVisible()
  const reference = (await page.getByTestId('booking-reference').first().textContent()).trim()
  return { reference, time, dateLabel }
}

export async function adminLogin(page) {
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Staff login' })).toBeVisible({ timeout: 60_000 })
  // Demo credentials are pre-filled.
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
}

export async function expectNoHorizontalScroll(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow, 'page should not scroll horizontally').toBeLessThanOrEqual(1)
}
