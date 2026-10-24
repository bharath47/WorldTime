import { afterEach, describe, expect, it, vi } from 'vitest';
import { describeWeather, fetchHomeWeather, fetchWeather } from './weather';

afterEach(() => vi.unstubAllGlobals());

describe('optional weather service', () => {
  it.each([[0, 'clear'], [2, 'cloudy'], [45, 'cloudy'], [61, 'rainy'], [95, 'rainy'], [75, 'snowy']])(
    'maps WMO code %i to %s', (code, style) => {
      expect(describeWeather(Number(code)).style).toBe(style);
    });

    describe('home-base weather lookup', () => {
      const london = { id: 'london', name: 'London', country: 'United Kingdom', zone: 'Europe/London' };
      const location = { latitude: 51.507351, longitude: -0.127758, timezone: 'Europe/London' };
      it('matches the home time zone instead of using a same-named city elsewhere', async () => {
        const mock = vi.fn()
          .mockResolvedValueOnce(new Response(JSON.stringify({ results: [
            { latitude: 42.98, longitude: -81.23, timezone: 'America/Toronto' }, location,
          ] })))
          .mockResolvedValueOnce(new Response(JSON.stringify({ current: { temperature_2m: 18, weather_code: 0 } })));
        vi.stubGlobal('fetch', mock);
        const signal = new AbortController().signal;
        await expect(fetchHomeWeather(london, signal)).resolves.toMatchObject({ temperature: 18 });
        expect(new URL(mock.mock.calls[0][0]).searchParams.get('name')).toBe('London');
        expect(new URL(mock.mock.calls[1][0]).searchParams.get('latitude')).toBe('51.51');
        expect(mock.mock.calls[0][1]).toEqual({ signal });
        expect(mock.mock.calls[1][1]).toEqual({ signal });
      });
      it('accepts canonical aliases such as Asia/Calcutta for Chennai', async () => {
        const mock = vi.fn()
          .mockResolvedValueOnce(new Response(JSON.stringify({ results: [
            { latitude: 13.08, longitude: 80.27, timezone: 'Asia/Calcutta' },
          ] })))
          .mockResolvedValueOnce(new Response(JSON.stringify({ current: { temperature_2m: 30, weather_code: 2 } })));
        vi.stubGlobal('fetch', mock);
        await expect(fetchHomeWeather(
          { id: 'chennai', name: 'Chennai', country: 'India', zone: 'Asia/Kolkata' }, new AbortController().signal,
        )).resolves.toMatchObject({ temperature: 30 });
      });
      it.each([
        {}, { results: [] },
        { results: [{ ...location, latitude: 100 }] },
        { results: [{ ...location, timezone: 'America/New_York' }] },
        { results: [{ ...location, timezone: 'Not/AZone' }] },
      ])('rejects missing, invalid, or mismatched geocoding data', async data => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(data))));
        await expect(fetchHomeWeather(london, new AbortController().signal)).rejects.toThrow();
      });
      it('surfaces city lookup failures without requesting a forecast', async () => {
        const mock = vi.fn().mockResolvedValue(new Response('', { status: 503 }));
        vi.stubGlobal('fetch', mock);
        await expect(fetchHomeWeather(london, new AbortController().signal)).rejects.toThrow('503');
        expect(mock).toHaveBeenCalledTimes(1);
      });
    });
  it('rejects unknown conditions', () => expect(() => describeWeather(999)).toThrow());
  it('uses approximate coordinates and validates the forecast', async () => {
    const mock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      current: { temperature_2m: 21.6, weather_code: 0 },
    })));
    vi.stubGlobal('fetch', mock);
    await expect(fetchWeather(51.507351, -0.127758, new AbortController().signal))
      .resolves.toEqual({ temperature: 22, description: 'Clear skies', style: 'clear' });
    const url = new URL(mock.mock.calls[0][0]);
    expect(url.searchParams.get('latitude')).toBe('51.51');
    expect(url.searchParams.get('longitude')).toBe('-0.13');
  });
  it.each([{}, { current: {} }, { current: { temperature_2m: 'hot', weather_code: 0 } }])(
    'rejects malformed API data', async data => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(data))));
      await expect(fetchWeather(0, 0, new AbortController().signal)).rejects.toThrow('incomplete');
    });
  it('surfaces HTTP and network failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));
    await expect(fetchWeather(0, 0, new AbortController().signal)).rejects.toThrow('503');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline')));
    await expect(fetchWeather(0, 0, new AbortController().signal)).rejects.toThrow('Offline');
  });
});
