/* Stubbed verification of the auto-routing flow: geolocation granted, denied, and
   route cleanup on collapse. Stubs Google entirely — proves our logic, not theirs. */
import { chromium } from 'playwright';

const STUB = `
window.__polylines = [];
window.__directionsCalls = 0;
window.__lastFit = null;
function LL(lat,lng){ return {lat:function(){return lat;},lng:function(){return lng;}}; }
window.google = { maps: {
  Size:function(w,h){this.w=w;this.h=h;}, Point:function(x,y){this.x=x;this.y=y;},
  Animation:{BOUNCE:1},
  LatLngBounds:function(){ this.extend=function(){return this;}; },
  event:{trigger(){},addListenerOnce(){}},
  Polyline:function(o){ this.o=o; window.__polylines.push(this);
    this.setMap=function(m){ if(m===null) window.__polylines=window.__polylines.filter(p=>p!==this); }; },
  importLibrary:function(name){
    if (name !== 'routes') return Promise.resolve({});
    return Promise.resolve({ Route: { computeRoutes: function(req){
      window.__directionsCalls++;
      if (window.__forceStatus) return Promise.reject(new Error(window.__forceStatus));
      return Promise.resolve({ routes:[{
        path:[LL(12.90,74.84),LL(12.88,74.85),LL(12.855757,74.8537288)],
        viewport:{__b:true}, distanceMeters:5400, durationMillis:840000 }] });
    }}});
  },
  Map:function(el,opts){ this._z=opts.zoom; el.style.background='#eef1e6'; el.style.position='relative';
    el.innerHTML='<div id="stub-pin" style="position:absolute;left:50%;top:50%;width:56px;height:70px;background:#5E1F78"></div>';
    this.setOptions=function(o){Object.assign(this,o);}; this.setZoom=function(z){this._z=z;};
    this.getZoom=function(){return this._z;}; this.setCenter=function(){}; this.panTo=function(){};
    this.fitBounds=function(b,p){ window.__lastFit={b:b,p:p}; }; this.addListener=function(){}; },
  Marker:function(o){ this.o=o; this.addListener=function(e,fn){ var p=document.getElementById('stub-pin'); if(p) p.onclick=fn; };
    this.setAnimation=function(){}; },
}};
if (window.__fawakyMapsReady) window.__fawakyMapsReady();
`;

const browser = await chromium.launch();
const out = [];

async function run(label, { grant, forceStatus }) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    geolocation: { latitude: 12.9010, longitude: 74.8400 }, // Mangaluru, north of the station
    permissions: grant ? ['geolocation'] : [],
  });
  const page = await ctx.newPage();
  const loud = [];
  page.on('pageerror', e => loud.push(String(e)));
  page.on('console', m => m.type() === 'error' && loud.push(m.text()));

  await page.route(/maps\.googleapis\.com\/maps\/api\/js/, r =>
    r.fulfill({ status: 200, contentType: 'application/javascript', body: STUB }));
  if (forceStatus) await page.addInitScript(s => { window.__forceStatus = s; }, forceStatus);

  await page.goto('http://localhost:5173/', { waitUntil: 'load' });
  await page.locator('#stations').scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 50); // first gesture — this is what primes location
  await page.waitForTimeout(3000);

  // The route must already be drawn WITHOUT expanding.
  const collapsed = await page.evaluate(() => ({
    lines: window.__polylines.length,
    rowDist: (document.querySelector('.ls-station-dist') || {}).textContent || '',
    rowHidden: (document.querySelector('.ls-station-dist') || {}).hidden,
    cardOpen: !!document.querySelector('.ls-station-card.is-open'),
    hintVisible: (() => { const h = document.getElementById('stations-hint');
      return h ? getComputedStyle(h).opacity === '1' : false; })(),
  }));

  await page.locator('#stations-expand').click();
  await page.waitForTimeout(2500);

  const r = await page.evaluate(() => ({
    lines: window.__polylines.length,
    calls: window.__directionsCalls,
    fitted: !!window.__lastFit,
    routeText: (document.querySelector('.ls-station-card-route') || {}).textContent || '',
    routeHidden: (document.querySelector('.ls-station-card-route') || {}).hidden,
    cardOpen: !!document.querySelector('.ls-station-card.is-open'),
  }));

  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  const afterCollapse = await page.evaluate(() => window.__polylines.length);

  // A second expand must not re-bill.
  await page.locator('#stations-expand').click();
  await page.waitForTimeout(2000);
  const callsAfterSecond = await page.evaluate(() => window.__directionsCalls);

  out.push({ label, collapsed, ...r, afterCollapse, callsAfterSecond, loud: loud.length });
  await page.screenshot({ path: `/private/tmp/claude-501/-Users-shamshuttechlab-com-Documents-fawaky/ed84bd38-997c-4789-8bf9-6f3990f5f803/scratchpad/r-${label}.png` });
  await ctx.close();
}

await run('granted', { grant: true });
await run('denied', { grant: false });
await run('req-denied', { grant: true, forceStatus: 'PERMISSION_DENIED: Routes API not enabled' });

await browser.close();
for (const r of out) {
  const c = r.collapsed;
  console.log(`${r.label.padEnd(11)} COLLAPSED lines=${c.lines} row="${c.rowDist}" card=${c.cardOpen} hint=${c.hintVisible}`);
  console.log(`${''.padEnd(11)} EXPANDED  lines=${r.lines} calls=${r.calls}->${r.callsAfterSecond} card=${r.cardOpen} afterCollapse=${r.afterCollapse} errors=${r.loud}`);
}
