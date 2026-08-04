/* Distancias y tiempos a pie calculados a partir de coordenadas.
   Decisión: el anfitrión NO teclea "a 6 minutos andando" — se deriva del dato.
   Así ningún idioma se queda con una distancia desactualizada y no hay
   incoherencias entre las cuatro traducciones. */

const EARTH_RADIUS_M = 6371000;
/* 4,5 km/h: ritmo real de paseo con maleta o con niños, no el ritmo de marcha
   de 5 km/h que usan las apps de rutas. Prefiero pasarme por arriba. */
const WALKING_SPEED_M_PER_MIN = 75;
/* Factor de rodeo: la calle no va en línea recta. 1,3 es el valor habitual en
   trama urbana europea; en cascos históricos con cuestas se queda corto, por eso
   redondeamos siempre hacia arriba. */
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

/* Enlace universal a mapas: funciona en iOS, Android y escritorio sin depender
   de una app concreta ni de una API de pago. */
export function directionsUrl(to: { lat: number; lng: number; name?: string }): string {
  const q = `${to.lat},${to.lng}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
}
