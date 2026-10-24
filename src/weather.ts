import type { City } from './cities';

export interface Weather {
  temperature: number;
  description: string;
  style: 'clear' | 'cloudy' | 'rainy' | 'snowy';
}

export function describeWeather(code: number): Pick<Weather, 'description' | 'style'> {
  if (code === 0) return { description: 'Clear skies', style: 'clear' };
  if ([1, 2, 3].includes(code)) return { description: 'A little cloudy', style: 'cloudy' };
  if ([45, 48].includes(code)) return { description: 'Misty skies', style: 'cloudy' };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { description: 'Snow outside', style: 'snowy' };
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code)) {
    return { description: 'Rainy skies', style: 'rainy' };
  }
  throw new Error('Unrecognized weather condition.');
}

export async function fetchWeather(latitude: number, longitude: number, signal: AbortSignal): Promise<Weather> {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(2), longitude: longitude.toFixed(2),
    current: 'temperature_2m,weather_code', temperature_unit: 'celsius',
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal });
  if (!response.ok) throw new Error(`Weather service returned ${response.status}.`);
  const data: unknown = await response.json();
  if (!data || typeof data !== 'object' || !('current' in data) ||
    !data.current || typeof data.current !== 'object' ||
    !('temperature_2m' in data.current) || !('weather_code' in data.current) ||
    typeof data.current.temperature_2m !== 'number' || !Number.isFinite(data.current.temperature_2m) ||
    typeof data.current.weather_code !== 'number') {
    throw new Error('Weather service returned incomplete data.');
  }
  return { temperature: Math.round(data.current.temperature_2m), ...describeWeather(data.current.weather_code) };
}

interface WeatherLocation {
  latitude: number;
  longitude: number;
  timezone: string;
}

function isWeatherLocation(value: unknown): value is WeatherLocation {
  return typeof value === 'object' && value !== null &&
    'latitude' in value && typeof value.latitude === 'number' &&
    Number.isFinite(value.latitude) && Math.abs(value.latitude) <= 90 &&
    'longitude' in value && typeof value.longitude === 'number' &&
    Number.isFinite(value.longitude) && Math.abs(value.longitude) <= 180 &&
    'timezone' in value && typeof value.timezone === 'string';
}

export async function fetchHomeWeather(city: City, signal: AbortSignal): Promise<Weather> {
  const params = new URLSearchParams({ name: city.name, count: '100', language: 'en', format: 'json' });
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, { signal });
  if (!response.ok) throw new Error(`City weather lookup returned ${response.status}.`);
  const data: unknown = await response.json();
  if (!data || typeof data !== 'object' || !('results' in data) || !Array.isArray(data.results)) {
    throw new Error(`No weather location found for ${city.name}.`);
  }
  const canonicalZone = (zone: string) => new Intl.DateTimeFormat('en', { timeZone: zone }).resolvedOptions().timeZone;
  const zone = canonicalZone(city.zone);
  const location = data.results.filter(isWeatherLocation)
    .find(result => canonicalZone(result.timezone) === zone);
  if (!location) throw new Error(`No matching weather location found for ${city.name}.`);
  return fetchWeather(location.latitude, location.longitude, signal);
}
