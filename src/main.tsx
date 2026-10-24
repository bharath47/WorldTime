import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowRight, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Cloud,
  CloudRain, Copy, Globe2, House, Info, MapPin, Moon, Plus, Search,
  ShieldCheck, Snowflake, Sun, Sunrise, X,
} from 'lucide-react';
import { cities, searchCities, type City } from './cities';
import {
  changeDate, dateInZone, dayDifference, dayLength, difference, formatDate, formatTime,
  nextClockChange, offsetLabel, shiftDate, timeline, timePeriod, zoned, zoneName,
} from './time';
import { defaults, parseGlobeSpeed, parsePreferences, storageKey, type GlobeSpeed, type Preferences } from './preferences';
import { fetchHomeWeather, type Weather } from './weather';
import { RotatingEarth } from './RotatingEarth';
import './styles.css';

function loadPreferences(): { preferences: Preferences; notice: string } {
  try {
    return { preferences: parsePreferences(localStorage.getItem(storageKey)), notice: '' };
  } catch (error) {
    console.warn('Could not load TimeIsVirtual preferences:', error);
    return { preferences: defaults, notice: 'Saved preferences could not be loaded. You can still use every clock.' };
  }
}

function useWeather(enabled: boolean, attempt: number, home: City) {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [status, setStatus] = useState('');
  const [weatherCity, setWeatherCity] = useState('');
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const controller = new AbortController();
    setWeather(null);
    setWeatherCity(home.id);
    setStatus(`Finding the forecast for ${home.name}...`);
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    async function load() {
      try {
        const result = await fetchHomeWeather(home, controller.signal);
        if (!cancelled) {
          setWeather(result);
          setStatus('');
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('Optional weather is unavailable:', error);
          setWeather(null);
          setStatus(`Weather unavailable for ${home.name}. Your world clocks are right on time.`);
        }
      } finally {
        window.clearTimeout(timeout);
      }
    }
    void load();
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [enabled, attempt, home.id, home.name, home.zone]);
  return {
    weather: enabled && weatherCity === home.id ? weather : null,
    status: enabled && weatherCity === home.id ? status : '',
  };
}

function DaylightInfo({ city, now, hour12 }: { city: City; now: number; hour12: boolean }) {
  const minute = Math.floor(now / 60000);
  const change = useMemo(() => nextClockChange(minute * 60000, city.zone), [minute, city.zone]);
  return <details className="dst-info">
    <summary className="icon-button" aria-label={`Daylight saving information for ${city.name}`} title="Next daylight saving change"><Info size={14} /></summary>
    <div className="dst-popover">
      <strong>Daylight saving in {city.name}</strong>
      {change ? <>
        <span>Next clock change: {formatDate(change.instant, city.zone, true)}</span>
        <span>At {formatTime(change.instant, city.zone, hour12)} {zoneName(change.instant, city.zone)}, clocks move {change.minutes > 0 ? 'forward' : 'back'} {Math.abs(change.minutes)} minutes.</span>
        <span>{change.fromOffset} &rarr; {change.toOffset}</span>
      </> : <span>No upcoming daylight saving or clock changes are scheduled for this city.</span>}
      <small>From today, using current time-zone rules. Future rules may change.</small>
    </div>
  </details>;
}

function AnalogClock({ epoch, zone }: { epoch: number; zone: string }) {
  const time = zoned(epoch, zone);
  return <svg viewBox="0 0 64 64" className={`analog ${timePeriod(epoch, zone)}`} aria-hidden="true">
    <circle cx="32" cy="32" r="28" className="clock-face" />
    {[0, 90, 180, 270].map(angle => <path key={angle} d="M32 8v4" transform={`rotate(${angle} 32 32)`} />)}
    <path d="M32 32V19" transform={`rotate(${time.hour * 30 + time.minute / 2} 32 32)`} className="hour-hand" />
    <path d="M32 32V12" transform={`rotate(${time.minute * 6} 32 32)`} className="minute-hand" />
    <circle cx="32" cy="32" r="2" className="clock-pin" />
  </svg>;
}

function WorldIllustration({ now, speed, hour12, onSpeedChange }: {
  now: number; speed: GlobeSpeed; hour12: boolean; onSpeedChange: (speed: GlobeSpeed) => void;
}) {
  return <div className="world-art" role="group" aria-label="Live Earth globe">
    <div className="orbit orbit-one" aria-hidden="true" /><div className="orbit orbit-two" aria-hidden="true" />
    <RotatingEarth now={now} speed={speed} hour12={hour12} />
    <span className="globe-caption">One world. Your time.</span>
    <label className="globe-speed"><Clock3 size={12} /><span>Rotation</span>
      <select aria-label="Globe rotation speed" value={speed} onChange={event => onSpeedChange(parseGlobeSpeed(Number(event.target.value)))}>
        <option value={0}>Pause</option>
        <option value={180}>Slow (3 min)</option><option value={120}>Gentle (2 min)</option>
        <option value={60}>Normal (1 min)</option><option value={30}>Fast (30 sec)</option>
      </select>
    </label>
  </div>;
}

function App() {
  const [initial] = useState(loadPreferences);
  const [preferences, setPreferences] = useState(initial.preferences);
  const [notice, setNotice] = useState(initial.notice);
  const [now, setNow] = useState(Date.now);
  const [selected, setSelected] = useState(Date.now);
  const [live, setLive] = useState(true);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeResult, setActiveResult] = useState(0);
  const [weatherAttempt, setWeatherAttempt] = useState(0);
  const [copied, setCopied] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'light');
  const help = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const timelineViewport = useRef<HTMLDivElement>(null);
  const selectedCities = preferences.cityIds.map(id => cities.find(city => city.id === id)!);
  const home = selectedCities[0];
  const { weather, status: weatherStatus } = useWeather(preferences.weather, weatherAttempt, home);
  const epoch = live ? now : selected;
  const date = dateInZone(epoch, home.zone);
  const hours = useMemo(() => timeline(date, home.zone), [date, home.zone]);
  const hoursInDay = useMemo(() => dayLength(date, home.zone), [date, home.zone]);
  const results = useMemo(() => searchCities(query, preferences.cityIds), [query, preferences.cityIds]);
  const selectedIndex = hours.findIndex((hour, index) => epoch >= hour && epoch < (hours[index + 1] ?? hour + 3600000));
  const allWorking = selectedCities.every(city => timePeriod(epoch, city.zone) === 'work');
  const WeatherIcon = weather?.style === 'rainy' ? CloudRain : weather?.style === 'snowy' ? Snowflake
    : weather?.style === 'cloudy' ? Cloud : Sun;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    const refresh = () => setNow(Date.now());
    document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(preferences));
      setSaveFailed(false);
    }
    catch (error) {
      console.warn('Could not save TimeIsVirtual preferences:', error);
      setSaveFailed(true);
      setNotice('Your browser could not save preferences. Changes will last for this visit only.');
    }
  }, [preferences]);

  useEffect(() => {
    const viewport = timelineViewport.current;
    if (viewport) viewport.scrollTo({
      left: selectedIndex * 48 + 24 - (viewport.clientWidth - 180) / 2,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  }, [date, selectedIndex]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2400);
    return () => window.clearTimeout(timer);
  }, [copied]);

  function update(patch: Partial<Preferences>) {
    setPreferences(current => ({ ...current, ...patch }));
  }
  function addCity(city: City) {
    if (preferences.cityIds.length >= 8) {
      setNotice('Eight cities is the limit. Remove a city to make room for another.');
      return;
    }
    update({ cityIds: [...preferences.cityIds, city.id] });
    setQuery('');
    setSearchOpen(false);
    setActiveResult(0);
  }
  function selectDate(value: string) {
    if (!value) return;
    try {
      if (value < '1900-01-01' || value > '2100-12-31') throw new Error('Date is outside the supported range.');
      const next = changeDate(epoch, value, home.zone);
      setSelected(next);
      setLive(false);
    } catch (error) {
      console.warn('Could not select date:', error);
      setNotice('That date is not supported. Please choose another date.');
    }
  }
  function goLive() {
    setNow(Date.now());
    setLive(true);
  }
  function setHome(id: string) {
    update({ cityIds: [id, ...preferences.cityIds.filter(cityId => cityId !== id)] });
  }
  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    const url = new URL(window.location.href);
    url.searchParams.set('scoutTheme', next);
    window.history.replaceState(null, '', url);
  }
  async function copyTimes() {
    const summary = selectedCities.map(city =>
      `${city.name}: ${formatTime(epoch, city.zone, preferences.hour12)} | ${formatDate(epoch, city.zone, true)} (${offsetLabel(epoch, city.zone)})`).join('\n');
    try {
      await navigator.clipboard.writeText(`TimeIsVirtual\n${summary}`);
      setCopied(true);
    } catch (error) {
      console.warn('Could not copy comparison:', error);
      setNotice('Clipboard access is unavailable. You can select and copy the times on screen.');
    }
  }
  function findOverlap() {
    const match = hours.find(hour => selectedCities.every(city => timePeriod(hour, city.zone) === 'work'));
    if (match !== undefined) { setSelected(match); setLive(false); }
    else setNotice('No shared 9-to-5 hour on this date. Try another date or choose a compromise on the timeline.');
  }

  return <div className="app-shell">
    <header className="site-header">
      <a className="brand" href="./" aria-label="TimeIsVirtual home"><span className="brand-icon"><Globe2 size={22} /></span>
        <span>TimeIs<span className="brand-accent">Virtual</span><span className="brand-tag">A WORLD OF POSSIBILITIES</span></span>
      </a>
      <nav aria-label="Main navigation">
        <span className="nav-current"><Clock3 size={15} /> World clock</span>
        <button className="nav-link" onClick={() => help.current?.showModal()}>How it works <ArrowRight size={14} /></button>
      </nav>
      <button className="icon-button theme-toggle" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={toggleTheme}>
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </header>

    <main>
      <section className={`hero weather-${weather?.style ?? 'neutral'}`} aria-labelledby="hero-title">
        <div className="hero-content">
          <div className="greeting"><WeatherIcon size={18} /><span>{weather ? `${home.name}: ${weather.description}, ${weather.temperature}\u00b0C` : 'Good day!'}</span>
            {preferences.weather && <button className="icon-button weather-disable" aria-label="Turn off weather" title="Turn off weather" onClick={() => update({ weather: false })}><X size={12} /></button>}
            <span className="greeting-divider" /><span className="hero-eyebrow">MAKE TIME FOR WHAT MATTERS</span>
          </div>
          <h1 id="hero-title">Different places.<br /><span>A little time in common.</span></h1>
          <p>A world clock for your world. Find the right moment to<br className="desktop-break" /> connect, wherever life takes you.</p>
          {(!preferences.weather || !weather) && <div className="weather-settings">
            {preferences.weather
              ? <span className="weather-status" role="status">{weatherStatus}
                {!weather && weatherStatus.startsWith('Weather unavailable') &&
                  <button onClick={() => setWeatherAttempt(value => value + 1)}>Retry</button>}
              </span>
              : <><button className="weather-button" aria-pressed={false} onClick={() => update({ weather: true })}>
                <House size={14} />Enable home weather
              </button><span className="weather-privacy">Weather for your home base. No device location needed.</span></>}
          </div>}
        </div>
        <WorldIllustration now={now} speed={preferences.globeSpeed} hour12={preferences.hour12}
          onSpeedChange={globeSpeed => update({ globeSpeed })} />
      </section>

      <section className="workspace" aria-label="Time zone comparison">
        <div className="workspace-toolbar">
          <div><span className="section-eyebrow">YOUR WORLD, AT A GLANCE</span>
            <h2>World clocks <span className="count-badge">{selectedCities.length}</span></h2>
          </div>
          <div className="toolbar-actions">
            <span className="save-label"><Check size={14} />{saveFailed ? 'Preferences not saved' : 'Preferences autosaved'}</span>
            <div className="segmented" aria-label="Time format">
              <button aria-pressed={preferences.hour12} onClick={() => update({ hour12: true })}>12 hr</button>
              <button aria-pressed={!preferences.hour12} onClick={() => update({ hour12: false })}>24 hr</button>
            </div>
          </div>
        </div>

        {notice && <div className="notice" role="status"><span>{notice}</span>
          <button className="icon-button" aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={16} /></button></div>}

        <div className="search-wrapper" onBlur={event => {
          if (!event.currentTarget.contains(event.relatedTarget)) setSearchOpen(false);
        }}>
          <Search size={18} />
          <input ref={search} role="combobox" aria-label="Search cities or time zones"
            aria-expanded={searchOpen} aria-controls="city-results" aria-autocomplete="list"
            aria-activedescendant={searchOpen && results.length ? `city-result-${activeResult}` : undefined}
            placeholder="Where in the world? Search a city or time zone..."
            value={query} onFocus={() => setSearchOpen(true)}
            onChange={event => { setQuery(event.target.value); setSearchOpen(true); setActiveResult(0); }}
            onKeyDown={event => {
              if (event.key === 'Escape') { setSearchOpen(false); return; }
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                setSearchOpen(true);
                setActiveResult(index => results.length ? (index + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length : 0);
              }
              if (event.key === 'Enter' && searchOpen && results[activeResult]) {
                event.preventDefault(); addCity(results[activeResult]);
              }
            }} />
          <span className="city-limit">{selectedCities.length}/8 cities</span>
          {query && <button className="icon-button" aria-label="Clear search" onClick={() => { setQuery(''); search.current?.focus(); }}><X size={16} /></button>}
          {searchOpen && <div className="search-results" role="listbox" id="city-results" aria-label="Matching cities">
            <div className="results-title">{query ? 'MATCHING PLACES' : 'EXPLORE MORE PLACES'}</div>
            {results.length ? results.map((city, index) =>
              <button key={city.id} id={`city-result-${index}`} role="option" aria-selected={index === activeResult}
                onMouseEnter={() => setActiveResult(index)} onClick={() => addCity(city)}>
                <MapPin size={17} /><span><strong>{city.name}</strong><small>{city.country} &middot; {city.zone}</small></span><Plus size={17} />
              </button>) : <p>No cities found. Try a country or an IANA zone such as Asia/Tokyo.</p>}
          </div>}
        </div>

        <div className="clock-grid">
          {selectedCities.map((city, index) => {
            const period = timePeriod(epoch, city.zone);
            const delta = dayDifference(epoch, city.zone, home.zone);
            const clock = formatTime(epoch, city.zone, preferences.hour12);
            const [digits, meridiem] = clock.split(' ');
            return <article className={`city-card ${index === 0 ? 'home-card' : ''}`} key={city.id} aria-label={`${city.name} clock`}>
              <div className="card-top"><span className={`location-marker ${index === 0 ? 'is-home' : ''}`}>
                {index === 0 ? <House size={12} /> : <MapPin size={12} />}{index === 0 ? 'HOME BASE' : difference(epoch, city.zone, home.zone)}
              </span>
                <div className="card-actions">
                  {index !== 0 && <button className="icon-button" title={`Make ${city.name} home base`} aria-label={`Make ${city.name} home base`} onClick={() => setHome(city.id)}><House size={14} /></button>}
                  <button className="icon-button" disabled={selectedCities.length === 1} aria-label={`Remove ${city.name}`} title="Remove city"
                    onClick={() => update({ cityIds: preferences.cityIds.filter(id => id !== city.id) })}><X size={14} /></button>
                </div>
              </div>
              <div className="city-heading"><h3>{city.name}</h3><DaylightInfo city={city} now={now} hour12={preferences.hour12} /></div><p className="country">{city.country}</p>
              <div className="clock-display"><div className="digital-clock" data-testid={`clock-${city.id}`}>
                <span>{digits}</span>{meridiem && <small>{meridiem}</small>}
              </div><AnalogClock epoch={epoch} zone={city.zone} /></div>
              <div className="card-date">{formatDate(epoch, city.zone)}{delta !== 0 && <span className="day-badge">{delta > 0 ? '+' : ''}{delta} day</span>}</div>
              <div className="card-bottom"><span>{zoneName(epoch, city.zone)} <span className="offset">{offsetLabel(epoch, city.zone)}</span></span>
                <span className={`period-label ${period}`}>{period === 'night' ? <Moon size={12} /> : <Sun size={12} />}{period === 'work' ? 'Working hours' : period === 'night' ? 'After hours' : 'Daytime'}</span>
              </div>
            </article>;
          })}
          <button className="add-city-card" onClick={() => { search.current?.focus(); setSearchOpen(true); }} hidden={selectedCities.length >= 8}>
            <span><Plus size={20} /></span>Add another city<small>Bring your world together</small>
          </button>
        </div>

        <section className="timeline-section" aria-labelledby="timeline-heading">
          <div className="timeline-toolbar">
            <div><h2 id="timeline-heading">Find your moment</h2><p>One timeline. Every time zone.</p></div>
            <div className="date-actions">
              <button className={`now-button ${live ? 'is-live' : ''}`} onClick={goLive}><span className="live-dot" />{live ? 'Live' : 'Back to now'}</button>
              <div className="date-picker">
                <button className="icon-button" aria-label="Previous day" disabled={date <= '1900-01-01'} onClick={() => selectDate(shiftDate(date, -1))}><ChevronLeft size={17} /></button>
                <label><CalendarDays size={15} /><span className="sr-only">Comparison date in {home.name}</span>
                  <input type="date" aria-label={`Comparison date in ${home.name}`} value={date} min="1900-01-01" max="2100-12-31" onChange={event => selectDate(event.target.value)} />
                </label>
                <button className="icon-button" aria-label="Next day" disabled={date >= '2100-12-31'} onClick={() => selectDate(shiftDate(date, 1))}><ChevronRight size={17} /></button>
              </div>
            </div>
          </div>
          <div className="timeline-options"><span><span className="tiny-dot" /> Click any hour to compare</span>
            <label className="toggle-label"><input type="checkbox" checked={preferences.workHours} onChange={event => update({ workHours: event.target.checked })} />
              <span className="switch" />Highlight working hours <span className="work-range">9 AM - 5 PM</span></label>
          </div>
          <div ref={timelineViewport} className={`timeline-scroll ${preferences.workHours ? 'highlight-work' : ''}`}>
            <div className="timeline-grid" style={{ gridTemplateColumns: `180px repeat(${hours.length}, 48px)` }}>
              <div className="timeline-corner"><Globe2 size={14} />{home.name} day</div>
              {hours.map((hour, index) => <div key={hour} className={`hour-header ${index === selectedIndex ? 'selected-header' : ''}`}>
                {zoned(hour, home.zone).hour.toString().padStart(2, '0')}
                <small>{index === selectedIndex ? <span className="header-dot" /> : zoneName(hour, home.zone)}</small>
              </div>)}
              {selectedCities.map((city, row) => <React.Fragment key={city.id}>
                <div className="timeline-city"><span>{city.name}{row === 0 && <House size={11} />}</span><small>{zoneName(epoch, city.zone)} &middot; {difference(epoch, city.zone, home.zone)}</small></div>
                {hours.map((hour, index) => {
                  const time = zoned(hour, city.zone);
                  const displayHour = preferences.hour12 ? time.hour % 12 || 12 : time.hour.toString().padStart(2, '0');
                  const minute = time.minute ? `:${time.minute.toString().padStart(2, '0')}` : '';
                  const delta = dayDifference(hour, city.zone, home.zone);
                  const isSelected = index === selectedIndex;
                  return <button key={hour}
                    className={`hour-cell ${timePeriod(hour, city.zone)} ${isSelected ? 'selected-cell' : ''}`}
                    aria-label={`${city.name}, ${formatDate(hour, city.zone)}, ${formatTime(hour, city.zone, preferences.hour12)}, ${offsetLabel(hour, city.zone)}`}
                    aria-pressed={isSelected} onClick={() => { setSelected(hour); setLive(false); }}>
                    <span>{displayHour}{minute}</span>
                    <small>{time.hour === 0 ? `${time.month}/${time.day}` : delta ? `${delta > 0 ? '+' : ''}${delta}d` : preferences.hour12 ? time.hour >= 12 ? 'pm' : 'am' : '\u00b7'}</small>
                  </button>;
                })}
              </React.Fragment>)}
            </div>
          </div>
          <div className="timeline-footnote"><div className="legend"><span><i className="legend-work" />Working hours</span><span><i className="legend-day" />Daytime</span><span><i className="legend-night" />Nighttime</span></div>
            <span><ShieldCheck size={13} /> DST handled automatically{hoursInDay !== 24 ? ` \u00b7 ${hoursInDay}-hour day` : ''}</span>
          </div>
        </section>

        <div className="selection-bar">
          <div className="selection-icon"><Clock3 size={21} /></div>
          <div className="selection-description"><span>{live ? 'RIGHT NOW IN YOUR HOME BASE' : 'YOUR SELECTED MOMENT'}</span>
            <strong>{formatTime(epoch, home.zone, preferences.hour12)} <span>in {home.name}</span></strong>
            <small>{formatDate(epoch, home.zone, true)} &middot; {zoneName(epoch, home.zone)}</small>
          </div>
          <div className={`overlap-status ${allWorking ? 'shared' : ''}`}><span className="tiny-dot" />
            {allWorking ? 'A good time for everyone' : 'A whole world, different rhythms'}
            <button onClick={findOverlap}>Find shared working hours <ArrowRight size={12} /></button>
          </div>
          <button className="copy-button" onClick={() => void copyTimes()}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? 'Copied!' : 'Copy times'}</button>
        </div>
      </section>

      <aside className="bottom-note"><span className="note-icon"><Sunrise size={22} /></span><div><strong>Distance is a detail. Timing is everything.</strong>
        <p>For the early birds, the night owls, and everyone making it work across time zones.</p></div><Globe2 className="note-globe" size={34} /></aside>
    </main>
    <footer><span className="footer-brand"><Globe2 size={15} /> TimeIsVirtual <span>&middot; A little closer, one time zone at a time.</span></span>
      <span className="footer-privacy"><ShieldCheck size={13} /> Saved on your device. No account needed.</span>
      {weather && <span className="weather-attribution">Weather data by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> &middot; <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a></span>}
    </footer>
    <dialog ref={help} className="help-dialog" onClick={event => { if (event.target === event.currentTarget) help.current?.close(); }}>
      <div className="dialog-heading"><span className="brand-icon"><Globe2 size={23} /></span><button className="icon-button" aria-label="Close help" onClick={() => help.current?.close()}><X size={20} /></button></div>
      <span className="section-eyebrow">LESS MATH. MORE CONNECTION.</span><h2>A little time in common.</h2>
      <ol><li><strong>Build your world.</strong> Search a city, country, or IANA time zone. Add up to eight cities.</li>
        <li><strong>Choose your home base.</strong> Use a city's house button. Dates and the timeline follow that city's calendar.</li>
        <li><strong>Find your moment.</strong> Pick a date or any hour. Every row represents the same instant, including daylight saving changes and half-hour offsets.</li>
        <li><strong>Make it yours.</strong> Your city order, clock format, working-hour highlighting, and weather choice are saved on this device.</li></ol>
      <p>Working hours mean 9 AM to 5 PM local time, every day, not a holiday or availability calendar. Repeated DST hours are separate columns with their actual UTC offsets in the accessible labels.</p>
      <p>Select the info icon beside a city for its next daylight saving or clock change, measured from today rather than the comparison date.</p>
      <p>Weather is optional and follows your home base. Enabling it sends that city's name to Open-Meteo to look up its forecast. It never requests device location. Coordinates are not saved. If it fails, your clocks keep working.</p>
      <button className="primary-button" onClick={() => help.current?.close()}>Let's find a moment <ArrowRight size={16} /></button>
    </dialog>
  </div>;
}

createRoot(document.getElementById('root')!).render(<App />);
