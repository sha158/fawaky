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

    // Click a pin that is actually on screen. With several stations, the first
    // marker in DOM order may be clustered away or sitting outside the viewport,
    // and clicking its reported box then hits nothing.
    // Aim at the bubble rather than the bounding-box centre -- the centre lands on
    // the teardrop's transparent tip, outside Google's hit area.
    const pins = page.locator('#stations-map img[src*="map-pin"]');
    const n = await pins.count();
    let clickedPin = false;
    for (let i = 0; i < n; i += 1) {
      const box = await pins.nth(i).boundingBox();
      if (!box) continue;
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height * 0.35;
      if (cx < 0 || cy < 0 || cx > width || cy > height) continue;
      await page.mouse.click(cx, cy);
      clickedPin = true;
      break;
    }
    await page.waitForTimeout(2000);
    const cardOpen = await page.locator('.ls-station-card').isVisible();
    const cta = await page.locator('.ls-station-card-cta').getAttribute('href').catch(() => '');
    // Any station's coordinates, not one hardcoded outlet.
    const ctaOk = /destination=-?\d+\.\d+,-?\d+\.\d+/.test(cta || '') && clickedPin;
    await page.screenshot({ path: `scripts/preview-stations-${name}-expanded-card.png` });

    // Escape should restore the tile.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1200);
    const closed = !(await page.locator('.ls-stations-overlay').isVisible());
    const unlocked = await page.evaluate(() => !document.body.classList.contains('is-map-expanded'));
    console.log(`${name.padEnd(8)} ${String(width).padStart(4)}px  expand=${hasExpand} overlay=${overlay} lock=${scrollLocked} pin-tap=${cardOpen} directions=${ctaOk} esc-closed=${closed} unlocked=${unlocked} errors=${errors.length}`);
  } else {
    console.log(`${name.padEnd(8)} ${String(width).padStart(4)}px  NO EXPAND BUTTON (fallback?)  errors=${errors.length}`);
  }

  errors.slice(0, 3).forEach((e) => console.log(`   ! ${e.slice(0, 150)}`));
  await page.close();
}

await browser.close();
