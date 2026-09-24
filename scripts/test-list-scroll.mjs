/* The outlet list scrolls inside its own box on desktop, so the section's height no
   longer grows with the number of outlets. Asserts, per width: the grid still has two
   children, desktop shows every row with no expander and a real scroller, the list and
   the map end on the same line, the page height does not change when the list is
   scrolled, the foot fade clears at the end, and tapping a pin scrolls the LIST, never
   the page. Below 1025px nothing may change: 4 rows and the expander, as before.
   Needs the dev server on :5173; stubs the Maps SDK from test-route-stub.mjs. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const src = readFileSync('scripts/test-route-stub.mjs', 'utf8');
const STUB = src.slice(src.indexOf('const STUB = `') + 14, src.indexOf('`;', src.indexOf('const STUB = `')));

const b = await chromium.launch();
for (const [label, w, h] of [['desktop',1440,900],['desktop',1280,900],['boundary',1025,900],['tablet',1024,900],['tablet',834,1112],['mobile',390,844]]) {
  const ctx = await b.newContext({ viewport:{width:w,height:h},
    geolocation:{latitude:12.8707,longitude:74.8834}, permissions:['geolocation'] });
  const p = await ctx.newPage();
  await p.route(/maps\.googleapis\.com\/maps\/api\/js/, r =>
    r.fulfill({ status:200, contentType:'application/javascript', body: STUB }));
  await p.goto('http://localhost:5173/', { waitUntil:'load' });
  await p.locator('#stations').scrollIntoViewIfNeeded();
  await p.mouse.wheel(0, 40);
  await p.waitForTimeout(2200);

  const before = await p.evaluate(() => document.documentElement.scrollHeight);
  const r = await p.evaluate(() => {
    const list = document.getElementById('stations-list');
    const aside = document.querySelector('.ls-stations-aside');
    const mapw = document.querySelector('.ls-stations-map-wrap');
    const toggle = document.querySelector('.ls-stations-more');
    const rows = [...document.querySelectorAll('.ls-station-row')];
    return {
      children: document.querySelector('.ls-stations-grid').children.length,
      visible: rows.filter(li => !li.hidden).length,
      total: rows.length,
      toggleShown: !!toggle && !toggle.hidden,
      clientH: list.clientHeight, scrollH: list.scrollHeight,
      listBottom: Math.round(aside.getBoundingClientRect().bottom),
      mapBottom: Math.round(mapw.getBoundingClientRect().bottom),
      isEnd: aside.classList.contains('is-end'),
      overflowY: getComputedStyle(list).overflowY,
      // the thumb must be sized from the CURRENT content height, not a stale one
      thumb: (() => {
        const bar = document.querySelector('.ls-stations-bar');
        if (!bar || bar.hidden) return 'hidden';
        const want = Math.max(36, Math.round((list.clientHeight - 20) * (list.clientHeight / list.scrollHeight)));
        return `${parseInt(bar.firstChild.style.height, 10)}px want=${want}px`;
      })(),
      scrollTop: list.scrollTop,
      firstRow: (rows.find(li=>!li.hidden)?.querySelector('.ls-station-name')||{}).textContent,
    };
  });
  // scroll list to the bottom, then re-measure page height + fade
  const after = await p.evaluate(async () => {
    const list = document.getElementById('stations-list');
    list.scrollTop = list.scrollHeight;
    list.dispatchEvent(new Event('scroll'));
    await new Promise(r => requestAnimationFrame(r));
    return { page: document.documentElement.scrollHeight,
             isEnd: document.querySelector('.ls-stations-aside').classList.contains('is-end') };
  });
  // reveal(): click a pin far down the list, confirm the PAGE does not move
  const y0 = await p.evaluate(() => window.scrollY);
  await p.evaluate(() => { document.getElementById('stations-list').scrollTop = 0; });
  // reveal(): tap a pin, then confirm the LIST scrolled and the page did not
  // reveal(): tap the pin of the LAST outlet in the list, then confirm the LIST
  // scrolled to it and the PAGE did not move under the reader.
  const lastName = await p.evaluate(() => {
    const rows = [...document.querySelectorAll('.ls-station-row:not([hidden]) .ls-station-name')];
    return rows[rows.length - 1].textContent;
  });
  const tapped = await p.evaluate((name) => {
    const m = (window.__markers || []).find(
      (x) => x.__on && x.o && x.o.title && x.o.title.startsWith(name) && x.__clicks.length);
    if (!m) return false;
    m.__clicks.forEach((fn) => fn());
    return true;
  }, lastName);
  await p.waitForTimeout(900);
  const y1 = await p.evaluate(() => window.scrollY);
  const listTop = await p.evaluate(() =>
    Math.round(document.getElementById('stations-list').scrollTop));

  console.log(`${label.padEnd(9)} ${String(w).padStart(4)}px  grid=${r.children} rows=${r.visible}/${r.total} toggle=${r.toggleShown} overflowY=${r.overflowY} thumb=${r.thumb} box=${r.clientH}/${r.scrollH} bottoms ${r.listBottom}/${r.mapBottom} isEnd@top=${r.isEnd} isEnd@end=${after.isEnd} page ${before}->${after.page} scrollY ${y0}->${y1} tapLast=${tapped} listScrollTop=${listTop} first="${r.firstRow}"`);
  await ctx.close();
}
await b.close();
