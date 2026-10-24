import { describe, expect, it } from 'vitest';
import { cities, searchCities } from './cities';
import { defaults, parsePreferences } from './preferences';
import { formatTime, offsetLabel } from './time';

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
  it.each(['Dallas', 'Fort Worth', 'Houston'])('finds %s independently of other Central Time cities', name => {
    const [city] = searchCities(`  ${name.toUpperCase()} `, ['chicago', 'austin']);
    expect(city).toMatchObject({ name, country: 'United States', zone: 'America/Chicago' });
    expect(searchCities(name, [city.id])).toEqual([]);
  });
  it.each([
    ['2026-01-15T18:00:00Z', '12:00', 'UTC-06'],
    ['2026-07-15T18:00:00Z', '13:00', 'UTC-05'],
  ])('uses Dallas Central Time with date-specific DST at %s', (date, time, offset) => {
    const [dallas] = searchCities('Dallas', []);
    const instant = Date.parse(date);
    expect(formatTime(instant, dallas.zone, false)).toBe(time);
    expect(offsetLabel(instant, dallas.zone)).toBe(offset);
  });
  it('does not offer duplicates and bounds results', () => {
    expect(searchCities('tokyo', ['tokyo'])).toEqual([]);
    expect(searchCities('', [])).toHaveLength(10);
    expect(searchCities('not a real city', [])).toEqual([]);
  });
});
