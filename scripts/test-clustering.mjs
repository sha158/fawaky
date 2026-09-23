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

for (const z of [6000, 24000, 96000, 400000]) {
  const st = await p.evaluate((px) => {
    window.__pxPerDeg = px;
    window.__idle.forEach(fn => fn());
    return window.__clusterState();
  }, z);
  console.log(`px/deg ${String(z).padStart(6)}  bubbles=[${st.bubbles}] singlePins=${st.pins}  (total ${st.bubbles.reduce((a,c)=>a+ +c,0)+st.pins})`);
}

// Zoom right in, then click the Badriya/H.N bubble that can never split.
await p.evaluate(() => { window.__pxPerDeg = 2000000; window.__idle.forEach(fn => fn()); });
const clicked = await p.evaluate(() => {
  const bubble = (window.__markers||[]).find(m => m.__on && m.o && m.o.label);
  if (!bubble) return 'no bubble left';
  bubble.__clicks.forEach(fn => fn());
  return bubble.o.title;
});
await p.waitForTimeout(600);
const flagged = await p.evaluate(() =>
  Array.from(document.querySelectorAll('.ls-station-btn.is-flagged'))
       .map(b => b.querySelector('.ls-station-name').textContent));
console.log('coincident bubble        :', clicked);
console.log('rows flagged on click    :', flagged);
await b.close();
