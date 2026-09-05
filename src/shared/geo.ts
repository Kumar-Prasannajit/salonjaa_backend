/**
 * Plain Haversine distance, no external dependency — per the "Location/maps decision" in
 * docs/PROGRESS.md ("Nearby-branch search will be plain Haversine math or Postgres
 * earthdistance, built when the Availability/Search module is built"). This is that module
 * (public branch browse). Computed in the application layer rather than in SQL to avoid
 * adding a Postgres extension (`earthdistance`/`cube`) for MVP — dataset size doesn't warrant it.
 */
const EARTH_RADIUS_KM = 6371;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}
