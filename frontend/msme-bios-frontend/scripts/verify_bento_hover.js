import { chromium } from 'playwright'
import { createServer } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const outDir = path.resolve(rootDir, '../../docs/ui-theme-f1/phase5')

async function run() {
  const server = await createServer({
    root: rootDir,
    server: { port: 5200 },
  })
  await server.listen()
  const baseUrl = 'http://localhost:5200'

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()

  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1000)

  // Scroll to features section
  const featuresSection = page.locator('#features')
  await featuresSection.scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)

  // Capture rest state
  await page.screenshot({ path: path.join(outDir, 'bento_rest_state.png') })
  console.log('Captured bento rest state')

  // Hover over the second card (Document Digitization - Cobalt)
  const cobaltCard = page.locator('.bento-card-cobalt')
  await cobaltCard.hover()
  await page.waitForTimeout(600) // mid-transition / revealed state
  await page.screenshot({ path: path.join(outDir, 'bento_cobalt_hovered.png') })
  console.log('Captured cobalt hovered state')

  // Hover over the first card (Business Tracking - Blue)
  const blueCard = page.locator('.bento-card-blue')
  await blueCard.hover()
  await page.waitForTimeout(600)
  await page.screenshot({ path: path.join(outDir, 'bento_blue_hovered.png') })
  console.log('Captured blue hovered state')

  await browser.close()
  await server.close()
  console.log('Hover verification complete!')
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
