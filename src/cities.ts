export interface City {
  id: string;
  name: string;
  country: string;
  zone: string;
}

const places: [string, string, string][] = [
  ['New York', 'United States', 'America/New_York'],
  ['London', 'United Kingdom', 'Europe/London'],
  ['Bengaluru', 'India', 'Asia/Kolkata'],
  ['Tokyo', 'Japan', 'Asia/Tokyo'],
  ['San Francisco', 'United States', 'America/Los_Angeles'],
  ['Los Angeles', 'United States', 'America/Los_Angeles'],
  ['Seattle', 'United States', 'America/Los_Angeles'],
  ['Chicago', 'United States', 'America/Chicago'],
  ['Austin', 'United States', 'America/Chicago'],
  ['Denver', 'United States', 'America/Denver'],
  ['Phoenix', 'United States', 'America/Phoenix'],
  ['Honolulu', 'United States', 'Pacific/Honolulu'],
  ['Anchorage', 'United States', 'America/Anchorage'],
  ['Toronto', 'Canada', 'America/Toronto'],
  ['Vancouver', 'Canada', 'America/Vancouver'],
  ['Mexico City', 'Mexico', 'America/Mexico_City'],
  ['Sao Paulo', 'Brazil', 'America/Sao_Paulo'],
  ['Buenos Aires', 'Argentina', 'America/Argentina/Buenos_Aires'],
  ['Santiago', 'Chile', 'America/Santiago'],
  ['Bogota', 'Colombia', 'America/Bogota'],
  ['Lima', 'Peru', 'America/Lima'],
  ['Paris', 'France', 'Europe/Paris'],
  ['Berlin', 'Germany', 'Europe/Berlin'],
  ['Amsterdam', 'Netherlands', 'Europe/Amsterdam'],
  ['Madrid', 'Spain', 'Europe/Madrid'],
  ['Rome', 'Italy', 'Europe/Rome'],
  ['Lisbon', 'Portugal', 'Europe/Lisbon'],
  ['Dublin', 'Ireland', 'Europe/Dublin'],
  ['Zurich', 'Switzerland', 'Europe/Zurich'],
  ['Stockholm', 'Sweden', 'Europe/Stockholm'],
  ['Helsinki', 'Finland', 'Europe/Helsinki'],
  ['Athens', 'Greece', 'Europe/Athens'],
  ['Kyiv', 'Ukraine', 'Europe/Kyiv'],
  ['Istanbul', 'Turkey', 'Europe/Istanbul'],
  ['Moscow', 'Russia', 'Europe/Moscow'],
  ['Dubai', 'United Arab Emirates', 'Asia/Dubai'],
  ['Riyadh', 'Saudi Arabia', 'Asia/Riyadh'],
  ['Tel Aviv', 'Israel', 'Asia/Jerusalem'],
  ['Cairo', 'Egypt', 'Africa/Cairo'],
  ['Cape Town', 'South Africa', 'Africa/Johannesburg'],
  ['Johannesburg', 'South Africa', 'Africa/Johannesburg'],
  ['Lagos', 'Nigeria', 'Africa/Lagos'],
  ['Nairobi', 'Kenya', 'Africa/Nairobi'],
  ['Accra', 'Ghana', 'Africa/Accra'],
  ['Mumbai', 'India', 'Asia/Kolkata'],
  ['New Delhi', 'India', 'Asia/Kolkata'],
  ['Chennai', 'India', 'Asia/Kolkata'],
  ['Hyderabad', 'India', 'Asia/Kolkata'],
  ['Colombo', 'Sri Lanka', 'Asia/Colombo'],
  ['Kathmandu', 'Nepal', 'Asia/Kathmandu'],
  ['Dhaka', 'Bangladesh', 'Asia/Dhaka'],
  ['Karachi', 'Pakistan', 'Asia/Karachi'],
  ['Singapore', 'Singapore', 'Asia/Singapore'],
  ['Hong Kong', 'Hong Kong', 'Asia/Hong_Kong'],
  ['Shanghai', 'China', 'Asia/Shanghai'],
  ['Beijing', 'China', 'Asia/Shanghai'],
  ['Seoul', 'South Korea', 'Asia/Seoul'],
  ['Taipei', 'Taiwan', 'Asia/Taipei'],
  ['Bangkok', 'Thailand', 'Asia/Bangkok'],
  ['Jakarta', 'Indonesia', 'Asia/Jakarta'],
  ['Kuala Lumpur', 'Malaysia', 'Asia/Kuala_Lumpur'],
  ['Manila', 'Philippines', 'Asia/Manila'],
  ['Ho Chi Minh City', 'Vietnam', 'Asia/Ho_Chi_Minh'],
  ['Sydney', 'Australia', 'Australia/Sydney'],
  ['Melbourne', 'Australia', 'Australia/Melbourne'],
  ['Perth', 'Australia', 'Australia/Perth'],
  ['Adelaide', 'Australia', 'Australia/Adelaide'],
  ['Brisbane', 'Australia', 'Australia/Brisbane'],
  ['Auckland', 'New Zealand', 'Pacific/Auckland'],
  ['Wellington', 'New Zealand', 'Pacific/Auckland'],
  ['Chatham Islands', 'New Zealand', 'Pacific/Chatham'],
  ['UTC', 'Coordinated Universal Time', 'UTC'],
];

function supported(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

const curated = places.filter(([, , zone]) => supported(zone)).map(([name, country, zone]) => ({
  id: name.toLowerCase().replaceAll(' ', '-'),
  name, country, zone,
}));
const knownZones = new Set(curated.map(city => city.zone));
const extra = Intl.supportedValuesOf('timeZone')
  .filter(zone => !knownZones.has(zone))
  .map(zone => ({
    id: zone,
    name: zone.split('/').at(-1)!.replaceAll('_', ' '),
    country: zone.split('/')[0].replaceAll('_', ' '),
    zone,
  }));

export const cities: City[] = [...curated, ...extra];
export const defaultCities = ['new-york', 'london', 'bengaluru', 'tokyo'];

export function searchCities(query: string, selected: string[]): City[] {
  const text = query.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const aliases = text.replace('bangalore', 'bengaluru').replace('calcutta', 'kolkata');
  return cities.filter(city => !selected.includes(city.id) &&
    `${city.name} ${city.country} ${city.zone}`.toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').includes(aliases)).slice(0, 10);
}
