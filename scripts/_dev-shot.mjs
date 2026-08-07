// Throwaway dev-only helper: screenshots one section of the local landing
// page before and after its scroll-reveal fires, for visual review during
// the GSAP migration. Not part of the app bundle — lives outside app/.
import { chromium } from 'playwright';

const [, , selector, outPrefix, viewport = 'desktop', reducedMotion = 'no'] = process.argv;
if (!selector || !outPrefix) {
  console.error('usage: node scripts/_dev-shot.mjs <selector> <outPrefix> [desktop|mobile] [reduced|no]');
  process.exit(1);
}

const viewports = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: viewports[viewport] || viewports.desktop,
  reducedMotion: reducedMotion === 'reduced' ? 'reduce' : 'no-preference',
});

const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

await page.goto('http://localhost:3000', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(1500); // hydration + fonts settle

const el = page.locator(selector).first();
await el.scrollIntoViewIfNeeded();
// One frame after scrollIntoViewIfNeeded, before ScrollTrigger's onEnter has
// necessarily fired — captures the pre-reveal (hidden) state.
await page.waitForTimeout(50);
await page.screenshot({ path: `${outPrefix}-before.png` });

await page.waitForTimeout(1800); // let the reveal play out fully
await page.screenshot({ path: `${outPrefix}-after.png` });

console.log('ERRORS:', errors.length ? JSON.stringify(errors) : 'none');
await browser.close();
