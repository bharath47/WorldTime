const radians = Math.PI / 180;

export interface GlobeCity {
  name: string;
  zone: string;
  latitude: number;
  longitude: number;
}

export const globeCities: GlobeCity[] = [
  { name: 'Wellington', zone: 'Pacific/Auckland', latitude: -41.29, longitude: 174.78 },
  { name: 'Sydney', zone: 'Australia/Sydney', latitude: -33.87, longitude: 151.21 },
  { name: 'Tokyo', zone: 'Asia/Tokyo', latitude: 35.68, longitude: 139.69 },
  { name: 'Singapore', zone: 'Asia/Singapore', latitude: 1.35, longitude: 103.82 },
  { name: 'Chennai', zone: 'Asia/Kolkata', latitude: 13.08, longitude: 80.27 },
  { name: 'Dubai', zone: 'Asia/Dubai', latitude: 25.2, longitude: 55.27 },
  { name: 'Nairobi', zone: 'Africa/Nairobi', latitude: -1.29, longitude: 36.82 },
  { name: 'Cape Town', zone: 'Africa/Johannesburg', latitude: -33.92, longitude: 18.42 },
  { name: 'London', zone: 'Europe/London', latitude: 51.51, longitude: -0.13 },
  { name: 'Sao Paulo', zone: 'America/Sao_Paulo', latitude: -23.55, longitude: -46.63 },
  { name: 'New York', zone: 'America/New_York', latitude: 40.71, longitude: -74.01 },
  { name: 'Los Angeles', zone: 'America/Los_Angeles', latitude: 34.05, longitude: -118.24 },
  { name: 'Honolulu', zone: 'Pacific/Honolulu', latitude: 21.31, longitude: -157.86 },
];

export function longitudeDifference(longitude: number, center: number): number {
  return ((longitude - center) % 360 + 540) % 360 - 180;
}

export function cityNearCenter(longitude: number) {
  let nearest: GlobeCity | null = null;
  let distance = 20;
  for (const city of globeCities) {
    const delta = Math.abs(longitudeDifference(city.longitude, longitude));
    if (delta < distance) { nearest = city; distance = delta; }
  }
  if (!nearest) return null;
  const x = Math.cos(nearest.latitude * radians) *
    Math.sin(longitudeDifference(nearest.longitude, longitude) * radians);
  const y = -Math.sin(nearest.latitude * radians);
  const tilt = -15 * radians;
  return {
    city: nearest,
    x: x * Math.cos(tilt) - y * Math.sin(tilt),
    y: x * Math.sin(tilt) + y * Math.cos(tilt),
  };
}

export function solarPosition(epoch: number) {
  const date = new Date(epoch);
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const day = Math.floor((epoch - yearStart) / 86400000) + 1;
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const gamma = 2 * Math.PI / 365 * (day - 1 + (hours - 12) / 24);
  // NOAA's fractional-year approximation includes the seasons and equation of time.
  const declination = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma)
    - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma)
    - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
  const equation = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma)
    - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  return { declination, longitude: longitudeDifference(180 - hours * 15 - equation / 4, 0) };
}

export function sunlightAt(epoch: number, latitude: number, longitude: number): number {
  const sun = solarPosition(epoch);
  return Math.sin(latitude * radians) * Math.sin(sun.declination) +
    Math.cos(latitude * radians) * Math.cos(sun.declination) *
    Math.cos((longitude - sun.longitude) * radians);
}

export function solarLightVector(epoch: number, centerLongitude: number) {
  const sun = solarPosition(epoch);
  const relative = (sun.longitude - centerLongitude) * radians;
  return {
    x: Math.cos(sun.declination) * Math.sin(relative),
    y: Math.sin(sun.declination),
    z: Math.cos(sun.declination) * Math.cos(relative),
  };
}
