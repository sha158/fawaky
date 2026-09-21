/* Fawaky Stations — every outlet that stocks the drink.
   Add entries here; the map and the list both render from this one array,
   and the map auto-fits its bounds once there is more than one. */

export const STATIONS = [
  {
    id: 'royal-tea',
    name: 'Royal Tea',
    area: 'Nandigudda, Mangaluru',
    lat: 12.855757,
    lng: 74.8537288,
  },
];

/* Mangaluru city centre — the view before anything is selected. */
export const MAP_CENTER = { lat: 12.8698, lng: 74.856 };
export const MAP_ZOOM = 13;
export const FOCUS_ZOOM = 16;

/* Universal cross-platform Maps URL: opens the native app on iOS/Android,
   the web map on desktop. */
export function directionsUrl(station) {
  return `https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lng}`;
}

/* Great-circle distance in km. Good enough for picking a nearest outlet — the
   road distance comes from the Directions response once a route is drawn. */
export function haversineKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function nearestStation(from) {
  if (!from || !STATIONS.length) return null;
  return STATIONS.reduce((best, s) =>
    (best === null || haversineKm(from, s) < haversineKm(from, best) ? s : best), null);
}
