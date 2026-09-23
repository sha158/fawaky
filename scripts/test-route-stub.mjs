/* Stubbed verification of the auto-routing flow: geolocation granted, denied, and
   route cleanup on collapse. Stubs Google entirely — proves our logic, not theirs. */
import { chromium } from 'playwright';

const STUB = `
window.__polylines = [];
window.__directionsCalls = 0;
window.__lastFit = null;
window.__idle = [];
// Roughly zoom-13 pixels per degree at this latitude, so cluster distances behave
// like the real map. Tests can change it to simulate zooming in.
window.__pxPerDeg = 6000;
function LL(lat,lng){ return {lat:function(){return lat;},lng:function(){return lng;}}; }
window.google = { maps: {
  Size:function(w,h){this.w=w;this.h=h;}, Point:function(x,y){this.x=x;this.y=y;},
  Animation:{BOUNCE:1},
  SymbolPath:{CIRCLE:0},
  LatLng:function(lat,lng){ this.__lat=lat; this.__lng=lng;
    this.lat=function(){return lat;}; this.lng=function(){return lng;}; },
  LatLngBounds:function(){ var pts=[];
    this.extend=function(p){ pts.push(p); return this; };
    this.getNorthEast=function(){ return LL(Math.max.apply(null,pts.map(function(p){return p.lat;})),
                                            Math.max.apply(null,pts.map(function(p){return p.lng;}))); };
    this.getSouthWest=function(){ return LL(Math.min.apply(null,pts.map(function(p){return p.lat;})),
                                            Math.min.apply(null,pts.map(function(p){return p.lng;}))); };
    this.__pts=pts; },
  event:{ trigger:function(){}, addListenerOnce:function(){} },
  OverlayView: class {
    setMap(m){ if(m){ this.onAdd&&this.onAdd(); this.draw&&this.draw(); } else { this.onRemove&&this.onRemove(); } }
    getPanes(){ return { floatPane: document.getElementById('stations-map') }; }
    getProjection(){ return {
      fromLatLngToDivPixel: function(ll){
        return { x: (ll.__lng - 74.85) * window.__pxPerDeg, y: (12.88 - ll.__lat) * window.__pxPerDeg };
      },
      fromDivPixelToLatLng: function(pt){
        return { lat: 12.88 - pt.y / window.__pxPerDeg, lng: 74.85 + pt.x / window.__pxPerDeg,
                 __lat: 12.88 - pt.y / window.__pxPerDeg, __lng: 74.85 + pt.x / window.__pxPerDeg };
      }
    }; }
  },
  Polyline:function(o){ this.o=o; window.__polylines.push(this);
    this.setMap=function(m){ if(m===null) window.__polylines=window.__polylines.filter(function(p){return p!==this;},this); }; },
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
    this.setOptions=function(o){Object.assign(this,o);}; this.setZoom=function(z){this._z=z;};
    this.getZoom=function(){return this._z;}; this.setCenter=function(){}; this.panTo=function(){};
    this.fitBounds=function(b,p){ window.__lastFit={b:b,p:p}; };
    this.addListener=function(ev,fn){ if(ev==='idle'){ window.__idle.push(fn); setTimeout(fn,0); } }; },
  Marker:function(o){ this.o=o; this.__clicks=[]; this.__on = !!o.map; this.__pos = o.position;
    this.setPosition=function(p){ this.__pos = p; };
    this.setIcon=function(ic){ this.o.icon = ic; };
    window.__markers = window.__markers || []; window.__markers.push(this);
    this.setMap=function(m){ this.__on = !!m; };
    this.addListener=function(e,fn){ this.__clicks.push(fn); };
    this.setAnimation=function(){}; },
}};
window.__clusterState = function(){
  var ms = window.__markers || [];
  var on = ms.filter(function(m){ return m.__on; });
  var pins = on.filter(function(m){ return m.o && m.o.icon && m.o.icon.url; });
  // Minimum on-screen separation between drawn pins — the whole point of fanning.
  var minSep = Infinity, ppd = window.__pxPerDeg;
  for (var i=0;i<pins.length;i++) for (var j=i+1;j<pins.length;j++) {
    var a=pins[i].__pos, b=pins[j].__pos;
    if(!a||!b) continue;
    var dx=((b.lng!==undefined?b.lng:b.__lng)-(a.lng!==undefined?a.lng:a.__lng))*ppd;
    var dy=((b.lat!==undefined?b.lat:b.__lat)-(a.lat!==undefined?a.lat:a.__lat))*ppd;
    minSep = Math.min(minSep, Math.hypot(dx,dy));
  }
  var leaders = (window.__polylines||[]).filter(function(l){
    return l.o && l.o.strokeColor === '#92B83D'; }).length;
  return { bubbles: on.filter(function(m){ return m.o && m.o.label; })
                      .map(function(m){ return m.o.label.text; }),
           pins: pins.length, leaders: leaders,
           minSep: isFinite(minSep) ? Math.round(minSep) : null };
};
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
    dot: !!document.querySelector('.ls-you-dot'),
    cluster: window.__clusterState(),
    rowsTotal: document.querySelectorAll('.ls-station-row').length,
    rowsVisible: Array.from(document.querySelectorAll('.ls-station-row')).filter(r => !r.hidden).length,
    firstRow: (document.querySelector('.ls-station-row:not([hidden]) .ls-station-name') || {}).textContent || '',
    toggle: (document.querySelector('.ls-stations-more') || {}).textContent || '',
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
  console.log(`${r.label.padEnd(11)} COLLAPSED lines=${c.lines} dot=${c.dot} rows=${c.rowsVisible}/${c.rowsTotal} first="${c.firstRow}" bubbles=[${c.cluster.bubbles}] pins=${c.cluster.pins} toggle="${c.toggle}" card=${c.cardOpen} hint=${c.hintVisible}`);
  console.log(`${''.padEnd(11)} EXPANDED  lines=${r.lines} calls=${r.calls}->${r.callsAfterSecond} card=${r.cardOpen} afterCollapse=${r.afterCollapse} errors=${r.loud}`);
}
