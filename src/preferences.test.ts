import { describe, expect, it } from 'vitest';
import { cities, searchCities } from './cities';
import { defaults, parsePreferences } from './preferences';

describe('saved preferences', () => {
  it('provides sensible first-run defaults', () => {
    expect(parsePreferences(null)).toEqual(defaults);
    expect(defaults.weather).toBe(false);
  });
  it('round-trips all settings and the home city order', () => {
    const preferences = { cityIds: ['tokyo', 'london'], hour12: false, weather: true, workHours: false, globeSpeed: 60 };
    expect(parsePreferences(JSON.stringify(preferences))).toEqual(preferences);
  });
  it('migrates existing saved preferences without losing the home base', () => {
    const legacy = { cityIds: ['wellington', 'chennai'], hour12: false, weather: true, workHours: false };
    expect(parsePreferences(JSON.stringify(legacy))).toEqual({ ...legacy, globeSpeed: 120 });
  });
  it('saves and restores the paused globe setting', () => {
    const paused = { ...defaults, globeSpeed: 0 };
    expect(parsePreferences(JSON.stringify(paused))).toEqual(paused);
  });
  it.each([
    '{broken', 'null', '[]',
    JSON.stringify({ ...defaults, cityIds: [] }),
    JSON.stringify({ ...defaults, cityIds: ['missing-city'] }),
    JSON.stringify({ ...defaults, cityIds: ['tokyo', 'tokyo'] }),
    JSON.stringify({ ...defaults, weather: 'yes' }),
    JSON.stringify({ ...defaults, globeSpeed: -1 }),
    JSON.stringify({ ...defaults, globeSpeed: 'fast' }),
    JSON.stringify({ ...defaults, globeSpeed: null }),
    JSON.stringify({ ...defaults, cityIds: cities.slice(0, 9).map(city => city.id) }),
  ])('rejects invalid data explicitly: %s', raw => {
    expect(() => parsePreferences(raw)).toThrow();
  });
});

describe('offline city search', () => {
  it('finds a city, country, IANA zone, and common alias', () => {
    expect(searchCities('  tokyo ', [])[0].id).toBe('tokyo');
    expect(searchCities('New Zealand', []).some(city => city.id === 'auckland')).toBe(true);
    expect(searchCities('Asia/Kathmandu', [])[0].name).toBe('Kathmandu');
    expect(searchCities('Bangalore', [])[0].id).toBe('bengaluru');
  });
  it('does not offer duplicates and bounds results', () => {
    expect(searchCities('tokyo', ['tokyo'])).toEqual([]);
    expect(searchCities('', [])).toHaveLength(10);
    expect(searchCities('not a real city', [])).toEqual([]);
  });
});
