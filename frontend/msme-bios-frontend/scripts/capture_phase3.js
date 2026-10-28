import { createServer } from 'vite'
import { chromium } from 'playwright'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const outDir = path.resolve(__dirname, '../../../docs/ui-theme-f1/phase3')

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true })
}

const TEST_EMAIL = 'theme.f1.tester@example.com'
const TEST_PASSWORD = 'Password123!'
const TEST_UID = 'Gl87OfnoHXZeB0PkcvFDAPhla7C2'

async function run() {
  console.log('Starting Vite server for Phase 3 capture...')
  const server = await createServer({
    root: rootDir,
    server: { port: 5197 },
  })
  await server.listen()
  const port = server.config.server.port
  const baseUrl = `http://localhost:${port}`
  console.log(`Vite server running at ${baseUrl}`)

  const browser = await chromium.launch({ headless: true })

  const viewports = {
    desktop: { width: 1280, height: 800 },
    mobile: { width: 390, height: 844 },
  }

  const mockBusiness = {
    businessName: 'Patil Engineering Works',
    ownerName: 'Ramesh Patil',
    city: 'Pune',
    gstin: '27ABCDE1234F1Z5',
    type: 'Manufacturer',
    turnover: '₹40 lakh – ₹5 crore',
    ownerUid: TEST_UID,
  }

  const mockAccess = {
    role: 'owner',
    department: null,
    status: 'active',
    effectiveFeatures: ['document_parser', 'cash_dashboard', 'invoice_generator', 'india_localized'],
    invitePending: false,
  }

  const mockPlan = {
    type: 'tier',
    tierId: 'growth',
    price: 2499,
    seatsIncluded: 5,
    extraSeats: 1,
    featureIds: ['document_parser', 'cash_dashboard', 'invoice_generator', 'india_localized'],
  }

  const mockSubscription = {
    order_id: 'order_mock_12345',
    status: 'active',
    plan_tier: 'growth',
    amount: 2998,
    paid_at: new Date().toISOString(),
  }

  async function capturePage(pageName, urlPath, viewportKey, lang, theme, authSetup = false, subStatus = 'active') {
    const context = await browser.newContext({
      viewport: viewports[viewportKey],
    })
    const page = await context.newPage()

    const currentSub = {
      ...mockSubscription,
      status: subStatus,
    }

    // Mock backend API requests
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
      } else if (url.includes('/api/documents')) {
        await route.fulfill({
          status: 200,
          headers,
          body: JSON.stringify({ documents: [] }),
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

    const filename = `${pageName}_${viewportKey}_${lang}_${theme}.png`
    const filePath = path.join(outDir, filename)
    await page.screenshot({ path: filePath, fullPage: true })
    console.log(`Captured: ${filename} (URL: ${page.url()})`)
    await context.close()
  }

  const configs = [
    { lang: 'en', theme: 'light' },
    { lang: 'en', theme: 'dark' },
    { lang: 'mr', theme: 'light' },
    { lang: 'mr', theme: 'dark' },
  ]

  // 1. Signup Page
  for (const { lang, theme } of configs) {
    for (const vp of ['desktop', 'mobile']) {
      await capturePage('signup', '/signup', vp, lang, theme, false)
    }
  }

  // 2. Business Setup Page
  for (const { lang, theme } of configs) {
    for (const vp of ['desktop', 'mobile']) {
      await capturePage('business_setup', '/business-setup', vp, lang, theme, true)
    }
  }

  // 3. Choose Plan Page
  for (const { lang, theme } of configs) {
    for (const vp of ['desktop', 'mobile']) {
      await capturePage('choose_plan', '/choose-plan', vp, lang, theme, true)
    }
  }

  // 4. Checkout Page (subscription is created/pending)
  for (const { lang, theme } of configs) {
    for (const vp of ['desktop', 'mobile']) {
      await capturePage('checkout', '/checkout', vp, lang, theme, true, 'created')
    }
  }

  // 5. Billing Page (active subscription)
  for (const { lang, theme } of configs) {
    for (const vp of ['desktop', 'mobile']) {
      await capturePage('billing', '/billing', vp, lang, theme, true, 'active')
    }
  }

  await browser.close()
  await server.close()
  console.log('Phase 3 screenshots completed successfully!')
}

run().catch((err) => {
  console.error('Error during Phase 3 capture:', err)
  process.exit(1)
})
