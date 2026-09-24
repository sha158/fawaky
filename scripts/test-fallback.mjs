/* What a visitor gets when the map does not come up. Two ways in: the script never
   arrives (blocked or a dead connection), and Google loading fine and then rejecting
   the key, which is the only case that fires gm_authFailure. Either way the panel
   has to name the NEAREST outlet by the visitor's own location and hand Google Maps
   both ends of the trip, since there is no map here to draw a line on.
   Needs the dev server on :5173. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const src = readFileSync('scripts/test-route-stub.mjs', 'utf8');
const STUB = src.slice(src.indexOf('const STUB = `') + 14, src.indexOf('`;', src.indexOf('const STUB = `')));

const PADIL = { latitude: 12.8707, longitude: 74.8834 };
const b = await chromium.launch();

async function open({ block, auth, geo = true }) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    geolocation: PADIL, permissions: geo ? ['geolocation'] : [] });
  const p = await ctx.newPage();
  const warns = [];
  p.on('console', (m) => { if (m.text().includes('[fawaky]')) warns.push(m.text()); });
  if (block) await p.route(/maps\.googleapis\.com/, (r) => r.abort());
  else await p.route(/maps\.googleapis\.com\/maps\/api\/js/, (r) =>
    r.fulfill({ status: 200, contentType: 'application/javascript', body: STUB }));
  await p.goto('http://localhost:5173/', { waitUntil: 'load' });
  await p.locator('#stations').scrollIntoViewIfNeeded();
  await p.mouse.wheel(0, 40);
  if (auth) { await p.waitForTimeout(2500); await p.evaluate(() => window.gm_authFailure()); }
  await p.waitForTimeout(block ? 11000 : 2500);
  const r = await p.evaluate(() => {
    const panel = document.querySelector('.ls-station-fallback');
    const cta = panel && panel.querySelector('.ls-station-card-cta');
    const rows = [...document.querySelectorAll('.ls-station-row .ls-station-name')];
    return {
      panel: !!panel,
      note: panel ? panel.querySelector('#stations-fallback-note').textContent : '',
      ctaText: cta && !cta.hidden ? cta.textContent : '(hidden)',
      href: (cta && cta.getAttribute('href')) || '',
      retry: !!(panel && panel.querySelector('.ls-station-fallback-retry')),
      first: rows[0] ? rows[0].textContent : '',
      firstDist: (document.querySelector('.ls-station-dist') || {}).textContent || '',
    };
  });
  await ctx.close();
  return { ...r, retries: warns.filter((w) => w.includes('retrying')).length };
}

for (const [label, opts] of [
  ['script blocked', { block: true }],
  ['key rejected  ', { auth: true }],
  ['no location   ', { auth: true, geo: false }],
]) {
  const r = await open(opts);
  const dest = (r.href.match(/destination=([\d.]+,[\d.]+)/) || [])[1] || '-';
  const origin = (r.href.match(/origin=([\d.]+,[\d.]+)/) || [])[1] || '-';
  console.log(`${label} panel=${r.panel} retries=${r.retries} first="${r.first}" (${r.firstDist})`);
  console.log(`                note="${r.note}"`);
  console.log(`                cta="${r.ctaText}" origin=${origin} destination=${dest} retry=${r.retry}`);
}
await b.close();
