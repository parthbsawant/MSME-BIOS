import { createServer } from 'vite'
import { chromium } from 'playwright'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const outDir = path.resolve(__dirname, '../../../docs/ui-theme-f1/phase2')

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true })
}

async function run() {
  console.log('Starting Vite server for Phase 2 capture...')
  const server = await createServer({
    root: rootDir,
    server: { port: 5198 },
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

  async function captureLanding(viewportKey, lang, theme, scroll = false) {
    const context = await browser.newContext({
      viewport: viewports[viewportKey],
    })
    const page = await context.newPage()

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

    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle', timeout: 15000 })
    await page.waitForTimeout(1000)

    if (scroll) {
      await page.evaluate(() => window.scrollTo(0, 300))
      await page.waitForTimeout(500)
    }

    const scrollSuffix = scroll ? '_scrolled' : ''
    const filename = `landing_${viewportKey}_${lang}_${theme}${scrollSuffix}.png`
    const filePath = path.join(outDir, filename)
    await page.screenshot({ path: filePath, fullPage: !scroll })
    console.log(`Captured: ${filename}`)
    await context.close()
  }

  // Capture across English and Marathi, Light and Dark, Desktop and Mobile
  for (const lang of ['en', 'mr']) {
    for (const theme of ['light', 'dark']) {
      for (const vp of ['desktop', 'mobile']) {
        await captureLanding(vp, lang, theme, false)
      }
    }
  }

  // Also capture scrolled state to verify navbar transition
  await captureLanding('desktop', 'en', 'light', true)
  await captureLanding('desktop', 'en', 'dark', true)

  await browser.close()
  await server.close()
  console.log('Phase 2 screenshots completed successfully!')
}

run().catch((err) => {
  console.error('Error during Phase 2 capture:', err)
  process.exit(1)
})
