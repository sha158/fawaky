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

/* ─── Route ────────────────────────────────────────────── */

const ROUTE_LINE = { color: '#5E1F78', casing: '#FFFFFF' };
const routeCache = new Map(); // station.id -> {path, distance, duration}
let directionsService = null;
let quotaExhausted = false;

/* Resolves {path, distance, duration} or null. Billed per call, so results are
   cached per station and never retried on quota errors. */
function fetchRoute(origin, station) {
  if (quotaExhausted) return Promise.resolve(null);
  if (routeCache.has(station.id)) return Promise.resolve(routeCache.get(station.id));

  directionsService = directionsService || new google.maps.DirectionsService();

  return new Promise((resolve) => {
    directionsService.route({
      origin,
      destination: { lat: station.lat, lng: station.lng },
      travelMode: 'DRIVING',
    }, (result, status) => {
      if (status === 'OK' && result.routes[0]) {
        const route = result.routes[0];
        const leg = route.legs[0];
        const data = {
          path: route.overview_path,
          bounds: route.bounds,
          distance: leg && leg.distance ? leg.distance.text : '',
          duration: leg && leg.duration ? leg.duration.text : '',
        };
        routeCache.set(station.id, data);
        resolve(data);
        return;
      }

      if (status === 'REQUEST_DENIED') {
        console.warn('[fawaky] Directions request denied. Enable the Directions API in Google Cloud Console and add it to this key\'s API restrictions.');
      } else if (status === 'OVER_QUERY_LIMIT') {
        // Never retry a billed endpoint in a loop.
        quotaExhausted = true;
        console.warn('[fawaky] Directions quota exhausted — routing disabled for this session.');
      } else if (status !== 'ZERO_RESULTS') {
        console.warn('[fawaky] Directions failed:', status);
      }
      routeCache.set(station.id, null);
      resolve(null);
    });
  });
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
    if (onCollapse) onCollapse(); // drop the route so the tile re-frames cleanly
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

  const clearRoute = () => {
    routeLines.forEach((l) => l.setMap(null));
    routeLines = [];
  };

  const drawRoute = (route) => {
    clearRoute();
    if (!route || !route.path) return;
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
    // Frame the whole route. Without this the line is simply off-screen for any
    // visitor more than a few hundred metres away. Bottom padding keeps it clear
    // of the card.
    if (route.bounds) {
      map.fitBounds(route.bounds, { top: 72, right: 40, bottom: 220, left: 40 });
    }
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

  /* Auto-route on expand. Silent whenever the visitor has not granted location or
     the Directions API is unavailable -- the map simply behaves as it did before. */
  const maybeRoute = async () => {
    const origin = await getPosition();
    if (!origin) return;
    const station = nearestStation(origin);
    if (!station) return;

    const route = await fetchRoute(origin, station);
    if (!route) return;

    drawRoute(route);
    card.show(station, route);
    setActive(station.id);
    stage.classList.add('is-selected');
  };

  /* Called by the expand controller once the stage has been reparented, so the map
     re-frames itself for its new size. */
  const refocus = (mode) => {
    expanded = mode === 'expanded';
    if (!expanded) {
      map.setZoom(MAP_ZOOM);
      map.setCenter(MAP_CENTER);
      return;
    }
    if (STATIONS.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      STATIONS.forEach((s) => bounds.extend({ lat: s.lat, lng: s.lng }));
      map.fitBounds(bounds, 64);
    } else if (STATIONS[0]) {
      focusOn(STATIONS[0].lat, STATIONS[0].lng, 'expanded');
    }
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
  initExpand(map, stage, wrap, refocus, maybeRoute, clearRoute);

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
