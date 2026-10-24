import { cities, defaultCities } from './cities';

export type GlobeSpeed = 0 | 30 | 60 | 120 | 180;

export function parseGlobeSpeed(value: unknown): GlobeSpeed {
  if (value === 0 || value === 30 || value === 60 || value === 120 || value === 180) return value;
  throw new Error('Globe rotation speed is invalid.');
}

export interface Preferences {
  cityIds: string[];
  hour12: boolean;
  workHours: boolean;
  weather: boolean;
  globeSpeed: GlobeSpeed;
}
export const storageKey = 'timeisvirtual.preferences.v1';
export const defaults: Preferences = { cityIds: defaultCities, hour12: true, workHours: true, weather: false, globeSpeed: 120 };

export function parsePreferences(raw: string | null): Preferences {
  if (raw === null) return { ...defaults };
  const value: unknown = JSON.parse(raw);
  if (typeof value !== 'object' || value === null) throw new Error('Saved preferences are not an object.');
  const p = value as Record<string, unknown>;
  if (!Array.isArray(p.cityIds) || p.cityIds.length < 1 || p.cityIds.length > 8 ||
    p.cityIds.some(id => typeof id !== 'string' || !cities.some(city => city.id === id)) ||
    new Set(p.cityIds).size !== p.cityIds.length ||
    typeof p.hour12 !== 'boolean' || typeof p.workHours !== 'boolean' || typeof p.weather !== 'boolean') {
    throw new Error('Saved preferences have an invalid format.');
  }
  const globeSpeed = parseGlobeSpeed(p.globeSpeed === undefined ? defaults.globeSpeed : p.globeSpeed);
  return { cityIds: p.cityIds as string[], hour12: p.hour12, workHours: p.workHours, weather: p.weather, globeSpeed };
}
