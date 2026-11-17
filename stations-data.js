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

  // Naguri
  { id: 'indian-grocery-hub-naguri-jn', name: 'Indian Grocery Hub (Naguri Junction)', area: 'Naguri', lat: 12.8702625, lng: 74.8750130 },
  { id: 'ganesh-stores', name: 'Ganesh Stores', area: 'Naguri', lat: 12.8699222, lng: 74.8745144 },
  { id: 'indian-grocery-hub-chick-n-grill', name: 'Indian Grocery Hub (opp. Hotel Chick n Grill)', area: 'Naguri', lat: 12.8697585, lng: 74.8731874 },
  { id: 'garodi-excel-general-store', name: 'Garodi Excel General Store', area: 'Capitanio School Rd, Naguri', lat: 12.8695147, lng: 74.8698058 },

  // Pumpwell
  { id: 'mangalore-bakery', name: 'Mangalore Bakery', area: 'Pumpwell', lat: 12.8696575, lng: 74.8649590 },
  { id: 'deepak-enterprises', name: 'Deepak Enterprises', area: 'Pumpwell', lat: 12.8694160, lng: 74.8651029 },
  { id: 'mio-hospital-canteen', name: 'MIO Hospital Canteen', area: 'Pumpwell', lat: 12.8673345, lng: 74.8667417 },
  { id: 'gl-bakery-ujjodi', name: 'G L Bakery', area: 'Ujjodi, Pumpwell', lat: 12.8648112, lng: 74.8659592 },

  // Kankanady
  { id: 'story-bakes', name: 'Story Bakes', area: 'Old Kankanady Rd', lat: 12.8689119, lng: 74.8625082 },
  { id: 'impala-z-mart', name: 'Impala Z mart', area: 'Kankanady Old Road', lat: 12.867621429086618, lng: 74.85851558288859 },
  { id: 'swagath-sweets', name: 'Swagath Sweets', area: 'Kankanady', lat: 12.8681072, lng: 74.8579581 },
  { id: 'fresh-bakery', name: 'Fresh Bakery', area: 'Kankanady', lat: 12.8696719, lng: 74.8582358 },
  { id: 'indian-foods-salafi', name: 'Indian Foods', area: 'Salafi Center, Kankanady', lat: 12.8683076, lng: 74.8569523 },

  // Bendoorwell
  { id: 'attil-restaurant', name: 'Attil Restaurant', area: 'Bendoorwell', lat: 12.8705436, lng: 74.8570234 },
  { id: 'royal-treat-family-restaurant', name: 'Royal Treat Family Restaurant', area: 'Bendoorwell', lat: 12.8713261, lng: 74.8569875 },
  { id: 'ss-mini-mart', name: 'S S Mini Mart', area: 'Bendoorwell', lat: 12.8712653, lng: 74.8568484 },
  { id: 'colaco-canteen', name: 'Colaco Canteen, Colaco Hospital', area: 'Bendoorwell', lat: 12.8726162, lng: 74.8562855 },
  { id: 'super-foodmart-bendoor', name: 'Super FoodMart Bendoor', area: 'Bendoorwell', lat: 12.8728659, lng: 74.8560209 },

  // Valencia
  { id: 'spectrum-gaming', name: 'Spectrum Gaming Snooker & Playstation', area: 'Valencia', lat: 12.8639653, lng: 74.8577798 },
  { id: 'big-mishra-pedha', name: 'Big Mishra Pedha', area: 'Valencia', lat: 12.8635701, lng: 74.8572718 },

  // Nandigudda
  { id: 'royal-tea', name: 'Royal Tea', area: 'Nandigudda, Mangaluru', lat: 12.855757, lng: 74.8537288 },

  // Kodagu — 106 km east of the corridor, and the reason the tile frames the
  // visitor's own neighbourhood rather than every outlet at once.
  { id: 'alfa-store-napoklu', name: 'Alfa Store', area: 'Napoklu, Kodagu', lat: 12.311460, lng: 75.697823 },
  { id: 'abc-super-market-napoklu', name: 'ABC Super Market', area: 'Napoklu, Kodagu', lat: 12.30463394722554, lng: 75.68287545325323 },
  { id: 'drips-cafe-kondangeri', name: 'Drips Cafe', area: 'Kondangeri, Kodagu', lat: 12.299515880954008, lng: 75.79502591092404 },

  // Marnamikatte
  { id: 'misbah-super-market', name: 'Misbah Super Market', area: 'Marnamikatte', lat: 12.8520042, lng: 74.8496309 },
  { id: 'garam-chai', name: 'Garam Chai', area: 'Marnamikatte', lat: 12.8508454, lng: 74.8525374 },

  // Morgans Gate
  // A second Swagath Sweets, 2.3 km from the Kankanady one — a branch, not a repeat.
  // The area line under the name is what tells the two rows apart.
  { id: 'swagath-sweets-morgans-gate', name: 'Swagath Sweets', area: 'Morgans Gate', lat: 12.8477054, lng: 74.8526024 },

  // Bolar
  { id: 'ah-bakery-bolar', name: 'A.H Bakery', area: 'Bolar', lat: 12.8470241, lng: 74.8448006 },

  // Falnir
  { id: 'indian-fresh-falnir', name: 'INDIAN FRESH', area: 'Falnir', lat: 12.8657362, lng: 74.8541769 },
  { id: 'drip-n-drop', name: 'Drip N Drop', area: 'Falnir', lat: 12.8672960, lng: 74.8537917 },
  { id: 'lifeline-healthcare-cafe', name: 'Lifeline Healthcare Cafe', area: 'Falnir', lat: 12.8676343, lng: 74.8531419 },

  // Balmatta
  // One of three Helen's Bakery branches (with Farangipete and Derlakatte, 8–11 km
  // apart) — branches, not repeats. The area line tells the rows apart.
  { id: 'helens-bakery-balmatta', name: 'HELEN’s Bakery', area: 'Balmatta', lat: 12.8719118, lng: 74.8544411 },
  { id: 'hok-house-of-koobideh', name: 'HOK House Of Koobideh', area: 'Balmatta', lat: 12.8737010, lng: 74.8528626 },
  { id: 'hotel-mangalore-donne-biryani', name: 'Hotel Mangalore Donne Biryani', area: 'Balmatta', lat: 12.8731947, lng: 74.8512563 },

  // Jyothi Circle
  { id: 'hotel-food-junction', name: 'Hotel Food Junction', area: 'Jyothi Circle', lat: 12.8725469, lng: 74.8491521 },

  // Attavara
  { id: 'aayans-shawarma', name: "Aayan's Shawarma", area: 'Attavara', lat: 12.8641026, lng: 74.8496212 },
  { id: 'ah-store-attavar', name: 'A.H STORE', area: 'Attavara', lat: 12.8641477, lng: 74.8493439 },
  { id: 'chai-sukoon', name: 'Chai Sukoon', area: 'Attavara', lat: 12.86001803284954, lng: 74.84795536936255 },
  { id: 'rimaal-mandi', name: 'Rimaal Mandi', area: 'Attavara', lat: 12.861374552016068, lng: 74.84759944935507 },
  { id: 'laziz-pizza', name: 'Laziz Pizza', area: 'Attavara', lat: 12.860638617688902, lng: 74.84741059896741 },
  { id: 'attavar-cafe', name: 'Attavar Cafe', area: 'Attavara', lat: 12.8638594, lng: 74.8466201 },
  { id: 'legacy-8-ball-cafe-lounge', name: 'LEGACY 8- Ball Cafe & Lounge', area: 'Attavara', lat: 12.8637156, lng: 74.8468012 },

  // Hampankatte
  { id: 'zayd-foods', name: 'Zayd Foods', area: 'Hampankatte', lat: 12.8698896, lng: 74.8606766 },
  // A second Misbah Super Market, ~1.9 km from the Marnamikatte one — a branch,
  // not a repeat. The area line is what tells the two rows apart.
  { id: 'misbah-super-market-hampankatte', name: 'Misbah Super Market', area: 'near Athena Hospital, Close to Hampankatte', lat: 12.8678503, lng: 74.8472068 },
  { id: 'taj-rasoi-family-dine', name: 'Taj Rasoi Family Dine', area: 'Hampankatte', lat: 12.8681213, lng: 74.8471384 },
  { id: 'juice-box-perfect-pass', name: 'Juice Box, Perfect Pass', area: 'Don Bosco Rd, Hampankatte', lat: 12.8690172, lng: 74.8464310 },
  { id: 'noor-canteen', name: 'NOOR CANTEEN', area: 'Attavara Rd, Hampankatte', lat: 12.8668047, lng: 74.8444780 },
  { id: 'mm-cake-paradise', name: 'M M Cake Paradise', area: 'Opp Milagris Church, Hampankatte', lat: 12.8678376, lng: 74.8439895 },
  { id: 'sattvva-cafe', name: 'Sattvva Cafe', area: 'Hampankatte', lat: 12.869135, lng: 74.840135 },

  // KS Rao Rd
  { id: 'feel-laban-city-center', name: 'Feel Laban, City Center', area: 'KS Rao Rd', lat: 12.8711097, lng: 74.8421210 },

  // Kodialbail
  { id: 'arogya-fruits-and-juice-centre', name: 'Arogya Fruits and Juice Centre', area: 'Kodialbail', lat: 12.873331, lng: 74.841401 },

  // Farangipete — ~9.3 km east of MAP_CENTER, half a kilometre inside the 10 km
  // NEARBY_KM cut in stations.js. An outlet much further east falls outside the
  // no-location frame while these stay in it.
  { id: 'sulthan-mandi-kuzhi', name: 'Sulthan Mandi Kuzhi', area: 'Farangipete', lat: 12.8720353, lng: 74.9597309 },
  // Not Super FoodMart Bendoor — 11 km away. A branch, not a repeat.
  { id: 'super-food-mart-farangipete', name: 'Super Food mart', area: 'Farangipete', lat: 12.8733486, lng: 74.9586352 },
  { id: 'ayisha-store', name: 'Ayisha store', area: 'Farangipete', lat: 12.8738977, lng: 74.9584863 },
  { id: 'arab-inn-restaurant', name: 'ARAB INN RESTAURANT', area: 'Farangipete', lat: 12.8737281, lng: 74.9583968 },
  { id: 'yemen-kuzhi-mandi', name: 'Yemen kuzhi mandi', area: 'Farangipete', lat: 12.8740010, lng: 74.9580149 },
  { id: 'js-bakery', name: 'J S BAKERY', area: 'Farangipete', lat: 12.8742161, lng: 74.9572887 },
  { id: 'helens-bakery-farangipete', name: 'HELEN’s Bakery', area: 'Farangipete', lat: 12.8746011, lng: 74.9570084 },
  { id: 'the-wrap', name: 'The WRAP', area: 'Farangipete', lat: 12.8742252, lng: 74.9566779 },

  // Jalalbagh
  { id: 'royal-bakes', name: 'Royal Bakes', area: 'Jalalbagh', lat: 12.8063628, lng: 74.8976324 },

  // Derlakatte
  { id: '7bakes', name: '7Bakes', area: 'Derlakatte', lat: 12.8082642, lng: 74.8950440 },
  { id: 'al-ain-super-mart', name: 'Al Ain Super Mart', area: 'Derlakatte', lat: 12.8084398, lng: 74.8946441 },
  { id: 'new-bangalore-ayyengar-bakery', name: 'New Bangalore Ayyengar Bakery', area: 'Derlakatte', lat: 12.8087367, lng: 74.8939393 },
  { id: 'helens-bakery-derlakatte', name: 'Helen’s Bakery', area: 'Derlakatte', lat: 12.8093248, lng: 74.8912849 },
  { id: 'hm-book-hive', name: 'HM book Hive', area: 'Derlakatte', lat: 12.8095824, lng: 74.8902191 },
  { id: 'zooq-barbequz-golden-spoon', name: 'ZOOQ BARBEQUZ, Golden Spoon', area: 'Derlakatte', lat: 12.8098077, lng: 74.8876891 },
  // X P Gaming Cafe and Cloud Craft are 4.3 m apart — inside COINCIDENT_M, so they
  // share one pin and the list names both.
  { id: 'xp-gaming-cafe', name: 'X P GAMING CAFE', area: 'Derlakatte', lat: 12.8107927, lng: 74.8844175 },
  { id: 'cloud-craft', name: 'Cloud Craft', area: 'Derlakatte', lat: 12.8108110, lng: 74.8843829 },
  // Not Ganesh Stores in Naguri — 6.6 km away. A branch, not a repeat.
  { id: 'ganesh-store-derlakatte', name: 'Ganesh store', area: 'Derlakatte', lat: 12.8110618, lng: 74.8829211 },
  { id: 'spicy-kitchen', name: 'Spicy Kitchen', area: 'Derlakatte', lat: 12.8109601, lng: 74.8827713 },
  { id: 'cakezy', name: 'Cakezy', area: 'Derlakatte', lat: 12.8110775, lng: 74.8827045 },
  { id: 'hotel-aurelia-comforts', name: 'Hotel Aurelia Comforts', area: 'Derlakatte', lat: 12.8143373, lng: 74.8804615 },

  // Babbukatte
  { id: 'lm-general-store', name: 'L M GENERAL STORE', area: 'Babbukatte', lat: 12.8192401, lng: 74.8672208 },

  // Kallapu – Thokkotu
  { id: 'hot-banana-chips', name: 'Hot Banana Chips', area: 'Kallapu', lat: 12.8318514, lng: 74.8604496 },
  { id: 'aishwarya-bakery', name: 'Aishwarya Bakery', area: 'Kallapu', lat: 12.8249206, lng: 74.8601073 },
  { id: 'new-super-bakery', name: 'New Super Bakery', area: 'Kallapu', lat: 12.8239523, lng: 74.8600952 },
  { id: 'no1-bakery', name: 'No.1 Bakery', area: 'Thokkotu', lat: 12.8186353, lng: 74.8593754 },
  { id: 'grocers-supermarket', name: 'Grocer’s Supermarket', area: 'Kallapu', lat: 12.8195046, lng: 74.8588483 },
];

/* The view before location is known or anything selected: the centre of the
   Mangaluru corridor, where all but one outlet is. Deliberately a constant and not
   the mean of the array — the outlet 106 km away would drag the default view by
   3.5 km, and the next distant one would drag it further. */
export const MAP_CENTER = { lat: 12.865592, lng: 74.872609 };
export const MAP_ZOOM = 13;
export const FOCUS_ZOOM = 16;

/* Universal cross-platform Maps URL: opens the native app on iOS/Android,
   the web map on desktop. */
/* With an origin, Google Maps opens with the route already drawn instead of an
   empty search field — the visitor sees the line, not a form. Without one it still
   works; Maps then uses whatever location that app has. */
export function directionsUrl(station, from) {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lng}`;
  return from ? `${url}&origin=${from.lat},${from.lng}&travelmode=driving` : url;
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
