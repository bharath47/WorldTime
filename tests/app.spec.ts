import { expect, test, type Page } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

test.beforeEach(async ({ page }) => {
  await page.route('https://geocoding-api.open-meteo.com/**', route => {
    const name = new URL(route.request().url()).searchParams.get('name');
    const locations: Record<string, { latitude: number; longitude: number; timezone: string }> = {
      'New York': { latitude: 40.71, longitude: -74.01, timezone: 'America/New_York' },
      Wellington: { latitude: -41.29, longitude: 174.78, timezone: 'Pacific/Auckland' },
      Chennai: { latitude: 13.08, longitude: 80.27, timezone: 'Asia/Kolkata' },
    };
    return route.fulfill({ json: { results: name && locations[name] ? [locations[name]] : [] } });
  });
});

async function open(page: Page) {
  await page.clock.install({ time: new Date('2026-03-08T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-03-08T13:00:00Z'));
  await page.goto('/?scoutTheme=light');
  await expect(page.getByRole('heading', { name: 'World clocks' })).toBeVisible();
}

test('loads without weather requests, ticks live, and keeps the hero in view', async ({ page }) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.url().includes('open-meteo')) external.push(request.url()); });
  await page.clock.install({ time: new Date('2026-03-08T12:59:00Z') });
  await page.clock.pauseAt(new Date('2026-03-08T12:59:59Z'));
  await page.goto('/?scoutTheme=light');
  await expect(page.getByText('Good day!', { exact: true })).toBeVisible();
  await expect(page.getByTestId('clock-new-york')).toContainText('08:59');
  await page.clock.runFor(2000);
  await expect(page.getByTestId('clock-new-york')).toContainText('09:00');
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test('searches offline with the keyboard and saves format, city order, and highlighting', async ({ page }) => {
  await open(page);
  const search = page.getByRole('combobox', { name: 'Search cities or time zones' });
  await search.fill('Kathmandu');
  await search.press('Enter');
  await expect(page.getByRole('heading', { name: 'Kathmandu', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Make Kathmandu home base' }).click();
  await page.getByRole('button', { name: '24 hr', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Highlight working hours' }).uncheck();
  await page.reload();
  await expect(page.locator('.city-card').first()).toHaveAttribute('aria-label', 'Kathmandu clock');
  await expect(page.getByRole('button', { name: '24 hr', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('checkbox', { name: 'Highlight working hours' })).not.toBeChecked();
  await expect(page.getByTestId('clock-kathmandu')).toContainText('18:45');
});

test('renders 23 and 25 hour DST days and synchronizes every selected row', async ({ page }) => {
  await open(page);
  await expect(page.locator('.hour-header')).toHaveCount(23);
  await page.getByRole('textbox', { name: 'Comparison date in New York' }).fill('2026-11-01');
  await expect(page.locator('.hour-header')).toHaveCount(25);
  const repeated = page.getByRole('button', { name: /^New York, Sun, Nov 1, 01:00 AM/ });
  await expect(repeated).toHaveCount(2);
  await repeated.nth(1).click();
  await expect(page.getByTestId('clock-new-york')).toContainText('01:00');
  await expect(page.getByTestId('clock-london')).toContainText('06:00');
  await expect(page.getByTestId('clock-bengaluru')).toContainText('11:30');
  await expect(page.getByTestId('clock-tokyo')).toContainText('03:00');
  await expect(page.locator('.hour-cell.selected-cell')).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'Back to now' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to now' }).click();
  await expect(page.getByRole('button', { name: 'Live', exact: true })).toBeVisible();
  await expect(page.locator('.hour-header')).toHaveCount(23);
});

test('date navigation crosses months and city removal keeps one home base', async ({ page }) => {
  await open(page);
  const date = page.getByRole('textbox', { name: 'Comparison date in New York' });
  await date.fill('2026-12-31');
  await page.getByRole('button', { name: 'Next day', exact: true }).click();
  await expect(date).toHaveValue('2027-01-01');
  await page.getByRole('button', { name: 'Previous day', exact: true }).click();
  await expect(date).toHaveValue('2026-12-31');
  await page.getByRole('button', { name: 'Remove New York', exact: true }).click();
  await expect(page.locator('.city-card').first()).toHaveAttribute('aria-label', 'London clock');
  await page.getByRole('button', { name: 'Remove Bengaluru', exact: true }).click();
  await page.getByRole('button', { name: 'Remove Tokyo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove London', exact: true })).toBeDisabled();
});

test('missing home-city weather uses a friendly fallback without breaking comparisons', async ({ page }) => {
  await page.route('https://geocoding-api.open-meteo.com/**', route => route.fulfill({ json: { results: [] } }));
  await open(page);
  await page.getByRole('button', { name: 'Enable home weather' }).click();
  await expect(page.getByText('Good day!', { exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Weather unavailable');
  await page.getByRole('textbox', { name: 'Comparison date in New York' }).fill('2026-07-01');
  await expect(page.locator('.hour-header')).toHaveCount(24);
  await expect(page.getByTestId('clock-tokyo')).toBeVisible();
});

test('Open-Meteo success uses the home base without device location and credits the provider', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = () => { throw new Error('Device location must not be requested'); };
  });
  await page.route('https://api.open-meteo.com/**', route => route.fulfill({
    json: { current: { temperature_2m: 14.4, weather_code: 61 } },
  }));
  await open(page);
  await page.getByRole('button', { name: 'Enable home weather' }).click();
  await expect(page.getByText('New York: Rainy skies, 14\u00b0C', { exact: true })).toBeVisible();
  await expect(page.locator('.weather-settings')).toHaveCount(0);
  await expect(page.getByText('Home weather on', { exact: true })).toHaveCount(0);
  await expect(page.locator('.hero')).toHaveClass(/weather-rainy/);
  await expect(page.getByRole('link', { name: 'Open-Meteo', exact: true })).toBeVisible();
  const saved = await page.evaluate(() => localStorage.getItem('timeisvirtual.preferences.v1'));
  expect(saved).toContain('"weather":true');
  expect(saved).not.toContain('latitude');
  expect(saved).not.toContain('51.50');
  await page.getByRole('button', { name: 'Turn off weather' }).click();
  await expect(page.getByText('Good day!', { exact: true })).toBeVisible();
});

test('weather network and malformed-response failures remain isolated', async ({ page }) => {
  await page.route('https://api.open-meteo.com/**', route => route.abort());
  await open(page);
  await page.getByRole('button', { name: 'Enable home weather' }).click();
  await expect(page.getByRole('status')).toContainText('Weather unavailable');
  await page.unroute('https://api.open-meteo.com/**');
  await page.route('https://api.open-meteo.com/**', route => route.fulfill({ json: { current: {} } }));
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Weather unavailable');
  await expect(page.getByText('Good day!', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '24 hr', exact: true }).click();
  await expect(page.getByTestId('clock-new-york')).toHaveText('09:00');
});

test('a stalled weather request times out without stopping live clocks', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('https://api.open-meteo.com/**', () => {});
  await open(page);
  const request = page.waitForRequest('https://api.open-meteo.com/**');
  await page.getByRole('button', { name: 'Enable home weather' }).click();
  await request;
  await page.clock.runFor(12001);
  await expect(page.getByRole('status')).toContainText('Weather unavailable');
  await expect(page.getByText('Good day!', { exact: true })).toBeVisible();
  await page.clock.runFor(60000);
  await expect(page.getByTestId('clock-new-york')).toContainText('09:01');
});

test('disabling weather ignores a late forecast response', async ({ page }) => {
  let complete: (() => Promise<void>) | undefined;
  await page.route('https://api.open-meteo.com/**', route => {
    complete = () => route.fulfill({ json: { current: { temperature_2m: 24, weather_code: 0 } } });
  });
  await open(page);
  const request = page.waitForRequest('https://api.open-meteo.com/**');
  await page.getByRole('button', { name: 'Enable home weather' }).click();
  await request;
  await page.getByRole('button', { name: 'Turn off weather' }).click();
  await complete?.();
  await expect(page.getByText('Good day!', { exact: true })).toBeVisible();
  await expect(page.locator('.hero')).toHaveClass(/weather-neutral/);
  await expect(page.getByRole('button', { name: 'Enable home weather' })).toHaveAttribute('aria-pressed', 'false');
});

test('weather refreshes with the home base while globe callouts follow the visible city', async ({ page }) => {
  const latitudes: string[] = [];
  await page.route('https://api.open-meteo.com/**', route => {
    const latitude = new URL(route.request().url()).searchParams.get('latitude')!;
    latitudes.push(latitude);
    return route.fulfill({ json: { current: { temperature_2m: latitude === '13.08' ? 30 : 16, weather_code: 0 } } });
  });
  await open(page);
  await expect(page.locator('.globe-city-label')).toHaveAttribute('data-city', 'Tokyo');
  for (const city of ['Wellington', 'Chennai']) {
    await page.getByRole('combobox', { name: 'Search cities or time zones' }).fill(city);
    await page.getByRole('combobox', { name: 'Search cities or time zones' }).press('Enter');
  }
  await page.getByRole('button', { name: 'Make Wellington home base' }).click();
  await page.getByRole('button', { name: 'Enable home weather' }).click();
  await expect(page.getByText('Wellington: Clear skies, 16\u00b0C', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Make Chennai home base' }).click();
  await expect(page.getByText('Chennai: Clear skies, 30\u00b0C', { exact: true })).toBeVisible();
  expect(latitudes).toEqual(['-41.29', '13.08']);
  await page.reload();
  await expect(page.getByText('Chennai: Clear skies, 30\u00b0C', { exact: true })).toBeVisible();
});

test('city info shows the next clock change from today and explains non-DST zones', async ({ page }) => {
  await open(page);
  const info = page.getByLabel('Daylight saving information for New York', { exact: true });
  await info.focus();
  await page.keyboard.press('Enter');
  const details = page.locator('.city-card', { has: info }).locator('.dst-popover');
  await expect(details).toBeVisible();
  await expect(details).toContainText('November 1, 2026');
  await expect(details).toContainText('back 60 minutes');
  await expect(details).toContainText('UTC-04');
  await expect(details).toContainText('UTC-05');
  await page.getByRole('textbox', { name: 'Comparison date in New York' }).fill('2030-01-01');
  await expect(details).toContainText('November 1, 2026');
  await info.click();
  await expect(details).not.toBeVisible();
  await page.getByLabel('Daylight saving information for Bengaluru', { exact: true }).click();
  await expect(page.getByRole('article', { name: 'Bengaluru clock', exact: true })
    .getByText('No upcoming daylight saving or clock changes are scheduled for this city.')).toBeVisible();
});

test('recovers from corrupt and unavailable browser storage with an explicit notice', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('timeisvirtual.preferences.v1', '{broken'));
  await open(page);
  await expect(page.getByRole('status')).toContainText('Saved preferences could not be loaded');
  await expect(page.locator('.city-card')).toHaveCount(4);
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException('Storage blocked', 'SecurityError'); };
  });
  await page.reload();
  await expect(page.getByRole('status')).toContainText('could not save preferences');
  await page.getByRole('button', { name: '24 hr', exact: true }).click();
  await expect(page.getByTestId('clock-new-york')).toHaveText('09:00');
});

test('caps cities at eight and supports empty search results', async ({ page }) => {
  await open(page);
  for (const name of ['Paris', 'Sydney', 'Dubai', 'Singapore']) {
    await page.getByRole('combobox', { name: 'Search cities or time zones' }).fill(name);
    await page.getByRole('combobox', { name: 'Search cities or time zones' }).press('Enter');
  }
  await expect(page.locator('.city-card')).toHaveCount(8);
  await page.getByRole('combobox', { name: 'Search cities or time zones' }).fill('Kathmandu');
  await page.getByRole('combobox', { name: 'Search cities or time zones' }).press('Enter');
  await expect(page.getByRole('status')).toContainText('Eight cities is the limit');
  await expect(page.locator('.city-card')).toHaveCount(8);
  await page.getByRole('combobox', { name: 'Search cities or time zones' }).fill('not a real city');
  await expect(page.getByText('No cities found.', { exact: false })).toBeVisible();
  await page.getByRole('combobox', { name: 'Search cities or time zones' }).press('Escape');
  await expect(page.getByRole('listbox')).not.toBeVisible();
});

test('copy times includes all selected conversions', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await open(page);
  await page.getByRole('button', { name: 'Copy times', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Copied!', exact: true })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('New York: 09:00 AM');
  expect(copied).toContain('Bengaluru: 06:30 PM');
  expect(copied).toContain('Tokyo: 10:00 PM');
});

test('mobile and dark layouts fit the viewport, preserve scrolling, and show help', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'How it works' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('.timeline-scroll')).toBeVisible();
  const cell = await page.locator('.hour-cell.selected-cell').first().boundingBox();
  const label = await page.locator('.timeline-city').first().boundingBox();
  expect(cell!.x).toBeGreaterThanOrEqual(label!.x + label!.width - 1);
  await page.screenshot({ path: 'test-results/mobile-dark.png', fullPage: true });
});

test('desktop visual checkpoint', async ({ page }) => {
  await open(page);
  await expect(page.locator('.earth-sphere')).toHaveAttribute('data-ready', 'true');
  await page.screenshot({ path: 'test-results/desktop-light.png', fullPage: true });
});

test('comparison panel is compact without shrinking the clock text', async ({ page }) => {
  await open(page);
  const panel = await page.locator('.workspace').boundingBox();
  const card = await page.locator('.city-card').first().boundingBox();
  expect(panel!.height).toBeLessThanOrEqual(940);
  expect(card!.height).toBeLessThanOrEqual(180);
  expect(card!.width).toBeLessThanOrEqual(250);
  const clockSize = await page.getByTestId('clock-new-york').locator('span').evaluate(
    element => parseFloat(getComputedStyle(element).fontSize),
  );
  expect(clockSize).toBeGreaterThanOrEqual(30);
});

test('Wellington, London, and Chennai cards stay compact instead of stretching', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('timeisvirtual.preferences.v1', JSON.stringify({
    cityIds: ['wellington', 'london', 'chennai'], hour12: true, workHours: true, weather: false,
  })));
  await open(page);
  for (const city of ['Wellington', 'London', 'Chennai']) {
    const card = page.getByRole('article', { name: `${city} clock`, exact: true });
    const bounds = await card.boundingBox();
    expect(bounds!.height).toBeLessThanOrEqual(180);
    expect(bounds!.width).toBeLessThanOrEqual(250);
    await expect(card.locator('.digital-clock')).toBeVisible();
    await expect(card.locator('.country')).toBeVisible();
    await expect(card.getByLabel(`Daylight saving information for ${city}`, { exact: true })).toBeVisible();
  }
  await page.locator('.clock-grid').screenshot({ path: 'test-results/compact-city-cards.png' });
});

test('textured Earth rotates slowly and respects reduced motion and offscreen visibility', async ({ page }) => {
  await open(page);
  const canvas = page.locator('.earth-sphere');
  const snapshot = () => canvas.evaluate(element => {
    if (!(element instanceof HTMLCanvasElement)) throw new Error('Expected the Earth canvas.');
    return element.toDataURL();
  });
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  await expect(canvas).toHaveAttribute('data-motion', 'rotating');
  const first = await snapshot();
  await page.clock.runFor(5000);
  expect(await snapshot()).not.toBe(first);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(canvas).toHaveAttribute('data-motion', 'paused');
  const paused = await snapshot();
  await page.clock.runFor(5000);
  expect(await snapshot()).toBe(paused);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(canvas).toHaveAttribute('data-motion', 'rotating');
  await page.locator('.bottom-note').scrollIntoViewIfNeeded();
  await expect(canvas).toHaveAttribute('data-motion', 'paused');
  await page.locator('.hero').scrollIntoViewIfNeeded();
  await expect(canvas).toHaveAttribute('data-motion', 'rotating');
});

test('globe city labels change with rotation and speed changes persist without resetting the globe', async ({ page }) => {
  await open(page);
  const canvas = page.locator('.earth-sphere');
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.globe-city-label')).toHaveAttribute('data-city', 'Tokyo');
  const longitude = async () => Number(await canvas.getAttribute('data-longitude'));
  const start = await longitude();
  await page.clock.runFor(2000);
  const gentle = (await longitude()) - start;
  expect(gentle).toBeGreaterThan(5);
  expect(gentle).toBeLessThan(7);
  const beforeSpeedChange = await longitude();
  await page.getByLabel('Globe rotation speed', { exact: true }).selectOption('30');
  expect(await longitude()).toBeCloseTo(beforeSpeedChange, 1);
  await page.clock.runFor(2000);
  const fast = (await longitude()) - beforeSpeedChange;
  expect(fast).toBeGreaterThan(22);
  expect(fast).toBeLessThan(26);
  await expect(page.locator('.globe-city-label')).toHaveAttribute('data-city', 'Wellington');
  await page.reload();
  await expect(page.getByLabel('Globe rotation speed', { exact: true })).toHaveValue('30');
});

test('Pause stops rotation, hides city callouts, persists, and resumes at the same position', async ({ page }) => {
  await open(page);
  const canvas = page.locator('.earth-sphere');
  const speed = page.getByLabel('Globe rotation speed', { exact: true });
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.globe-city-label')).toBeVisible();
  await page.clock.runFor(1000);
  const position = await canvas.getAttribute('data-longitude');
  await speed.selectOption('0');
  await expect(canvas).toHaveAttribute('data-motion', 'paused');
  await expect(page.locator('.globe-city-label')).toHaveCount(0);
  await page.clock.runFor(5000);
  expect(await canvas.getAttribute('data-longitude')).toBe(position);
  await speed.selectOption('60');
  await expect(canvas).toHaveAttribute('data-motion', 'rotating');
  await expect(page.locator('.globe-city-label')).toBeVisible();
  expect(await canvas.getAttribute('data-longitude')).toBe(position);
  await page.clock.runFor(1000);
  expect(Number(await canvas.getAttribute('data-longitude'))).toBeGreaterThan(Number(position));
  await speed.selectOption('0');
  await page.reload();
  await expect(speed).toHaveValue('0');
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  await expect(canvas).toHaveAttribute('data-motion', 'paused');
  await expect(page.locator('.globe-city-label')).toHaveCount(0);
  const restored = await canvas.getAttribute('data-longitude');
  await page.clock.runFor(2000);
  expect(await canvas.getAttribute('data-longitude')).toBe(restored);
});

test('globe lighting and city time track real time even with motion paused', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  const canvas = page.locator('.earth-sphere');
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  const label = page.locator('.globe-city-label');
  await expect(label).toHaveAttribute('data-city', 'Tokyo');
  await expect(label).toHaveAttribute('data-daylight', 'night');
  await expect(label).toContainText('10:00 PM');
  const brightness = () => canvas.evaluate(element => {
    if (!(element instanceof HTMLCanvasElement)) throw new Error('Expected the Earth canvas.');
    const pixel = element.getContext('2d')!.getImageData(128, 128, 1, 1).data;
    return pixel[0] + pixel[1] + pixel[2];
  });
  const night = await brightness();
  const position = await canvas.getAttribute('data-longitude');
  await page.clock.setSystemTime(new Date('2026-03-08T01:00:00Z'));
  await page.clock.runFor(1000);
  await expect(label).toHaveAttribute('data-daylight', 'day');
  await expect(label).toContainText('10:00 AM');
  expect(await brightness()).toBeGreaterThan(night * 2);
  expect(await canvas.getAttribute('data-longitude')).toBe(position);
  await page.getByRole('textbox', { name: 'Comparison date in New York' }).fill('2030-01-01');
  await expect(label).toContainText('10:00 AM');
});

test('defaults to the light-blue palette even on a dark device', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const colors = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return { background: style.getPropertyValue('--cp-bg').trim(), accent: style.getPropertyValue('--cp-accent').trim() };
  });
  expect(colors).toEqual({ background: '#f3f8fc', accent: '#2479b8' });
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('the standalone HTML works offline without a server or runtime dependencies', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.setOffline(true);
  await page.goto(pathToFileURL(resolve('dist', 'index.html')).href);
  await expect(page.getByRole('heading', { name: 'World clocks' })).toBeVisible();
  await expect(page.locator('.earth-sphere')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('combobox', { name: 'Search cities or time zones' }).fill('Kathmandu');
  await page.getByRole('combobox', { name: 'Search cities or time zones' }).press('Enter');
  await expect(page.getByRole('heading', { name: 'Kathmandu', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Comparison date in New York' }).fill('2026-11-01');
  await expect(page.locator('.hour-header')).toHaveCount(25);
  expect(errors).toEqual([]);
});

test('finds an exact shared 9 AM to 5 PM hour or explains why none exists', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Find shared working hours' }).click();
  await expect(page.getByRole('status')).toContainText('No shared 9-to-5 hour');
  await page.getByRole('button', { name: 'Dismiss notification' }).click();
  await page.getByRole('button', { name: 'Remove Bengaluru', exact: true }).click();
  await page.getByRole('button', { name: 'Remove Tokyo', exact: true }).click();
  await page.getByRole('button', { name: 'Find shared working hours' }).click();
  await expect(page.getByText('A good time for everyone', { exact: false })).toBeVisible();
  await expect(page.getByTestId('clock-new-york')).toContainText('09:00');
  await expect(page.getByTestId('clock-london')).toContainText('01:00');
  await expect(page.getByRole('button', { name: 'Back to now' })).toBeVisible();
});
