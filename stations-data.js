/* Fawaky Stations — every outlet that stocks the drink.
   Add entries here; the map, the clustering and the list all render from this one
   array, and the nearest-station lookup works on any length.

   NOTE ON COORDINATES: the client supplies these labelled "Long&Lat", but the values
   are (latitude, longitude) — 12.8x is Mangaluru's latitude, 74.9x its longitude.
   They are stored unswapped. Do not "correct" them. */

export const STATIONS = [
  // Adyar Kannur
  { id: 'hotel-badriya', name: 'Hotel Badriya', area: 'Adyar Kannur', lat: 12.8681824, lng: 74.9063147 },
  // Shares a doorway with Hotel Badriya — 2.1 m apart, confirmed by the client as
  // two separate shops in one building. No zoom level separates them, so the list
  // is what tells them apart.
  { id: 'hn-store', name: 'H.N Store', area: 'Adyar Kannur', lat: 12.8681759, lng: 74.9063331 },
  { id: 'niz-supermarket', name: 'Niz Supermarket', area: 'Adyar Kannur', lat: 12.8679588, lng: 74.9042735 },
  { id: 'z-bakes-cakes', name: 'Z Bakes & Cakes', area: 'Adyar Kannur', lat: 12.8678859, lng: 74.9040134 },
  { id: 'saz-bakes', name: 'Saz Bakes', area: 'Adyar Kannur', lat: 12.8681004, lng: 74.9034772 },

  // Kannur–Kodakkal
  { id: 'janapriya-canteen', name: 'Janapriya Hospital Canteen', area: 'Kannur–Kodakkal', lat: 12.8709633, lng: 74.8963657 },
  { id: 'first-neuro-canteen', name: 'First Neuro Hospital — Sri Sai Canteen', area: 'Kannur–Kodakkal', lat: 12.8705920, lng: 74.8957823 },

  // Padil
  { id: 'padil-bakery', name: 'Padil Bakery', area: 'Padil', lat: 12.8706819, lng: 74.8837711 },
  { id: 'sri-durga-cake-palace', name: 'Sri Durga Cake Palace', area: 'Padil', lat: 12.8707240, lng: 74.8830935 },
  { id: 'hotel-junction', name: 'Hotel Junction', area: 'Padil — Mangalore Junction Station', lat: 12.8673950, lng: 74.8785475 },

  // Nandigudda
  { id: 'royal-tea', name: 'Royal Tea', area: 'Nandigudda, Mangaluru', lat: 12.855757, lng: 74.8537288 },
];

/* Centroid of the outlets — the view before location is known or anything selected. */
export const MAP_CENTER = {
  lat: STATIONS.reduce((s, x) => s + x.lat, 0) / STATIONS.length,
  lng: STATIONS.reduce((s, x) => s + x.lng, 0) / STATIONS.length,
};
export const MAP_ZOOM = 13;
export const FOCUS_ZOOM = 16;

/* Universal cross-platform Maps URL: opens the native app on iOS/Android,
   the web map on desktop. */
export function directionsUrl(station) {
  return `https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lng}`;
}

/* Great-circle distance in km. Good enough for picking a nearest outlet and for
   sorting the list — the road distance comes from the Routes response. */
export function haversineKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* Single pass, keeping the running best distance rather than recomputing it. */
export function nearestStation(from) {
  if (!from || !STATIONS.length) return null;
  let best = null;
  let bestKm = Infinity;
  for (const s of STATIONS) {
    const km = haversineKm(from, s);
    if (km < bestKm) { bestKm = km; best = s; }
  }
  return best;
}

/* Stations ordered by straight-line distance, each tagged with its km. Falls back
   to the given order when location is unknown. */
export function stationsByDistance(from) {
  if (!from) return STATIONS.map((s) => ({ station: s, km: null }));
  return STATIONS
    .map((s) => ({ station: s, km: haversineKm(from, s) }))
    .sort((a, b) => a.km - b.km);
}
