import { createServer } from 'vite'
import { chromium } from 'playwright'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const outDir = path.resolve(__dirname, '../../../docs/ui-theme-f1/phase1')

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true })
}

const TEST_EMAIL = 'theme.f1.tester@example.com'
const TEST_PASSWORD = 'Password123!'
const TEST_UID = 'Gl87OfnoHXZeB0PkcvFDAPhla7C2'

async function run() {
  console.log('Starting Vite server...')
  const server = await createServer({
    root: rootDir,
    server: { port: 5199 },
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
    extraSeats: 0,
    featureIds: ['document_parser', 'cash_dashboard', 'invoice_generator', 'india_localized'],
  }

  const mockSubscription = {
    status: 'active',
    planTier: 'growth',
  }

  async function capture(pageName, urlPath, viewportKey, lang, theme, authSetup = false) {
    const context = await browser.newContext({
      viewport: viewports[viewportKey],
    })
    const page = await context.newPage()

    // Mock backend API requests
    await page.route('**/api/**', async (route) => {
      const url = route.request().url()
      if (url.includes('/api/me')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
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
              extra_seats: 0,
              feature_ids: mockPlan.featureIds,
            },
            subscription: {
              status: 'active',
              plan_tier: 'growth',
            },
          }),
        })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true }),
        })
      }
    })

    if (authSetup) {
      // 1. Visit /login
      await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' })

      // Seed localStorage before sign in
      await page.evaluate(
        ({ uid, mockBusiness, mockAccess, mockPlan, mockSubscription, theme, lang }) => {
          localStorage.setItem('msme-theme', theme)
          localStorage.setItem('i18nextLng', lang)
          localStorage.setItem(`msme-business-${uid}`, JSON.stringify(mockBusiness))
          localStorage.setItem(`msme-onboarded-${uid}`, 'true')
          localStorage.setItem(`msme-access-${uid}`, JSON.stringify(mockAccess))
          localStorage.setItem(`msme-plan-${uid}`, JSON.stringify(mockPlan))
          localStorage.setItem(`msme-subscription-${uid}`, JSON.stringify(mockSubscription))
        },
        { uid: TEST_UID, mockBusiness, mockAccess, mockPlan, mockSubscription, theme, lang }
      )

      // 2. Perform real Firebase login
      await page.locator('input[type="email"], input[placeholder="you@example.com"]').fill(TEST_EMAIL)
      await page.locator('input[type="password"]').fill(TEST_PASSWORD)
      await page.locator('button[type="submit"]').click()

      // 3. Wait for auth completion
      try {
        await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 })
      } catch (e) {
        console.log('Login redirect wait error:', e.message)
      }

      // Re-apply localStorage & theme classes
      await page.evaluate(
        ({ uid, mockBusiness, mockAccess, mockPlan, mockSubscription, theme, lang }) => {
          localStorage.setItem('msme-theme', theme)
          localStorage.setItem('i18nextLng', lang)
          localStorage.setItem(`msme-business-${uid}`, JSON.stringify(mockBusiness))
          localStorage.setItem(`msme-onboarded-${uid}`, 'true')
          localStorage.setItem(`msme-access-${uid}`, JSON.stringify(mockAccess))
          localStorage.setItem(`msme-plan-${uid}`, JSON.stringify(mockPlan))
          localStorage.setItem(`msme-subscription-${uid}`, JSON.stringify(mockSubscription))
          if (theme === 'dark') {
            document.documentElement.classList.add('dark')
          } else {
            document.documentElement.classList.remove('dark')
          }
          document.documentElement.setAttribute('lang', lang)
        },
        { uid: TEST_UID, mockBusiness, mockAccess, mockPlan, mockSubscription, theme, lang }
      )

      // Navigate directly to /dashboard
      await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'networkidle', timeout: 15000 })
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

      await page.goto(`${baseUrl}${urlPath}`, { waitUntil: 'networkidle', timeout: 15000 })
    }

    await page.waitForTimeout(1000)

    console.log(`Page URL for ${pageName} (${viewportKey}, ${lang}, ${theme}): ${page.url()}`)

    const filename = `${pageName}_${viewportKey}_${lang}_${theme}.png`
    const filePath = path.join(outDir, filename)
    await page.screenshot({ path: filePath, fullPage: true })
    console.log(`Captured: ${filename}`)
    await context.close()
  }

  // 1. Landing Page (desktop & mobile, en & mr, light & dark)
  for (const lang of ['en', 'mr']) {
    for (const theme of ['light', 'dark']) {
      for (const vp of ['desktop', 'mobile']) {
        await capture('landing', '/', vp, lang, theme, false)
      }
    }
  }

  // 2. Login Page (desktop & mobile, light & dark)
  for (const theme of ['light', 'dark']) {
    for (const vp of ['desktop', 'mobile']) {
      await capture('login', '/login', vp, 'en', theme, false)
    }
  }

  // 3. Dashboard Page (desktop & mobile, en & mr, light & dark)
  for (const lang of ['en', 'mr']) {
    for (const theme of ['light', 'dark']) {
      for (const vp of ['desktop', 'mobile']) {
        await capture('dashboard', '/dashboard', vp, lang, theme, true)
      }
    }
  }

  await browser.close()
  await server.close()
  console.log('All screenshots completed successfully!')
}

run().catch((err) => {
  console.error('Error during capture:', err)
  process.exit(1)
})
