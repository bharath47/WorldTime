import { describe, expect, it } from 'vitest';
import { cityNearCenter, longitudeDifference, solarLightVector, solarPosition, sunlightAt } from './globe';

describe('rotating city callouts', () => {
  it.each([[140, 'Tokyo'], [175, 'Wellington'], [80, 'Chennai'], [-74, 'New York'], [360, 'London']])(
    'shows the city nearest longitude %i', (longitude, name) => {
      expect(cityNearCenter(Number(longitude))?.city.name).toBe(name);
    });
  it('does not show a city when none is near the central meridian', () => {
    expect(cityNearCenter(-25)).toBeNull();
  });
  it('wraps across the international date line', () => {
    expect(longitudeDifference(174.78, -179)).toBeCloseTo(-6.22);
    expect(cityNearCenter(-179)?.city.name).toBe('Wellington');
  });
  it('keeps the projected city marker on the visible globe', () => {
    const marker = cityNearCenter(80)!;
    expect(Math.hypot(marker.x, marker.y)).toBeLessThan(1);
  });
});

describe('current-time Earth lighting', () => {
  const noon = Date.parse('2026-03-20T12:00:00Z');
  it('lights the noon side and darkens the opposite side at the equinox', () => {
    expect(sunlightAt(noon, 0, 0)).toBeGreaterThan(0.99);
    expect(sunlightAt(noon, 0, 180)).toBeLessThan(-0.99);
  });
  it('moves daylight to the other side after twelve hours', () => {
    expect(sunlightAt(noon + 12 * 3600000, 0, 0)).toBeLessThan(-0.99);
    expect(sunlightAt(noon + 12 * 3600000, 0, 180)).toBeGreaterThan(0.99);
  });
  it('accounts for the seasons and polar day/night', () => {
    const summer = Date.parse('2026-06-21T00:00:00Z');
    const winter = Date.parse('2026-12-21T12:00:00Z');
    expect(solarPosition(summer).declination).toBeGreaterThan(0.39);
    expect(sunlightAt(summer, 80, 0)).toBeGreaterThan(0);
    expect(sunlightAt(winter, 80, 0)).toBeLessThan(0);
  });
  it('identifies Tokyo night and Wellington night using their actual coordinates', () => {
    const now = Date.parse('2026-03-08T13:00:00Z');
    expect(sunlightAt(now, 35.68, 139.69)).toBeLessThan(0);
    expect(sunlightAt(now, -41.29, 174.78)).toBeLessThan(0);
    expect(sunlightAt(now - 12 * 3600000, 35.68, 139.69)).toBeGreaterThan(0);
  });
  it('keeps a location correctly lit when the viewing longitude changes', () => {
    const vector = solarLightVector(noon, 90);
    expect(vector.x).toBeLessThan(-0.99);
    const length = Math.hypot(vector.x, vector.y, vector.z);
    expect(length).toBeCloseTo(1);
  });
});
