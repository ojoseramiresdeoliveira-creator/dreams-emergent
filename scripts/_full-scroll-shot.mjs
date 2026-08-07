// Dev-only helper: scrolls the whole landing page in small steps (so every
// ScrollTrigger onEnter along the way actually fires, same as a real user
// scrolling down), then takes a full-page screenshot of the settled result.
// Used for the final cross-section visual-consistency check.
import { chromium } from 'playwright';

const [, , outPath, viewport = 'desktop'] = process.argv;
const viewports = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: viewports[viewport] || viewports.desktop });

const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(`console: ${m.text()}`); });

await page.goto('http://localhost:3000', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(1500);

const height = await page.evaluate(() => document.body.scrollHeight);
const step = viewports[viewport]?.height ?? 900;
for (let y = 0; y < height; y += step * 0.8) {
  await page.evaluate((yy) => window.scrollTo(0, yy), y);
  await page.waitForTimeout(350); // let this slice's ScrollTrigger onEnter fire
}
// bottom, then settle
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(1000);
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(500);

await page.screenshot({ path: outPath, fullPage: true });
console.log('ERRORS:', errors.length ? JSON.stringify(errors) : 'none');
await browser.close();
