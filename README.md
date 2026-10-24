---
title: TimeIsVirtual
description: A static, privacy-conscious world clock with searchable cities, a shared DST-aware timeline, saved preferences, and optional local weather.
---

# TimeIsVirtual

A little time in common. Compare up to eight cities, follow live clocks, and
choose a shared moment without doing time-zone math.
Compact city cards retain readable clock text and do not stretch to fill
unused desktop space.

## Run locally

Use Node.js 22.12 or newer.

```powershell
npm ci
npm run dev
```

Open the local URL printed by Vite.

## Build and host

```powershell
npm run build
npm run preview
```

The build produces a self-contained `dist/index.html` with inlined CSS and
JavaScript. Deploy that file to any static host. No backend, API key, account,
external font, or runtime CDN is required. Use HTTPS (or localhost) for
clipboard access. Weather requires internet access, but never device location.

## Use the comparison

* Search by city, country, common alias such as Bangalore, or IANA time zone.
  Search works offline using curated cities and the browser's supported zones.
  Additional IANA results show their geographic region rather than country.
* Use a city's house button to make it the home base. The first city defines
  the timeline's calendar date. Changing home base preserves the shared instant.
* Select a date or click any hour to pause live mode. All clocks then show that
  exact instant. Select **Back to now** to resume live clocks.
* Choose 12-hour or 24-hour clocks. City order, format, working-hour
  highlighting, weather opt-in, and globe speed are saved in local storage.
* Working hours are 09:00 inclusive to 17:00 exclusive in each city, every day.
  They do not account for weekends, holidays, or personal availability.
* Use **Copy times** to copy the date, local time, and UTC offset for each city.
* Select the info icon beside a city to see its next daylight saving or clock
  change, the local date and time, the direction, and the old and new offsets.
  This is measured from today, independent of the comparison date. Cities
  without a scheduled change show an explanatory note. Future government
  decisions may change the browser's current time-zone rules.

## Time-zone correctness

The app uses the Temporal polyfill with the browser's IANA time-zone data, not
fixed UTC offsets. A timeline column is an actual shared instant.
Spring-forward days have 23 hours and fall-back days have 25 hours in zones
with one-hour DST shifts. Both repeated hours are selectable and distinguished
by UTC offset in their accessible labels. Half-hour and quarter-hour offsets
are preserved. Zones with fractional-hour DST transitions use elapsed-hour
columns, including a shorter final interval when necessary.

Date selection preserves the home city's wall time. If that time does not
exist during a spring-forward transition, Temporal's compatible
disambiguation moves it forward. For a repeated time, it chooses the earlier
occurrence. Dates from 1900 through 2100 are supported. Historical and future
rules depend on the host browser's time-zone database.

## Optional weather and privacy

Weather is off by default. Select **Enable home weather** to show the home-base
city's current forecast. The city name is sent to
[Open-Meteo](https://open-meteo.com/)'s geocoding service. A result matching the
city's time zone supplies coordinates for current Celsius temperature and
WMO conditions. Device location permission is never requested. Coordinates
and weather responses are not saved. The opt-in setting is saved, so an
enabled header refreshes on the next visit and whenever the home base changes.
Current conditions appear once in the greeting, for example
**Wellington: A little cloudy, 16°C**. Use its close icon to cancel pending
requests and turn weather off. Loading and error messages appear only when
needed, without a duplicate weather label.

The header uses subtle condition-based styling. Missing city matches,
HTTP errors, incomplete data, and timeouts all fall back to
**Good day!** with an explanatory status and retry option. Time-zone features
never depend on weather. The combined city lookup and forecast requests are
bounded by a 12-second timeout. Current weather does not follow a selected
historical or future comparison date.

Weather attribution links to Open-Meteo and
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) appear when data is
shown. There are no analytics or TimeIsVirtual servers.

The app defaults to a light-blue theme. Use the theme button for a matching
dark-blue palette, or set the `scoutTheme=light` / `scoutTheme=dark` URL
parameter. The theme button updates that parameter.
Storage errors show a notice and leave the app usable for the current visit.

## Globe illustration

The globe uses NASA's public-domain
[Blue Marble land, ocean, and ice texture](https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57730/land_ocean_ice_2048.jpg),
bundled locally and projected onto a shaded sphere. Key cities, including
Wellington and Chennai, appear as they approach the central meridian, with
their actual local time and daylight status. Labels disappear when no key
city is near the centre; they are not fixed decorative location tags.

Use **Rotation** below the globe to choose a 30-second, one-minute, two-minute,
or three-minute rotation. The choice is saved on this device, and changing
speed preserves the globe's current orientation. Choose **Pause** to stop
rotation and hide city callouts. Select a speed to resume from the same
position. The paused setting is also saved.

Day and night shading uses an approximate solar position based on the current
UTC date/time, seasonal declination, and equation of time, following
[NOAA's solar equations](https://gml.noaa.gov/grad/solcalc/solareqns.PDF).
The daylight boundary stays tied to geographic locations, not camera rotation.
Lighting and city times follow real time, not the comparison date. These are
visual indicators, not precise sunrise/sunset predictions.

Canvas animation, rather than a GIF, keeps the image sharp and allows it to
pause when offscreen, when the tab is hidden, or when you prefer reduced
motion. Lighting still refreshes each minute when rotation is paused.
No image request to NASA is made at runtime.

## Test

```powershell
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Unit tests cover DST transitions in both hemispheres, date rollovers,
fractional-hour offsets, city search, preference validation, and weather
response handling. Playwright tests run against the production build and
cover live ticks, keyboard search, preferences, shared timeline selection,
weather success and failures, clipboard access, and mobile/dark layouts.
Weather and city lookups are mocked in browser tests; no personal coordinates
or external API calls are needed.
