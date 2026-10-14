import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const src = readFileSync('scripts/test-route-stub.mjs', 'utf8');
const STUB = src.slice(src.indexOf('const STUB = `') + 14, src.indexOf('`;', src.indexOf('const STUB = `')));

const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:1440,height:900},
  geolocation:{latitude:12.8707,longitude:74.8834}, permissions:['geolocation'] }); // Padil
const p = await ctx.newPage();
await p.route(/maps\.googleapis\.com\/maps\/api\/js/, r =>
  r.fulfill({ status:200, contentType:'application/javascript', body: STUB }));
await p.goto('http://localhost:5173/', { waitUntil:'load' });
await p.locator('#stations').scrollIntoViewIfNeeded();
await p.mouse.wheel(0, 40);
await p.waitForTimeout(2500);

console.log('nearest to a Padil origin :', await p.evaluate(() =>
  (document.querySelector('.ls-station-row:not([hidden]) .ls-station-name')||{}).textContent));

const total = await p.evaluate(() => document.querySelectorAll('.ls-station-row').length);
// Every outlet drawn on its own coordinate at every zoom: as a pin where it has room,
// a dot where it would cover a neighbour. No leader lines, no pin bodies overlapping.
let ok = true;
for (const z of [6000, 24000, 96000, 400000, 2000000]) {
  const st = await p.evaluate((px) => {
    window.__pxPerDeg = px;
    window.__idle.forEach(fn => fn());
    return window.__clusterState();
  }, z);
  const pass = st.drawn === total && st.leaders === 0 && st.displaced === 0
    && st.overlapping === 0 && st.bubbles.length === 0;
  ok = ok && pass;
  console.log(`px/deg ${String(z).padStart(7)}  drawn=${st.drawn}/${total} pins=${st.pins} dots=${st.dots} bubbles=${st.bubbles.length} leaders=${st.leaders} displaced=${st.displaced}px overlapping=${st.overlapping} minSeparation=${st.minSep}px ${pass ? 'ok' : 'FAIL'}`);
}

// Tapping an outlet makes it a pin even where its neighbours stay dots.
const tapped = await p.evaluate(() => {
  window.__pxPerDeg = 6000; window.__idle.forEach(fn => fn());
  const dot = (window.__markers || []).find(m => m.__on && m.o.icon && m.o.icon.path !== undefined);
  if (!dot) return { title: 'no dot at overview zoom', pin: false };
  dot.__clicks.forEach(fn => fn());
  return { title: dot.o.title, pin: !!dot.o.icon.url, z: dot.o.zIndex };
});
ok = ok && tapped.pin;
console.log(`tapped dot becomes a pin : ${tapped.pin} (z=${tapped.z}) ${tapped.title}`);
console.log(ok ? 'PASS' : 'FAIL');
await b.close();
