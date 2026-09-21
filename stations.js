/* Fawaky Stations — the store locator map.
   Loaded lazily from main.js: the Maps script is only fetched once the section
   is near the viewport, so visitors who never scroll this far cost nothing. */

import { STATIONS, MAP_CENTER, MAP_ZOOM, FOCUS_ZOOM, directionsUrl } from './stations-data.js';
// Imported, not a runtime '/assets/...' string: that way Vite emits and hashes
// the file. A bare path resolves in dev but 404s in the production build.
import PIN from './assets/map-pin.png';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

function buildCard(wrap) {
  const card = document.createElement('div');
  card.className = 'ls-station-card';
  card.hidden = true;
  card.innerHTML = `
    <button type="button" class="ls-station-card-close" aria-label="Close">&times;</button>
    <span class="ls-station-card-handle" aria-hidden="true"></span>
    <h3 class="ls-station-card-name"></h3>
    <p class="ls-station-card-area"></p>
    <a class="ls-station-card-cta" target="_blank" rel="noopener">Get Directions</a>`;
  wrap.appendChild(card);

  const close = () => { card.hidden = true; card.classList.remove('is-open'); };
  card.querySelector('.ls-station-card-close').addEventListener('click', close);

  return {
    el: card,
    close,
    show(station) {
      card.querySelector('.ls-station-card-name').textContent = station.name;
      card.querySelector('.ls-station-card-area').textContent = station.area;
      card.querySelector('.ls-station-card-cta').href = directionsUrl(station);
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

/* ─── Map ──────────────────────────────────────────────── */

function initMap(mapEl, wrap, rows) {
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

  const card = buildCard(wrap);
  const markers = new Map();

  const setActive = (id) => {
    rows.forEach((btn, key) => btn.classList.toggle('is-active', key === id));
  };

  const select = (station) => {
    const marker = markers.get(station.id);

    // On mobile the card is a bottom sheet over the lower half of the map, so the
    // marker is centred in the strip above it rather than behind it. Done by
    // shifting the centre south in world coordinates -- a panBy here would race
    // the zoom animation and land somewhere arbitrary.
    const zoom = Math.max(map.getZoom() || 0, FOCUS_ZOOM);
    const sheet = window.matchMedia('(max-width: 768px)').matches;
    const offsetPx = sheet ? 92 : 0;
    // 156543.03392 m/px at zoom 0 on the equator; /111320 converts metres to degrees.
    const latShift = (offsetPx * 156543.03392 * Math.cos((station.lat * Math.PI) / 180))
      / Math.pow(2, zoom) / 111320;

    map.setZoom(zoom);
    map.panTo({ lat: station.lat - latShift, lng: station.lng });
    if (marker && !reducedMotion) {
      marker.setAnimation(google.maps.Animation.BOUNCE);
      setTimeout(() => marker.setAnimation(null), 700);
    }
    card.show(station);
    setActive(station.id);
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

  return select;
}

/* ─── Entry ────────────────────────────────────────────── */

export default function initStations() {
  const section = document.getElementById('stations');
  const mapEl = document.getElementById('stations-map');
  const listEl = document.getElementById('stations-list');
  if (!section || !mapEl || !listEl) return;

  const wrap = mapEl.parentElement;
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
      .then(() => { select = initMap(mapEl, wrap, rows); })
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
