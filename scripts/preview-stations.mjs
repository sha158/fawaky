/**
 * preview-stations.mjs
 * Screenshots the Fawaky Stations section at three widths, and once more with
 * the Royal Tea pin selected, so the card state can be eyeballed.
 * Run: node scripts/preview-stations.mjs
 */
import { chromium } from 'playwright';

const URL = 'http://localhost:5173/';
const SHOTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 834, height: 1112 },
  { name: 'mobile', width: 390, height: 844 },
];

const browser = await chromium.launch();

for (const { name, width, height } of SHOTS) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(URL, { waitUntil: 'load' });
  await page.locator('#stations').scrollIntoViewIfNeeded();
  await page.waitForTimeout(4000); // let the Maps script land and tiles paint

  await page.locator('#stations').screenshot({ path: `scripts/preview-stations-${name}.png` });

  // Selected state: click the list row, which pans the map and opens the card.
  await page.locator('.ls-station-btn').first().click();
  await page.waitForTimeout(2500);
  await page.locator('#stations').screenshot({ path: `scripts/preview-stations-${name}-card.png` });

  const tiles = await page.locator('#stations-map img[src*="googleapis"], #stations-map canvas').count();
  console.log(`${name.padEnd(8)} ${width}x${height}  map-nodes=${tiles}  errors=${errors.length}`);
  errors.slice(0, 4).forEach((e) => console.log(`   ! ${e.slice(0, 160)}`));
  await page.close();
}

await browser.close();
