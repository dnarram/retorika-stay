/* Distances and walking times derived from coordinates.

   Design decision: the host never types "6 minutes away" — it is computed from
   the data. That way no language ends up with a stale distance and the four
   translations can never disagree with each other. */

const EARTH_RADIUS_M = 6371000;
/* 4.5 km/h: a realistic pace with a suitcase or with children, not the 5 km/h
   marching pace that routing apps assume. Better to overestimate. */
const WALKING_SPEED_M_PER_MIN = 75;
/* Detour factor: streets do not run in straight lines. 1.3 is the usual value
   for European urban grids; in hilly old towns it still falls short, which is
   why we always round up. */
const DETOUR_FACTOR = 1.3;

const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function walkingMinutes(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const meters = haversineMeters(from, to) * DETOUR_FACTOR;
  return Math.max(1, Math.ceil(meters / WALKING_SPEED_M_PER_MIN));
}

export function formatDistance(meters: number): string {
  const walked = meters * DETOUR_FACTOR;
  return walked < 1000
    ? `${Math.round(walked / 10) * 10} m`
    : `${(walked / 1000).toFixed(1)} km`;
}

/* Universal maps link: works on iOS, Android and desktop without depending on a
   specific app or on a paid API. */
export function directionsUrl(to: { lat: number; lng: number; name?: string }): string {
  const q = `${to.lat},${to.lng}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
}
