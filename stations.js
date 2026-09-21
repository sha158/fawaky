/* Fawaky Stations — the store locator map.
   Loaded lazily from main.js: the Maps script is only fetched once the section
   is near the viewport, so visitors who never scroll this far cost nothing. */

import {
  STATIONS, MAP_CENTER, MAP_ZOOM, FOCUS_ZOOM, directionsUrl, nearestStation,
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

function loadMapsApi() {
  if (window.google && window.google.maps) return Promise.resolve();
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise((resolve, reject) => {
    const cb = '__fawakyMapsReady';
    window[cb] = () => { delete window[cb]; resolve(); };
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(API_KEY)}&callback=${cb}&loading=async&v=weekly`;
    s.async = true;
    s.onerror = () => reject(new Error('Google Maps failed to load'));
    document.head.appendChild(s);
  });
  return loaderPromise;
}

/* ─── Visitor location ─────────────────────────────────── */

let positionPromise = null;

/* Resolves {lat,lng} or null. Never rejects — a missing location is an ordinary
   outcome here, not an error. Runs at most once per page load. */
function getPosition() {
  if (positionPromise) return positionPromise;

  positionPromise = (async () => {
    if (!navigator.geolocation) return null;

    // Ask the Permissions API first. If the visitor already said no, we must not
    // call getCurrentPosition -- that is what re-triggers the prompt on every
    // expand. Not every browser implements this, hence the try.
    try {
      const status = await navigator.permissions.query({ name: 'geolocation' });
      if (status.state === 'denied') return null;
    } catch { /* Permissions API unavailable — fall through and just ask */ }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null), // denied, unavailable or timed out — all the same to us
        // A café locator does not need GPS precision, and low accuracy is far
        // faster and kinder to battery.
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
      );
    });
  })();

  return positionPromise;
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

function renderList(listEl, onSelect) {
  listEl.innerHTML = '';
  const rows = new Map();

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
  });

  return rows;
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
      card.querySelector('.ls-station-card-cta').href = directionsUrl(station);

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

function renderFallback(wrap) {
  wrap.classList.add('is-fallback');
  wrap.innerHTML = STATIONS.map((s) => `
    <div class="ls-station-fallback">
      <h3 class="ls-station-card-name">${s.name}</h3>
      <p class="ls-station-card-area">${s.area}</p>
      <a class="ls-station-card-cta" href="${directionsUrl(s)}" target="_blank" rel="noopener">Get Directions</a>
    </div>`).join('');
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

function initMap(mapEl, stage, wrap, rows) {
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
    rows.forEach((btn, key) => btn.classList.toggle('is-active', key === id));
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
  const PAD = {
    collapsed: { top: 40, right: 24, bottom: 40, left: 24 },
    expanded: { top: 72, right: 40, bottom: 220, left: 40 },
  };

  /* Three states to frame, not two: a drawn route wins over everything, because
     a route the viewer cannot see is the same as no route at all. */
  const frameMap = (mode) => {
    const m = mode || (expanded ? 'expanded' : 'collapsed');
    if (currentRoute && currentRoute.bounds) {
      map.fitBounds(currentRoute.bounds, PAD[m]);
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

  const setRowDistance = (stationId, text) => {
    const btn = rows.get(stationId);
    const el = btn && btn.querySelector('.ls-station-dist');
    if (!el) return;
    el.textContent = text;
    el.hidden = !text;
  };

  const select = (station) => {
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
  const maybeRoute = async () => {
    const origin = await getPosition();
    if (!origin) return;

    // Independent of routing: if the route fails, the visitor should still be able
    // to see where they are relative to the station.
    if (!youAreHere) youAreHere = makeYouAreHere(map, origin.lat, origin.lng);

    const station = nearestStation(origin);
    if (!station) return;

    const route = await fetchRoute(origin, station);
    if (!route) return;

    drawRoute(route);
    setRowDistance(station.id, `${route.distance} · ${route.duration}`);
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

  STATIONS.forEach((station) => {
    const marker = new google.maps.Marker({
      position: { lat: station.lat, lng: station.lng },
      map,
      title: `${station.name} — ${station.area}`,
      icon: {
        url: PIN,
        scaledSize: new google.maps.Size(56, 70),
        anchor: new google.maps.Point(28, 70),
      },
    });
    marker.addListener('click', () => select(station));
    markers.set(station.id, marker);
  });

  // More than one outlet: frame them all instead of trusting a hardcoded centre.
  if (STATIONS.length > 1) {
    const bounds = new google.maps.LatLngBounds();
    STATIONS.forEach((s) => bounds.extend({ lat: s.lat, lng: s.lng }));
    map.fitBounds(bounds, 64);
  }

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
  const rows = renderList(listEl, (station) => {
    if (select) select(station);
    else window.open(directionsUrl(station), '_blank', 'noopener');
  });

  if (!API_KEY) {
    console.warn('[fawaky] VITE_GOOGLE_MAPS_API_KEY is empty — showing the static fallback.');
    renderFallback(wrap);
    return;
  }

  // Start warming the location immediately — not from the observer below, which
  // fires too late to have a route ready when the section appears.
  primeLocation();

  /* Key/referrer/billing problems do NOT reject the script promise — Google loads
     fine and then paints its own grey "Oops!" panel over the map. This is the only
     hook it gives us, and it has to exist before the script runs. */
  window.gm_authFailure = () => {
    console.warn('[fawaky] Google Maps rejected the API key (referrer, billing, or API restriction). Showing the static fallback.');
    renderFallback(wrap);
  };

  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    loadMapsApi()
      .then(() => { select = initMap(mapEl, stage, wrap, rows); })
      .catch((err) => {
        console.warn('[fawaky] stations map unavailable:', err.message);
        renderFallback(wrap);
      });
  };

  const obs = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { obs.disconnect(); start(); }
  }, { rootMargin: '300px 0px' });
  obs.observe(section);
}
