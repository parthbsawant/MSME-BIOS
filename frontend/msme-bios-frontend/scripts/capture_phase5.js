import { chromium } from 'playwright'
import { createServer } from 'vite'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const outDir = path.resolve(rootDir, '../../docs/ui-theme-f1/phase5')

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true })
}

const TEST_EMAIL = 'theme.f1.tester@example.com'
const TEST_PASSWORD = 'Password123!'
const TEST_UID = 'Gl87OfnoHXZeB0PkcvFDAPhla7C2'

async function run() {
  console.log('Starting Vite server for Phase 5 Final Audit capture...')
  const server = await createServer({
    root: rootDir,
    server: { port: 5199 },
  })
  await server.listen()
  const baseUrl = 'http://localhost:5199'
  console.log(`Vite server running at ${baseUrl}`)

  const browser = await chromium.launch({ headless: true })

  const viewports = {
    desktop: { width: 1280, height: 800 },
    mobile390: { width: 390, height: 844 },
    mobile360: { width: 360, height: 780 },
  }

  const mockBusiness = {
    businessName: 'Sharma Tools & Fasteners',
    ownerName: 'Parth Sharma',
    city: 'Pune',
    ownerUid: TEST_UID,
  }

  const mockAccess = {
    onboarded: true,
    role: 'owner',
    effectiveFeatures: ['document_parser', 'cash_dashboard', 'invoice_generator', 'india_localized'],
  }

  const mockPlan = {
    type: 'tier',
    tierId: 'growth',
    price: 2499,
    seatsIncluded: 5,
    extraSeats: 1,
    featureIds: ['document_parser', 'cash_dashboard', 'invoice_generator', 'india_localized'],
  }

  const mockActiveSubscription = {
    order_id: 'order_phase5_active',
    status: 'active',
    plan_tier: 'growth',
    amount: 2998,
    paid_at: new Date().toISOString(),
  }

  const mockPendingSubscription = {
    order_id: 'order_phase5_pending',
    status: 'created',
    plan_tier: 'growth',
    amount: 2998,
  }

  const mockParsedDoc = {
    document_id: 'doc_sample_123',
    source_type: 'bank_statement',
    source_file: 'HDFC_Statement_October_2026.pdf',
    needs_review: false,
    transactions: [
      { txn_date: '02 Oct 2026', description: 'NEFT CR - TECHSOL PVT LTD', debit: null, credit: 145000, balance: 482300, needs_review: false },
      { txn_date: '05 Oct 2026', description: 'UPI/ELECTRICITY/MSEDCL', debit: 8420, credit: null, balance: 473880, needs_review: false },
      { txn_date: '10 Oct 2026', description: 'VENDOR PAY - RAJESH STEEL WORKS', debit: 62500, credit: null, balance: 411380, needs_review: false },
      { txn_date: '14 Oct 2026', description: 'RTGS CR - MAHARASHTRA AUTO COMPONENTS', debit: null, credit: 320000, balance: 731380, needs_review: false },
      { txn_date: '18 Oct 2026', description: 'SALARY OCT BATCH 1', debit: 195000, credit: null, balance: 536380, needs_review: false },
    ],
  }

  const mockTeamData = {
    members: [
      { user_id: TEST_UID, email: TEST_EMAIL, display_name: 'Parth Sharma (Owner)', role: 'owner', status: 'active', joined_at: '2026-08-15T09:00:00Z' },
      { user_id: 'user_fin_01', email: 'anita.deshmukh@example.com', display_name: 'Anita Deshmukh', role: 'finance', status: 'active', joined_at: '2026-09-01T10:30:00Z' },
      { user_id: 'user_sales_02', email: 'rahul.kulkarni@example.com', display_name: 'Rahul Kulkarni', role: 'sales', status: 'active', joined_at: '2026-09-12T14:15:00Z' },
      { user_id: 'user_hr_03', email: 'pooja.patil@example.com', display_name: 'Pooja Patil', role: 'hr', status: 'active', joined_at: '2026-09-20T11:00:00Z' },
      { user_id: 'user_mktg_04', email: 'vikram.joshi@example.com', display_name: 'Vikram Joshi', role: 'marketing', status: 'active', joined_at: '2026-10-02T16:45:00Z' },
    ],
    seats: { purchased: 6, in_use: 5 },
  }

  const mockInvites = [
    { invite_id: 'inv_01', email: 'suresh.shinde@example.com', role: 'sales', status: 'pending', expires_at: '2026-11-05T00:00:00Z', created_at: '2026-10-25T00:00:00Z' },
  ]

  const mockActivity = [
    { at: '2026-10-27T08:30:00Z', actor_email: TEST_EMAIL, action: 'member.role_changed', target: 'user_sales_02', details: { role: 'sales', from: 'finance', to: 'sales' } },
    { at: '2026-10-25T14:10:00Z', actor_email: TEST_EMAIL, action: 'invite.created', target: 'suresh.shinde@example.com', details: { role: 'sales' } },
  ]

  async function capturePage(pageName, urlPath, viewportKey, lang, theme, authSetup = false, subStatus = 'active', reducedMotion = false) {
    const currentSub = subStatus === 'created' ? mockPendingSubscription : mockActiveSubscription

    const context = await browser.newContext({
      viewport: viewports[viewportKey],
      reducedMotion: reducedMotion ? 'reduce' : 'no-preference',
    })
    const page = await context.newPage()

    // Intercept backend API requests with CORS headers
    await page.route('**/api/**', async (route) => {
      const url = route.request().url()
      const headers = {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'access-control-allow-headers': '*',
        'content-type': 'application/json',
      }

      if (route.request().method() === 'OPTIONS') {
        return route.fulfill({ status: 200, headers, body: '' })
      }

      if (url.includes('/api/me')) {
        await route.fulfill({
          status: 200,
          headers,
          body: JSON.stringify({
            business: {
              business_name: mockBusiness.businessName,
              owner_name: mockBusiness.ownerName,
              city: mockBusiness.city,
              owner_uid: mockBusiness.ownerUid,
            },
            onboarded: true,
            role: 'owner',
            department: null,
            status: 'active',
            effective_features: mockAccess.effectiveFeatures,
            plan: {
              plan_type: 'tier',
              tier_id: 'growth',
              price: 2499,
              seats_included: 5,
              extra_seats: 1,
              feature_ids: mockPlan.featureIds,
            },
            subscription: currentSub,
          }),
        })
      } else if (url.includes('/api/documents/')) {
        await route.fulfill({
          status: 200,
          headers,
          body: JSON.stringify(mockParsedDoc),
        })
      } else if (url.includes('/api/documents')) {
        await route.fulfill({
          status: 200,
          headers,
          body: JSON.stringify({ documents: [mockParsedDoc, { ...mockParsedDoc, document_id: 'doc_2' }] }),
        })
      } else if (url.includes('/api/team/audit')) {
        await route.fulfill({
          status: 200,
          headers,
          body: JSON.stringify({ entries: mockActivity }),
        })
      } else if (url.includes('/api/team/invites')) {
        await route.fulfill({
          status: 200,
          headers,
          body: JSON.stringify({ invites: mockInvites }),
        })
      } else if (url.includes('/api/team/members') || url.includes('/api/team')) {
        await route.fulfill({
          status: 200,
          headers,
          body: JSON.stringify(mockTeamData),
        })
      } else {
        await route.fulfill({
          status: 200,
          headers,
          body: JSON.stringify({ ok: true, status: currentSub.status, subscription: currentSub }),
        })
      }
    })

    if (authSetup) {
      await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' })

      await page.evaluate(
        ({ uid, mockBusiness, mockAccess, mockPlan, currentSub, theme, lang }) => {
          localStorage.setItem('msme-theme', theme)
          localStorage.setItem('i18nextLng', lang)
          localStorage.setItem(`msme-business-${uid}`, JSON.stringify(mockBusiness))
          localStorage.setItem(`msme-onboarded-${uid}`, 'true')
          localStorage.setItem(`msme-access-${uid}`, JSON.stringify(mockAccess))
          localStorage.setItem(`msme-plan-${uid}`, JSON.stringify(mockPlan))
          localStorage.setItem(`msme-subscription-${uid}`, JSON.stringify(currentSub))
        },
        { uid: TEST_UID, mockBusiness, mockAccess, mockPlan, currentSub, theme, lang }
      )

      await page.locator('input[type="email"], input[placeholder="you@example.com"]').fill(TEST_EMAIL)
      await page.locator('input[type="password"]').fill(TEST_PASSWORD)
      await page.locator('button[type="submit"]').click()

      try {
        await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 })
      } catch (e) {
        console.log('Login redirect wait error:', e.message)
      }

      await page.evaluate(
        ({ uid, mockBusiness, mockAccess, mockPlan, currentSub, theme, lang }) => {
          localStorage.setItem('msme-theme', theme)
          localStorage.setItem('i18nextLng', lang)
          localStorage.setItem(`msme-business-${uid}`, JSON.stringify(mockBusiness))
          localStorage.setItem(`msme-onboarded-${uid}`, 'true')
          localStorage.setItem(`msme-access-${uid}`, JSON.stringify(mockAccess))
          localStorage.setItem(`msme-plan-${uid}`, JSON.stringify(mockPlan))
          localStorage.setItem(`msme-subscription-${uid}`, JSON.stringify(currentSub))
          if (theme === 'dark') {
            document.documentElement.classList.add('dark')
          } else {
            document.documentElement.classList.remove('dark')
          }
          document.documentElement.setAttribute('lang', lang)
        },
        { uid: TEST_UID, mockBusiness, mockAccess, mockPlan, currentSub, theme, lang }
      )

      await page.goto(`${baseUrl}${urlPath}`, { waitUntil: 'domcontentloaded', timeout: 15000 })
    } else {
      await page.addInitScript(
        ({ theme, lang }) => {
          localStorage.setItem('msme-theme', theme)
          localStorage.setItem('i18nextLng', lang)
          if (theme === 'dark') {
            document.documentElement.classList.add('dark')
          } else {
            document.documentElement.classList.remove('dark')
          }
          document.documentElement.setAttribute('lang', lang)
        },
        { theme, lang }
      )

      await page.goto(`${baseUrl}${urlPath}`, { waitUntil: 'domcontentloaded', timeout: 15000 })
    }

    await page.waitForTimeout(1000)

    // Check for horizontal sideways scroll on mobile
    if (viewportKey.startsWith('mobile')) {
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
      if (scrollWidth > clientWidth) {
        console.warn(`[Scroll Warning] ${pageName} on ${viewportKey} has overflow: scrollWidth=${scrollWidth}, clientWidth=${clientWidth}`)
      }
    }

    const motionTag = reducedMotion ? '_reducedmotion' : ''
    const filename = `${pageName}_${viewportKey}_${lang}_${theme}${motionTag}.png`
    const filePath = path.join(outDir, filename)
    await page.screenshot({ path: filePath, fullPage: true })
    console.log(`Captured: ${filename}`)
    await context.close()
  }

  // 1. Core audit combinations (Desktop & Mobile 390 across en/hi/mr and light/dark)
  const coreScreens = [
    { name: 'landing', path: '/', auth: false },
    { name: 'login', path: '/login', auth: false },
    { name: 'signup', path: '/signup', auth: false },
    { name: 'dashboard', path: '/dashboard', auth: true },
    { name: 'upload', path: '/upload', auth: true },
    { name: 'results', path: '/results/doc_sample_123', auth: true },
    { name: 'team', path: '/team', auth: true },
    { name: 'choose_plan', path: '/choose-plan', auth: true },
    { name: 'billing', path: '/billing', auth: true },
  ]

  const auditThemes = [
    { lang: 'en', theme: 'light' },
    { lang: 'en', theme: 'dark' },
    { lang: 'mr', theme: 'light' },
    { lang: 'mr', theme: 'dark' },
    { lang: 'hi', theme: 'light' },
  ]

  for (const s of coreScreens) {
    for (const t of auditThemes) {
      await capturePage(s.name, s.path, 'desktop', t.lang, t.theme, s.auth)
      await capturePage(s.name, s.path, 'mobile390', t.lang, t.theme, s.auth)
    }
  }

  // 2. Strict 360px mobile viewport audit (check for no horizontal sideways scroll)
  console.log('Running 360px mobile viewport pass...')
  for (const s of coreScreens) {
    await capturePage(s.name, s.path, 'mobile360', 'en', 'light', s.auth)
    await capturePage(s.name, s.path, 'mobile360', 'mr', 'dark', s.auth)
  }

  // 3. Reduced-motion compliance test
  console.log('Running reduced-motion compliance pass...')
  await capturePage('landing', '/', 'desktop', 'en', 'light', false, 'active', true)
  await capturePage('dashboard', '/dashboard', 'desktop', 'en', 'dark', true, 'active', true)

  await browser.close()
  await server.close()
  console.log('Phase 5 Final Audit completed successfully!')
}

run().catch((err) => {
  console.error('Error during Phase 5 capture:', err)
  process.exit(1)
})
