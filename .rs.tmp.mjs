import { chromium } from '@playwright/test'
const b = await chromium.launch()
const widths = [360, 390, 768, 820, 1024, 1280, 1440, 1920]
const pages = ['/', '/services', '/gallery', '/contact', '/book', '/my-bookings', '/admin', '/admin/bookings', '/admin/services', '/admin/staff', '/admin/gallery', '/admin/settings']
const shots = { 390: ['/', '/book'], 768: ['/', '/book', '/services', '/admin/bookings'], 1024: ['/', '/book'] }
let problems = 0
for (const w of widths) {
  const ctx = await b.newContext({ viewport: { width: w, height: w < 800 ? 844 : w < 1100 ? 1024 : 900 }, isMobile: w < 800, hasTouch: w < 1100 })
  const p = await ctx.newPage()
  await p.route(/facebook\.com|google\.com\/maps/, r => r.abort())
  let logged = false
  for (const path of pages) {
    if (path.startsWith('/admin') && !logged) {
      await p.goto('http://localhost:5174/admin'); await p.getByRole('button', { name: 'Log in' }).click({ timeout: 90000 }); await p.getByRole('heading', { name: 'Dashboard' }).waitFor({ timeout: 60000 }); logged = true
    }
    await p.goto('http://localhost:5174' + path)
    if (!path.startsWith('/admin')) await p.locator('img[alt="Nails by An"]').first().waitFor({ timeout: 90000 })
    else await p.locator('main h1').first().waitFor({ timeout: 60000 })
    await p.waitForTimeout(900)
    const r = await p.evaluate(() => {
      const vw = document.documentElement.clientWidth, bad = []
      for (const el of document.querySelectorAll('body *')) {
        if (getComputedStyle(el).position === 'fixed') continue
        const rc = el.getBoundingClientRect(); if (!rc.width) continue
        let a = el.parentElement, clipped = false
        while (a) { const o = getComputedStyle(a).overflowX; if (['auto','scroll','hidden','clip'].includes(o)) { clipped = true; break } a = a.parentElement }
        if (!clipped && (rc.right > vw + 1 || rc.left < -1)) bad.push(el.tagName.toLowerCase() + '.' + String(el.className).slice(0, 50) + ' [' + Math.round(rc.left) + '..' + Math.round(rc.right) + ']')
      }
      const wrapped = [...document.querySelectorAll('header nav a')].filter(a => a.offsetParent && a.getBoundingClientRect().height > 30).map(a => a.textContent.trim())
      return { scroll: document.documentElement.scrollWidth - vw, bad: bad.slice(0, 3), wrapped }
    })
    if (r.scroll > 0 || r.bad.length || r.wrapped.length) { problems++; console.log(w, path, 'scroll', r.scroll, r.bad.join(' | '), 'wrapped:', r.wrapped.join(',')) }
    if ((shots[w] || []).includes(path)) await p.screenshot({ path: 'C:/Users/ADMIN/AppData/Local/Temp/claude/c--Users-ADMIN-Documents-Client-nails-by-an/1d6845c5-5477-4658-ae8e-2895f0b42fbf/scratchpad/rs/' + w + path.replace(/\//g, '_') + '.png' })
  }
  await ctx.close()
}
await b.close(); console.log('audit done, problems:', problems)
