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
