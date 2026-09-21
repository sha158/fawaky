/**
 * preview-stations.mjs
 * Screenshots the Fawaky Stations section at three widths: collapsed, expanded,
 * and expanded with a station selected.
 * Run: node scripts/preview-stations.mjs [url]
 */
import { chromium } from 'playwright';

const URL = process.argv[2] || 'http://localhost:5173/';
const SHOTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 834, height: 1112 },
  { name: 'mobile', width: 390, height: 844 },
];

const browser = await chromium.launch();
console.log(`testing ${URL}\n`);

for (const { name, width, height } of SHOTS) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(URL, { waitUntil: 'load' });
  await page.locator('#stations').scrollIntoViewIfNeeded();
  await page.waitForTimeout(4000); // let the Maps script land and tiles paint

  await page.locator('#stations').screenshot({ path: `scripts/preview-stations-${name}.png` });

  const hasExpand = await page.locator('#stations-expand').isVisible().catch(() => false);
  let overlay = false;
  let scrollLocked = false;

  if (hasExpand) {
    await page.locator('#stations-expand').click();
    await page.waitForTimeout(2500);
    overlay = await page.locator('.ls-stations-overlay').isVisible();
    scrollLocked = await page.evaluate(() => document.body.classList.contains('is-map-expanded'));
    await page.screenshot({ path: `scripts/preview-stations-${name}-expanded.png` });

    await page.locator('#stations-map img[src*="map-pin"]').first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `scripts/preview-stations-${name}-expanded-card.png` });

    // Escape should restore the tile.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1200);
    const closed = !(await page.locator('.ls-stations-overlay').isVisible());
    const unlocked = await page.evaluate(() => !document.body.classList.contains('is-map-expanded'));
    console.log(`${name.padEnd(8)} ${String(width).padStart(4)}px  expand=${hasExpand} overlay=${overlay} lock=${scrollLocked} esc-closed=${closed} unlocked=${unlocked} errors=${errors.length}`);
  } else {
    console.log(`${name.padEnd(8)} ${String(width).padStart(4)}px  NO EXPAND BUTTON (fallback?)  errors=${errors.length}`);
  }

  errors.slice(0, 3).forEach((e) => console.log(`   ! ${e.slice(0, 150)}`));
  await page.close();
}

await browser.close();
