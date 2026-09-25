/* Fawaky Stations — the store locator map.
   Loaded lazily from main.js: the Maps script is only fetched once the section
   is near the viewport, so visitors who never scroll this far cost nothing. */

import {
  STATIONS, MAP_CENTER, MAP_ZOOM, FOCUS_ZOOM, directionsUrl, nearestStation,
  stationsByDistance,
} from './stations-data.js';
// Imported, not a runtime '/assets/...' string: that way Vite emits and hashes
// the file. A bare path resolves in dev but 404s in the production build.
import PIN from './assets/map-pin.png';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* How far to lift the marker above the bottom sheet, in pixels. The sheet covers a
   very different share of a 380px tile than of a full viewport, so the two modes
   need their own value. Both are empirical -- confirm by screenshot when changing
   them, since a computed sheetHeight/2 measured wrong in practice. */
const OFFSET_PX = { collapsed: 55, expanded: 120 };

/* Light basemap, decluttered and nudged toward the brand. Inline styles work
   because we use the classic Marker — an AdvancedMarkerElement would need a
   cloud Map ID and would make this array a no-op. */
const MAP_STYLE = [
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f4f2ec' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#dcebc4' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#b8ddf0' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#ffd9a0' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6b6b6b' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }, { weight: 3 }] },
];

let loaderPromise = null;

/* Why the map did not come up. Google names the real cause — RefererNotAllowed,
   BillingNotEnabled, OverQuota, ApiNotActivated — only by console.error, and a
   failure on someone else's phone never reaches us otherwise, so capture it here
   and let ?mapdebug=1 print it in the panel. */
const mapFailure = { code: null, detail: null };

function watchMapErrors() {
  const original = console.error;
  console.error = function capture(...args) {
    const text = args.map((a) => (a && a.message) || String(a)).join(' ');
    const named = text.match(/\b(\w*MapError|InvalidKey\w*|ApiTargetBlocked\w*)\b/);
    if (named && !mapFailure.code) mapFailure.code = named[1];
    else if (!mapFailure.code && /Google Maps/i.test(text)) mapFailure.code = text.slice(0, 120);
    return original.apply(console, args);
  };
}

// A stalled request never fires onerror, so on a weak connection the tile would sit
// empty for ever. Give up at this point and let the caller try again.
const LOAD_TIMEOUT_MS = 15000;

function loadMapsApi() {
  if (window.google && window.google.maps) return Promise.resolve();
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise((resolve, reject) => {
    const cb = '__fawakyMapsReady';
    const s = document.createElement('script');
    let timer = null;
    const fail = (msg) => {
      clearTimeout(timer);
      delete window[cb];
      s.remove();
      loaderPromise = null; // a retry must be able to start a fresh request
      reject(new Error(msg));
    };
    window[cb] = () => { clearTimeout(timer); delete window[cb]; resolve(); };
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(API_KEY)}&callback=${cb}&loading=async&v=weekly`;
    s.async = true;
    s.onerror = () => fail('Google Maps failed to load');
    timer = setTimeout(() => fail('Google Maps timed out'), LOAD_TIMEOUT_MS);
    document.head.appendChild(s);
  });
  return loaderPromise;
}

/* ─── Visitor location ─────────────────────────────────── */

let positionPromise = null;
// The last position we actually got. Read it where awaiting would be wrong — the
// directions links, which have to carry a URL the moment they are rendered.
let lastOrigin = null;

function askBrowserForPosition() {
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null), // denied, unavailable or timed out — all the same to us
      // A café locator does not need GPS precision, and low accuracy is far
      // faster and kinder to battery.
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  });
}

/* Has the visitor hard-blocked us? Distinguishes "dismissed, could ask again" from
   "blocked in site settings", which no amount of JavaScript can reopen. */
async function locationBlocked() {
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status.state === 'denied';
  } catch {
    return false; // Permissions API unavailable — assume we may ask
  }
}

/* Resolves {lat,lng} or null. Never rejects — a missing location is an ordinary
   outcome here, not an error.

   Only a SUCCESSFUL lookup is memoised. A null result stays retryable, because the
   visitor may grant permission later via the locate button; caching the failure
   forever is what made the feature vanish with no way back. */
function getPosition() {
  if (positionPromise) return positionPromise;

  const attempt = (async () => {
    if (!navigator.geolocation) return null;
    // Never call getCurrentPosition when already blocked: it cannot prompt, and on
    // some browsers repeated calls count against the site.
    if (await locationBlocked()) return null;
    return askBrowserForPosition();
  })();

  positionPromise = attempt.then((pos) => {
    if (!pos) positionPromise = null; // keep it retryable
    else lastOrigin = pos;
    return pos;
  });

  return positionPromise;
}

/* Explicit retry from a real click — the case browsers treat most favourably, and
   the only thing that can revive a dismissed (as opposed to blocked) prompt. */
async function requestPositionFromClick() {
  if (!navigator.geolocation) return { pos: null, blocked: false };
  if (await locationBlocked()) return { pos: null, blocked: true };
  const pos = await askBrowserForPosition();
  if (pos) { positionPromise = Promise.resolve(pos); lastOrigin = pos; }
  return { pos, blocked: !pos && await locationBlocked() };
}

/* Warm the location up on the visitor's first interaction, well before they reach
   the map, so the route is already drawn when the section scrolls into view.
   A gesture-backed prompt is treated far more favourably by Chrome than a cold one,
   and a denial is permanent for that visitor -- worth the wait for a real gesture. */
function primeLocation() {
  const events = ['pointerdown', 'touchstart', 'keydown', 'scroll'];
  const onFirst = () => {
    events.forEach((ev) => window.removeEventListener(ev, onFirst));
    getPosition(); // memoised — safe to call again later
  };
  events.forEach((ev) => window.addEventListener(ev, onFirst, { once: true, passive: true }));
}

/* ─── Route ────────────────────────────────────────────── */

const ROUTE_LINE = { color: '#5E1F78', casing: '#FFFFFF' };
const routeCache = new Map(); // station.id -> {path, bounds, distance, duration} | null
let routesLib = null;
let routingDisabled = false;

const formatDistance = (m) => (m < 950 ? `${Math.round(m / 50) * 50} m` : `${(m / 1000).toFixed(1)} km`);

function formatDuration(ms) {
  const mins = Math.max(1, Math.round(ms / 60000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const r = mins % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

/* Resolves {path, bounds, distance, duration} or null; never rejects.

   Uses Route.computeRoutes from the Maps JS SDK. The older DirectionsService was
   deprecated on 2026-02-25 and is refused outright on projects that never had the
   legacy Directions API enabled. This path needs the Routes API instead.

   Billed per call, so every result — including failures — is cached per station,
   and a quota error disables routing for the session rather than retrying. */
async function fetchRoute(origin, station) {
  if (routingDisabled) return null;
  if (routeCache.has(station.id)) return routeCache.get(station.id);

  try {
    routesLib = routesLib || await google.maps.importLibrary('routes');
    const { Route } = routesLib;

    const res = await Route.computeRoutes({
      origin,
      destination: { lat: station.lat, lng: station.lng },
      travelMode: 'DRIVING',
      routingPreference: 'TRAFFIC_AWARE',
      // Ask only for what we draw and display — the field mask affects billing tier.
      // Bare property names: the "routes." prefix is REST field-mask syntax and is
      // rejected by the JS SDK.
      fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
    });

    const route = res && res.routes && res.routes[0];
    if (!route) { routeCache.set(station.id, null); return null; }

    const data = {
      path: route.path,
      bounds: route.viewport,
      distance: formatDistance(route.distanceMeters),
      duration: formatDuration(route.durationMillis),
    };
    routeCache.set(station.id, data);
    return data;
  } catch (err) {
    const msg = String((err && err.message) || err);
    if (/denied|not enabled|PERMISSION/i.test(msg)) {
      routingDisabled = true;
      console.warn('[fawaky] Routes request denied. Enable the Routes API in Google Cloud Console and add it to this key\'s API restrictions.');
    } else if (/quota|RESOURCE_EXHAUSTED|OVER_QUERY/i.test(msg)) {
      routingDisabled = true; // never retry a billed endpoint in a loop
      console.warn('[fawaky] Routes quota exhausted — routing disabled for this session.');
    } else {
      console.warn('[fawaky] Route lookup failed:', msg);
    }
    routeCache.set(station.id, null);
    return null;
  }
}

/* ─── "You are here" dot ───────────────────────────────── */

/* A DOM overlay rather than a Marker, because a Marker icon is a static image and
   cannot pulse. AdvancedMarkerElement would allow DOM content but requires a cloud
   Map ID, which would make our inline `styles` a no-op — so OverlayView it is.
   Built lazily: google.maps.OverlayView does not exist until the SDK has loaded. */
function makeYouAreHere(map, lat, lng) {
  class YouAreHere extends google.maps.OverlayView {
    onAdd() {
      this.div = document.createElement('div');
      this.div.className = 'ls-you-dot';
      this.div.setAttribute('aria-hidden', 'true');
      this.getPanes().floatPane.appendChild(this.div);
    }

    draw() {
      const projection = this.getProjection();
      if (!this.div || !projection) return;
      const point = projection.fromLatLngToDivPixel(new google.maps.LatLng(lat, lng));
      if (!point) return;
      this.div.style.left = `${point.x}px`;
      this.div.style.top = `${point.y}px`;
    }

    onRemove() {
      if (this.div) { this.div.remove(); this.div = null; }
    }
  }

  const overlay = new YouAreHere();
  overlay.setMap(map);
  return overlay;
}

/* ─── List ─────────────────────────────────────────────── */

// Every outlet is listed at every width, inside a box the list scrolls within, so
// the page's height stays the same however many outlets we add. The expander that
// used to hide the tail is gone with it.

/* Builds every row once and reorders by moving nodes, so listeners and the distance
   text survive a re-sort. Returns handles the map side uses to talk back to it. */
function renderList(listEl, onSelect) {
  listEl.innerHTML = '';
  const rows = new Map();
  const items = new Map(); // station.id -> <li>

  STATIONS.forEach((station) => {
    const li = document.createElement('li');
    li.className = 'ls-station-row';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ls-station-btn';
    btn.innerHTML = `
      <span class="ls-station-pin" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"/>
        </svg>
      </span>
      <span class="ls-station-meta">
        <span class="ls-station-name">${station.name}</span>
        <span class="ls-station-area">${station.area}</span>
        <span class="ls-station-dist" hidden></span>
      </span>`;
    btn.addEventListener('click', () => onSelect(station));

    li.appendChild(btn);
    listEl.appendChild(li);
    rows.set(station.id, btn);
    items.set(station.id, li);
  });

  // The list and everything drawn against it must be ONE grid child. The button
  // that used to live here was appended as a sibling, which made it a third item:
  // auto-placement handed it the map's column and pushed the map onto a second row.
  const aside = document.createElement('div');
  aside.className = 'ls-stations-aside';
  listEl.replaceWith(aside);
  aside.append(listEl);

  /* Our own scrollbar. macOS shows the native one only while scrolling, so nothing
     would tell a first-time reader the list scrolls; this one is always there. */
  const bar = document.createElement('div');
  bar.className = 'ls-stations-bar';
  bar.setAttribute('aria-hidden', 'true');
  const thumb = document.createElement('div');
  thumb.className = 'ls-stations-thumb';
  bar.appendChild(thumb);
  aside.appendChild(bar);

  const TRACK_INSET = 20; // matches .ls-stations-bar's top + bottom offsets

  // Plus a fade at the foot of the list, as a second "more below" cue.
  const markEnd = () => {
    const scrollable = listEl.scrollHeight - listEl.clientHeight > 1;
    aside.classList.toggle('is-end', !scrollable
      || listEl.scrollTop + listEl.clientHeight >= listEl.scrollHeight - 2);
    bar.hidden = !scrollable;
    if (!scrollable) return;
    const track = listEl.clientHeight - TRACK_INSET;
    const height = Math.max(36, Math.round(track * (listEl.clientHeight / listEl.scrollHeight)));
    const travel = listEl.scrollTop / (listEl.scrollHeight - listEl.clientHeight);
    thumb.style.height = `${height}px`;
    thumb.style.transform = `translateY(${Math.round((track - height) * travel)}px)`;
  };
  listEl.addEventListener('scroll', markEnd, { passive: true });
  window.addEventListener('resize', markEnd, { passive: true });
  markEnd();

  return {
    rows,
    /* Reorder in place by distance. Moving the existing nodes keeps their listeners
       and any distance text already written to them. */
    sortBy(order) {
      order.forEach(({ station }) => {
        const li = items.get(station.id);
        if (li) listEl.appendChild(li);
      });
      const reordered = new Map();
      order.forEach(({ station }) => reordered.set(station.id, items.get(station.id)));
      items.clear();
      reordered.forEach((li, id) => items.set(id, li));
      listEl.scrollTop = 0; // the nearest outlet just moved to the top — show it
      markEnd();
    },
    setDistance(stationId, text) {
      const btn = rows.get(stationId);
      const el = btn && btn.querySelector('.ls-station-dist');
      if (!el) return;
      el.textContent = text;
      el.hidden = !text;
      markEnd(); // the extra line makes the row taller, so the thumb must resize
    },
    /* Bring a row into the list's own box. Scrolls the list and nothing else —
       scrollIntoView walks every ancestor scrollport, which would drag the whole
       section under the reader, and on touch would fight the page scroll. */
    reveal(stationId) {
      const li = items.get(stationId);
      if (!li || listEl.scrollHeight <= listEl.clientHeight) return;
      const top = li.offsetTop;
      const bottom = top + li.offsetHeight;
      if (top >= listEl.scrollTop && bottom <= listEl.scrollTop + listEl.clientHeight) return;
      listEl.scrollTo({
        top: Math.max(0, top - (listEl.clientHeight - li.offsetHeight) / 2),
        behavior: reducedMotion ? 'auto' : 'smooth',
      });
    },
  };
}

/* Straight-line distances are free, so every row gets one and the list reorders
   nearest-first. Used with a map and without one. */
const kmLabel = (km) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);

function rankList(list, origin) {
  const ranked = stationsByDistance(origin);
  list.sortBy(ranked);
  ranked.forEach(({ station, km }) => {
    if (km != null) list.setDistance(station.id, `${kmLabel(km)} away`);
  });
  return ranked;
}

/* ─── Selected-station card ────────────────────────────── */

function buildCard(stage) {
  const card = document.createElement('div');
  card.className = 'ls-station-card';
  card.hidden = true;
  card.innerHTML = `
    <button type="button" class="ls-station-card-close" aria-label="Close">&times;</button>
    <span class="ls-station-card-handle" aria-hidden="true"></span>
    <h3 class="ls-station-card-name"></h3>
    <p class="ls-station-card-area"></p>
    <p class="ls-station-card-route" hidden></p>
    <a class="ls-station-card-cta" target="_blank" rel="noopener">Get Directions</a>`;
  stage.appendChild(card);

  const close = () => { card.hidden = true; card.classList.remove('is-open'); };
  card.querySelector('.ls-station-card-close').addEventListener('click', close);

  return {
    el: card,
    close,
    show(station, route) {
      card.querySelector('.ls-station-card-name').textContent = station.name;
      card.querySelector('.ls-station-card-area').textContent = station.area;
      card.querySelector('.ls-station-card-cta').href = directionsUrl(station, lastOrigin);

      // Stays hidden unless a route actually resolved, so the card never shows
      // an empty row.
      const routeEl = card.querySelector('.ls-station-card-route');
      if (route && route.distance && route.duration) {
        routeEl.textContent = `${route.distance} · ${route.duration} away`;
        routeEl.hidden = false;
      } else {
        routeEl.hidden = true;
      }

      card.hidden = false;
      requestAnimationFrame(() => card.classList.add('is-open'));
    },
  };
}

/* ─── Fallback — no key, or the script never arrived ───── */

function renderFallback(wrap, list) {
  wrap.classList.add('is-fallback');
  // Deliberately NOT a card per station: at 21 outlets that built a ~3,800px tower.
  // The list beside the map already carries every outlet, so this panel only has to
  // name the nearest one and hand the route to the Maps app.
  wrap.innerHTML = `
    <div class="ls-station-fallback">
      <h3 class="ls-station-card-name">Map unavailable</h3>
      <p class="ls-station-card-area" id="stations-fallback-note">Finding your nearest outlet…</p>
      <a class="ls-station-card-cta" target="_blank" rel="noopener" hidden></a>
      <button type="button" class="ls-station-fallback-retry">Try again</button>
    </div>`;

  const note = wrap.querySelector('#stations-fallback-note');
  const cta = wrap.querySelector('.ls-station-card-cta');
  wrap.querySelector('.ls-station-fallback-retry')
    .addEventListener('click', () => window.location.reload());

  // ?mapdebug=1 — for a failure we cannot reproduce. Off by default: a visitor must
  // never be shown an error code on a marketing page.
  if (new URLSearchParams(window.location.search).has('mapdebug')) {
    const diag = document.createElement('pre');
    diag.className = 'ls-station-fallback-diag';
    const conn = navigator.connection || {};
    const gl = (() => {
      try { return !!document.createElement('canvas').getContext('webgl'); } catch { return false; }
    })();
    const write = () => {
      diag.textContent = [
        `code   ${mapFailure.code || '(none logged)'}`,
        `detail ${mapFailure.detail || '(none)'}`,
        `key    ${API_KEY ? `set, ${API_KEY.length} chars` : 'MISSING'}`,
        `maps   ${window.google && window.google.maps ? 'script loaded' : 'script never loaded'}`,
        `net    ${navigator.onLine ? 'online' : 'offline'} ${conn.effectiveType || ''} ${conn.saveData ? 'data-saver' : ''}`,
        `webgl  ${gl}`,
        `clock  ${new Date().toISOString()}`,
        `ua     ${navigator.userAgent}`,
      ].join('\n');
    };
    write();
    // Google's own error usually lands a beat after the failure hook.
    [400, 1500, 4000].forEach((ms) => setTimeout(write, ms));
    wrap.querySelector('.ls-station-fallback').appendChild(diag);
  }

  // No map to draw a line on, so the nearest outlet is chosen here and Google Maps
  // is handed both ends — it opens with the route already drawn.
  getPosition().then((origin) => {
    if (!origin) {
      note.textContent = 'Tap an outlet in the list to get directions.';
      return;
    }
    const nearest = (list ? rankList(list, origin) : stationsByDistance(origin))[0];
    if (!nearest) return;
    note.textContent = `Nearest: ${nearest.station.name} · ${kmLabel(nearest.km)} away`;
    cta.textContent = 'Get directions';
    cta.href = directionsUrl(nearest.station, origin);
    cta.hidden = false;
  });
}

/* ─── Expand to full screen ────────────────────────────── */

/* The stage (map + card + controls) is reparented into a fixed overlay rather than
   the tile being made `position: fixed`. GSAP leaves a residual transform on
   .ls-stations-map-wrap, and a transformed ancestor turns `fixed` into a
   containing-block trap. Reparenting also guarantees we clear the sticky header. */
function initExpand(map, stage, wrap, refocus, onExpand, onCollapse) {
  const expandBtn = stage.querySelector('.ls-stations-expand');
  const closeBtn = stage.querySelector('.ls-stations-close');
  if (!expandBtn || !closeBtn) return null;

  const overlay = document.createElement('div');
  overlay.className = 'ls-stations-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Fawaky Stations map');
  overlay.hidden = true;
  document.body.appendChild(overlay);

  let open = false;

  const onKey = (e) => { if (e.key === 'Escape') collapse(); };

  function expand() {
    if (open) return;
    open = true;
    overlay.hidden = false;
    overlay.appendChild(stage);
    document.body.classList.add('is-map-expanded');
    document.addEventListener('keydown', onKey);
    expandBtn.setAttribute('aria-expanded', 'true');
    // Page scroll is no longer behind the map, so one finger should pan it.
    map.setOptions({ gestureHandling: 'greedy' });
    requestAnimationFrame(() => {
      refocus('expanded');
      closeBtn.focus();
      // Routing runs after the map has re-framed, so fitBounds on the route wins.
      if (onExpand) onExpand();
    });
  }

  function collapse() {
    if (!open) return;
    open = false;
    wrap.appendChild(stage);
    overlay.hidden = true;
    document.body.classList.remove('is-map-expanded');
    document.removeEventListener('keydown', onKey);
    expandBtn.setAttribute('aria-expanded', 'false');
    map.setOptions({ gestureHandling: 'cooperative' });
    stage.classList.remove('is-selected'); // hint returns for the next visit
    if (onCollapse) onCollapse();
    requestAnimationFrame(() => { refocus('collapsed'); expandBtn.focus(); });
  }

  expandBtn.addEventListener('click', expand);
  closeBtn.addEventListener('click', collapse);

  return { expand, collapse, isOpen: () => open };
}

/* ─── Map ──────────────────────────────────────────────── */

function initMap(mapEl, stage, wrap, list) {
  const map = new google.maps.Map(mapEl, {
    center: MAP_CENTER,
    zoom: MAP_ZOOM,
    styles: MAP_STYLE,
    disableDefaultUI: true,
    zoomControl: true,
    // One finger scrolls the page, two fingers pan the map. Without this the
    // map swallows touch scroll and the page feels broken on mobile.
    gestureHandling: 'cooperative',
    clickableIcons: false,
  });

  const card = buildCard(stage);
  const markers = new Map();
  let expanded = false;

  const setActive = (id) => {
    list.rows.forEach((btn, key) => btn.classList.toggle('is-active', key === id));
    // The desktop list is a 520px scroller over every outlet, so the row that just
    // became active can sit outside the box. Bring it in if it does.
    if (id) list.reveal(id);
  };

  /* Centre a point in the strip above the bottom sheet rather than behind it, by
     shifting the target centre south in world coordinates. A panBy here would race
     the zoom animation and land somewhere arbitrary. */
  const focusOn = (lat, lng, mode) => {
    const zoom = Math.max(map.getZoom() || 0, FOCUS_ZOOM);
    const sheet = expanded || window.matchMedia('(max-width: 768px)').matches;
    const offsetPx = sheet ? OFFSET_PX[mode || (expanded ? 'expanded' : 'collapsed')] : 0;
    // 156543.03392 m/px at zoom 0 on the equator; /111320 converts metres to degrees.
    const latShift = (offsetPx * 156543.03392 * Math.cos((lat * Math.PI) / 180))
      / Math.pow(2, zoom) / 111320;

    map.setZoom(zoom);
    map.panTo({ lat: lat - latShift, lng });
  };

  /* Two overlaid lines: a white casing under a brand-purple stroke, so the route
     stays legible over the pale basemap and the green parks. */
  let routeLines = [];
  let currentRoute = null;
  let youAreHere = null;

  // The expanded view has a bottom sheet to clear; the collapsed tile does not.
  // Generous top padding: the hint pill sits over the top-left of the map, and the
  // route's origin was landing underneath it.
  const PAD = {
    collapsed: { top: 78, right: 28, bottom: 44, left: 28 },
    expanded: { top: 104, right: 40, bottom: 220, left: 40 },
  };

  /* Three states to frame, not two: a drawn route wins over everything, because
     a route the viewer cannot see is the same as no route at all. */

  /* The tile frames where the visitor IS, not every outlet there is. Framing the
     whole network stopped working the moment one outlet landed 106 km from the rest:
     the corridor's 30 pins collapsed into a few pixels and the de-overlap pass fanned
     them into a blob. A distance cap as well as a count, so somebody standing in
     Kodagu gets the one outlet near them rather than a map of Mangaluru. */
  const NEARBY_KM = 10; // the corridor is ~7 km end to end
  const NEARBY_MAX = 8; // and no more pins than a tile can show at once

  const neighbourhoodBounds = () => {
    const b = new google.maps.LatLngBounds();
    const ranked = stationsByDistance(lastOrigin);
    const near = lastOrigin
      ? ranked.filter((r) => r.km <= NEARBY_KM).slice(0, NEARBY_MAX)
      : ranked;
    (near.length ? near : ranked.slice(0, 1))
      .forEach(({ station }) => b.extend({ lat: station.lat, lng: station.lng }));
    if (lastOrigin) b.extend({ lat: lastOrigin.lat, lng: lastOrigin.lng });
    return b;
  };

  const frameMap = (mode) => {
    const m = mode || (expanded ? 'expanded' : 'collapsed');
    if (currentRoute && currentRoute.bounds) {
      // Expanded is for following the route, so it frames just that. The tile is the
      // overview: it frames every outlet AND the route, so the visitor can see the
      // whole network and their own line through it at once.
      if (m === 'expanded') {
        map.fitBounds(currentRoute.bounds, PAD[m]);
        return;
      }
      const both = neighbourhoodBounds();
      both.union(currentRoute.bounds);
      map.fitBounds(both, PAD[m]);
      return;
    }
    if (m === 'expanded') {
      if (STATIONS.length > 1) {
        const bounds = new google.maps.LatLngBounds();
        STATIONS.forEach((s) => bounds.extend({ lat: s.lat, lng: s.lng }));
        map.fitBounds(bounds, 64);
      } else if (STATIONS[0]) {
        focusOn(STATIONS[0].lat, STATIONS[0].lng, 'expanded');
      }
      return;
    }
    // A location but no route — it has not resolved yet, or it failed. Still better
    // to frame where they are than a city they may not be in.
    if (lastOrigin) {
      map.fitBounds(neighbourhoodBounds(), PAD.collapsed);
      // An outlet metres away would otherwise fit to street level.
      google.maps.event.addListenerOnce(map, 'idle', () => {
        if (map.getZoom() > FOCUS_ZOOM) map.setZoom(FOCUS_ZOOM);
      });
      return;
    }
    map.setZoom(MAP_ZOOM);
    map.setCenter(MAP_CENTER);
  };

  const clearRoute = () => {
    routeLines.forEach((l) => l.setMap(null));
    routeLines = [];
    currentRoute = null;
  };

  const drawRoute = (route) => {
    clearRoute();
    if (!route || !route.path) return;
    currentRoute = route;
    routeLines = [
      new google.maps.Polyline({
        path: route.path, map, strokeColor: ROUTE_LINE.casing,
        strokeOpacity: 0.9, strokeWeight: 10, zIndex: 1,
      }),
      new google.maps.Polyline({
        path: route.path, map, strokeColor: ROUTE_LINE.color,
        strokeOpacity: 1, strokeWeight: 5, zIndex: 2,
      }),
    ];
    frameMap();
  };

  const setRowDistance = (stationId, text) => list.setDistance(stationId, text);

  const select = (station) => {
    pinnedId = station.id;
    renderClusters();
    const marker = markers.get(station.id);
    focusOn(station.lat, station.lng);
    if (marker && !reducedMotion) {
      marker.setAnimation(google.maps.Animation.BOUNCE);
      setTimeout(() => marker.setAnimation(null), 700);
    }
    card.show(station, routeCache.get(station.id));
    setActive(station.id);
    stage.classList.add('is-selected'); // the hint has served its purpose
  };

  /* Draws the route as soon as both the map and the visitor's position are ready --
     no expand required. Silent whenever location was declined or routing is
     unavailable: the map simply behaves as it did before.

     While collapsed this deliberately does NOT open the card or mark the stage
     selected. The card would cover most of a 380px tile, and `is-selected` hides
     the "Tap the pin" hint before the visitor has done anything at all. */
  const locateWrap = stage.querySelector('#stations-locate-wrap');
  const locateBtn = stage.querySelector('#stations-locate');
  const locateNote = stage.querySelector('#stations-locate-note');

  const showLocate = (show) => { if (locateWrap) locateWrap.hidden = !show; };

  if (locateBtn) {
    locateBtn.addEventListener('click', async () => {
      locateBtn.disabled = true;
      locateBtn.textContent = 'Locating…';
      const { pos, blocked } = await requestPositionFromClick();
      locateBtn.disabled = false;
      locateBtn.textContent = 'Use my location';
      if (pos) {
        showLocate(false);
        maybeRoute();
        return;
      }
      if (locateNote) {
        // Nothing in JavaScript can reopen a hard-blocked prompt, so say so plainly
        // rather than leaving the button looking broken.
        locateNote.textContent = blocked
          ? 'Location is blocked for this site. Enable it in your browser\u2019s site settings to see your route.'
          : 'Could not get your location. Please try again.';
        locateNote.hidden = false;
      }
    });
  }

  const maybeRoute = async () => {
    const origin = await getPosition();
    if (!origin) { showLocate(true); return; }
    showLocate(false);

    // Independent of routing: if the route fails, the visitor should still be able
    // to see where they are relative to the station.
    if (!youAreHere) youAreHere = makeYouAreHere(map, origin.lat, origin.lng);
    // Move to their neighbourhood now rather than after the route resolves — the
    // route may take a second, or never arrive.
    if (!currentRoute) frameMap('collapsed');

    // Only the nearest station gets a billed road route.
    const ranked = rankList(list, origin);
    const nearestKm = ranked.length ? ranked[0].km : null;

    const station = nearestStation(origin);
    if (!station) return;

    const route = await fetchRoute(origin, station);
    if (!route) return;

    pinnedId = station.id;
    renderClusters();
    drawRoute(route);
    setRowDistance(station.id, nearestKm != null
      ? `${kmLabel(nearestKm)} away · ${route.duration} drive`
      : `${route.distance} · ${route.duration}`);
    setActive(station.id);

    if (expanded) {
      card.show(station, route);
      stage.classList.add('is-selected');
    }
  };

  /* Called by the expand controller once the stage has been reparented, so the map
     re-frames itself for its new size. */
  const refocus = (mode) => {
    expanded = mode === 'expanded';
    frameMap(mode);
  };

  /* ── Clustering ──
     Screen-space grouping rather than @googlemaps/markerclusterer: that package is
     ~1 MB unpacked and pulls in supercluster, built for thousands of points. At this
     scale the whole algorithm is one pass, and doing it here lets the bubble carry
     brand styling and handle coincident outlets properly. */
  // Collide at roughly the pin's own width — no wider, or unrelated pins chain
  // into one enormous fan.
  const clusterPx = () => pinWidth() + 6;
  // An idle overlay purely to borrow its lat/lng -> pixel projection.
  const projector = new google.maps.OverlayView();
  projector.draw = () => {};
  projector.setMap(map);

  // A 56px pin covers ~900 m of ground at the overview zoom, so it shrinks when
  // zoomed out and returns to full size once there is room for it.
  const pinWidth = () => ((map.getZoom() || MAP_ZOOM) >= 15 ? 56 : 36);
  const pinIcon = (w) => ({
    url: PIN,
    scaledSize: new google.maps.Size(w, Math.round(w * 1.25)),
    anchor: new google.maps.Point(w / 2, Math.round(w * 1.25)),
  });

  STATIONS.forEach((station) => {
    const marker = new google.maps.Marker({
      position: { lat: station.lat, lng: station.lng },
      title: `${station.name} — ${station.area}`,
      icon: pinIcon(36),
    });
    marker.addListener('click', () => select(station));
    markers.set(station.id, marker);
  });

  // The station the visitor is being routed to is never fanned: it is the one
  // marker that has to stay on its true coordinate, since the polyline ends there.
  let pinnedId = null;

  /* Groups stations whose pins would collide on screen at the current zoom. */
  const groupStations = () => {
    const projection = projector.getProjection();
    if (!projection) return null;
    const groups = [];
    STATIONS.forEach((station) => {
      const pt = projection.fromLatLngToDivPixel(
        new google.maps.LatLng(station.lat, station.lng));
      if (!pt) return;
      const hit = groups.find((g) => Math.hypot(g.x - pt.x, g.y - pt.y) <= clusterPx());
      if (hit) {
        hit.members.push(station);
        hit.x = (hit.x * (hit.members.length - 1) + pt.x) / hit.members.length;
        hit.y = (hit.y * (hit.members.length - 1) + pt.y) / hit.members.length;
      } else {
        groups.push({ x: pt.x, y: pt.y, members: [station] });
      }
    });
    return groups;
  };

  /* Spiderfy rather than cluster. The outlets are genuinely too close to draw at
     true coordinates -- 17 of the 55 pairs sit under one pin-width at default zoom,
     and five Adyar Kannur shops land 2-4px apart -- so drawing them raw would hide
     four of five behind the fifth. Fanning keeps every pin visible and tappable, and
     a leader line back to the true coordinate keeps it honest. */
  const FAN_START = -Math.PI / 2; // first pin sits above the centroid
  let leaderLines = [];

  const clearLeaders = () => {
    leaderLines.forEach((l) => l.setMap(null));
    leaderLines = [];
  };

  /* Fanning fixes collisions inside a group but knows nothing about the group next
     door, and along a corridor as dense as this one two fans end up on top of each
     other — at 30 outlets the closest drawn pair sat 12px apart with 36px pins. So
     the fan is only the opening layout; this pass then pushes any two pins still
     overlapping apart until none do. A few passes, not a running simulation: the
     layout has to come out the same on every idle or the pins would crawl on pan. */
  const RELAX_PASSES = 8;
  const MAX_DISPLACEMENT = 90; // px a pin may end up from its true point

  const relax = (nodes, minDist) => {
    for (let pass = 0; pass < RELAX_PASSES; pass += 1) {
      let moved = false;
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const a = nodes[i];
          const b = nodes[j];
          if (a.fixed && b.fixed) continue;
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let d = Math.hypot(dx, dy);
          if (d >= minDist) continue;
          if (d < 0.01) { dx = Math.cos(i); dy = Math.sin(i); d = 1; } // exactly coincident
          const push = (minDist - d) / 2;
          const ux = (dx / d) * push;
          const uy = (dy / d) * push;
          // The routed destination cannot move, so it hands its whole share of the
          // push to the other pin rather than staying overlapped.
          if (a.fixed) { b.x += ux * 2; b.y += uy * 2; }
          else if (b.fixed) { a.x -= ux * 2; a.y -= uy * 2; }
          else { a.x -= ux; a.y -= uy; b.x += ux; b.y += uy; }
          moved = true;
        }
      }
      if (!moved) break;
    }
  };

  const renderClusters = () => {
    const projection = projector.getProjection();
    const groups = groupStations();
    if (!projection || !groups) return;
    clearLeaders();
    const w = pinWidth();
    const icon = pinIcon(w);
    markers.forEach((m) => m.setIcon(icon));

    const truePt = (station) => projection.fromLatLngToDivPixel(
      new google.maps.LatLng(station.lat, station.lng));

    /* Now the tile frames a neighbourhood rather than the whole network, most
       outlets are off screen on any given view. Clamping those into the viewport
       would line the edges with pins on long leader lines pointing at nothing, so a
       pin whose TRUE point is outside the tile is taken off the map instead. */
    const viewport = map.getBounds && map.getBounds();
    const onScreen = (station) => !viewport
      || viewport.contains(new google.maps.LatLng(station.lat, station.lng));

    // Where every pin wants to be drawn, before anyone checks whether two of them
    // want the same place.
    const nodes = [];
    groups.forEach((group) => {
      if (group.members.length === 1) {
        const only = group.members[0];
        if (!onScreen(only) && only.id !== pinnedId) {
          markers.get(only.id).setMap(null);
          return;
        }
        const pt = truePt(only);
        nodes.push({ station: only, x: pt.x, y: pt.y, tx: pt.x, ty: pt.y, fixed: only.id === pinnedId });
        return;
      }

      // The routed destination stays on its true coordinate -- the polyline ends
      // there -- so when it is in a group it anchors the fan and everyone else
      // arranges around it rather than around the centroid.
      const anchor = group.members.find((m) => m.id === pinnedId);
      const fanned = group.members.filter((m) => m.id !== pinnedId && onScreen(m));
      group.members.filter((m) => m.id !== pinnedId && !onScreen(m))
        .forEach((m) => markers.get(m.id).setMap(null));
      let cx = group.x;
      let cy = group.y;

      if (anchor) {
        const pt = truePt(anchor);
        cx = pt.x;
        cy = pt.y;
        nodes.push({ station: anchor, x: pt.x, y: pt.y, tx: pt.x, ty: pt.y, fixed: true });
      }

      // With the rest of the group off screen there is nothing left to fan around,
      // so the survivor keeps its true coordinate and needs no leader line.
      if (!anchor && fanned.length === 1) {
        const only = fanned[0];
        const pt = truePt(only);
        nodes.push({ station: only, x: pt.x, y: pt.y, tx: pt.x, ty: pt.y, fixed: false });
        return;
      }
      if (!fanned.length) return;

      // Smallest ring on which `n` pins of this width clear each other, rather than
      // a radius that grows unbounded and throws pins off the tile.
      const n = Math.max(fanned.length, 2);
      const radius = Math.max(w * 0.72, Math.min(72, (w * 0.62) / (2 * Math.sin(Math.PI / n))));
      fanned.forEach((station, i) => {
        const angle = FAN_START + (2 * Math.PI * i) / fanned.length;
        const pt = truePt(station);
        nodes.push({
          station,
          x: cx + radius * Math.cos(angle),
          y: cy + radius * Math.sin(angle),
          tx: pt.x,
          ty: pt.y,
          fixed: false,
        });
      });
    });

    relax(nodes, w * 0.9);

    /* Pushing pins apart can push them off the tile — the map framed itself before
       any of this ran. Keep every pin inside the viewport, in the same pixel space
       the projection works in. (The stub map in the tests has no getBounds; without
       bounds there is nothing to clamp to and the pass is skipped.) */
    const bounds = map.getBounds && map.getBounds();
    const edge = bounds && (() => {
      const ne = projection.fromLatLngToDivPixel(bounds.getNorthEast());
      const sw = projection.fromLatLngToDivPixel(bounds.getSouthWest());
      if (!ne || !sw) return null;
      // The pin hangs entirely ABOVE its point and half a width either side of it,
      // so the top edge needs a whole pin's height of room and the bottom almost none.
      const half = w / 2 + 4;
      const tall = Math.round(w * 1.25) + 4;
      return {
        minX: Math.min(ne.x, sw.x) + half,
        maxX: Math.max(ne.x, sw.x) - half,
        minY: Math.min(ne.y, sw.y) + tall,
        maxY: Math.max(ne.y, sw.y) - 4,
      };
    })();

    nodes.forEach((node) => {
      if (edge && edge.maxX > edge.minX && edge.maxY > edge.minY) {
        node.x = Math.min(Math.max(node.x, edge.minX), edge.maxX);
        node.y = Math.min(Math.max(node.y, edge.minY), edge.maxY);
      }
      let dx = node.x - node.tx;
      let dy = node.y - node.ty;
      const away = Math.hypot(dx, dy);
      // However crowded it gets, a pin stays within sight of the place it stands for.
      if (away > MAX_DISPLACEMENT) {
        const k = MAX_DISPLACEMENT / away;
        dx *= k;
        dy *= k;
      }
      const marker = markers.get(node.station.id);
      const position = away < 1
        ? { lat: node.station.lat, lng: node.station.lng }
        : projection.fromDivPixelToLatLng(new google.maps.Point(node.tx + dx, node.ty + dy));
      marker.setPosition(position);
      marker.setMap(map);
      if (away < 1) return;
      leaderLines.push(new google.maps.Polyline({
        path: [position, { lat: node.station.lat, lng: node.station.lng }],
        map,
        strokeColor: '#92B83D',
        strokeOpacity: 0.85,
        strokeWeight: 2,
        zIndex: 1,
      }));
    });
  };

  google.maps.event.addListenerOnce(projector, 'ready', renderClusters);
  map.addListener('idle', renderClusters);

  // Framed the same way as every later re-frame: the visitor's neighbourhood once
  // their location is known, the corridor's centre until then. This used to fit
  // every outlet, which put the whole of Karnataka in the tile once one outlet
  // landed 106 km from the rest.
  frameMap('collapsed');

  map.addListener('click', card.close);
  // onCollapse re-frames rather than clearing: the route belongs to the page now,
  // not to the expanded view, and redrawing it would be a second billed request.
  initExpand(map, stage, wrap, refocus, maybeRoute);

  // Draw as soon as the map exists. Whichever of {map, position} settles last
  // triggers the line, so it is already there when the section scrolls into view.
  maybeRoute();

  return select;
}

/* ─── Entry ────────────────────────────────────────────── */

export default function initStations() {
  const section = document.getElementById('stations');
  const mapEl = document.getElementById('stations-map');
  const listEl = document.getElementById('stations-list');
  if (!section || !mapEl || !listEl) return;

  const stage = document.getElementById('stations-stage');
  const wrap = stage ? stage.parentElement : mapEl.parentElement;
  let select = null;
  const list = renderList(listEl, (station) => {
    if (select) select(station);
    else window.open(directionsUrl(station, lastOrigin), '_blank', 'noopener');
  });

  if (!API_KEY) {
    console.warn('[fawaky] VITE_GOOGLE_MAPS_API_KEY is empty — showing the static fallback.');
    renderFallback(wrap, list);
    return;
  }

  // Start warming the location immediately — not from the observer below, which
  // fires too late to have a route ready when the section appears.
  primeLocation();

  /* Key/referrer/billing problems do NOT reject the script promise — Google loads
     fine and then paints its own grey "Oops!" panel over the map. This is the only
     hook it gives us, and it has to exist before the script runs. */
  watchMapErrors();

  window.gm_authFailure = () => {
    mapFailure.detail = mapFailure.detail || 'gm_authFailure (key, referrer, billing, quota or API restriction)';
    console.warn('[fawaky] Google Maps rejected the API key (referrer, billing, quota or API restriction). Showing the static fallback.');
    renderFallback(wrap, list);
  };

  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    // A dropped or stalled request on a weak mobile connection is the likeliest
    // failure here and it usually clears, so try again before giving the tile up.
    const RETRY_MS = [2000, 6000];
    const attempt = (n) => loadMapsApi()
      .then(() => { select = initMap(mapEl, stage, wrap, list); })
      .catch((err) => {
        if (n < RETRY_MS.length) {
          console.warn(`[fawaky] stations map: ${err.message} — retrying`);
          setTimeout(() => attempt(n + 1), RETRY_MS[n]);
          return;
        }
        mapFailure.detail = mapFailure.detail || (err && (err.stack || err.message));
        console.warn('[fawaky] stations map unavailable:', err.message);
        renderFallback(wrap, list);
      });
    attempt(0);
  };

  const obs = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { obs.disconnect(); start(); }
  }, { rootMargin: '300px 0px' });
  obs.observe(section);
}
