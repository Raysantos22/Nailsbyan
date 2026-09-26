import { chromium } from '@playwright/test'
const b = await chromium.launch()
const ctx = await b.newContext()
const p = await ctx.newPage()
p.on('console', m => /error|warn/.test(m.type()) && !/facebook|ErrorUtils/.test(m.text()) && console.log('CONSOLE', m.type(), m.text().slice(0,300)))
await p.goto('http://localhost:5174/services')
await p.waitForSelector('text=Gel Polish Manicure', { timeout: 60000 })
const r1 = await p.evaluate(async () => {
  const { api } = await import('/src/lib/api/index.js')
  const biz = await api.getBusiness('nails-by-an')
  const svc = (await api.listServices(biz.id)).find(s => s.name === 'Gel Polish Manicure')
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())
  const dates = await api.getAvailableDates({ businessId: biz.id, serviceIds: [svc.id], from: today, to: today.slice(0,8) + '28' })
  const day = dates.find(d => d.slot_count > 0).day
  const slots = await api.getAvailableSlots({ businessId: biz.id, serviceIds: [svc.id], date: day })
  const bk = await api.createBooking({ business_id: biz.id, service_ids: [svc.id], start_time: slots[0].slot_start, customer: { name: 'X Y', phone: '0917 555 1234' } })
  const look = await api.lookupBooking(bk.reference.toLowerCase(), '09175551234')
  return { ref: bk.reference, found: !!look, slotType: typeof slots[0].slot_start, slot: slots[0].slot_start }
})
console.log('same page', r1)
await p.goto('http://localhost:5174/my-bookings')
await p.waitForSelector('text=Find a booking', { timeout: 60000 })
const r2 = await p.evaluate(async (ref) => {
  const { api } = await import('/src/lib/api/index.js')
  return !!(await api.lookupBooking(ref, '09175551234'))
}, r1.ref)
console.log('after nav', r2)
await b.close()
