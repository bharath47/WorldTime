import { describe, expect, it } from 'vitest';
import {
  changeDate, dateInZone, dayDifference, dayLength, difference, formatTime, nextClockChange, offsetLabel,
  shiftDate, timeline, timePeriod, zoned,
} from './time';

describe('DST-aware shared timeline', () => {
  it('has 24 shared instants on an ordinary day', () => {
    expect(timeline('2026-02-01', 'America/New_York')).toHaveLength(24);
  });

  describe('upcoming daylight saving information', () => {
    it('finds the exact next spring-forward instant and offsets', () => {
      expect(nextClockChange(Date.parse('2026-03-01T00:00:00Z'), 'America/New_York')).toEqual({
        instant: Date.parse('2026-03-08T07:00:00Z'), fromOffset: 'UTC-05', toOffset: 'UTC-04', minutes: 60,
      });
    });
    it('returns the following change once a transition has occurred', () => {
      expect(nextClockChange(Date.parse('2026-03-08T07:00:00Z'), 'America/New_York')).toEqual({
        instant: Date.parse('2026-11-01T06:00:00Z'), fromOffset: 'UTC-04', toOffset: 'UTC-05', minutes: -60,
      });
    });
    it('finds Wellington southern-hemisphere fall-back', () => {
      const change = nextClockChange(Date.parse('2026-03-08T13:00:00Z'), 'Pacific/Auckland');
      expect(change?.minutes).toBe(-60);
      expect(dateInZone(change!.instant, 'Pacific/Auckland')).toBe('2026-04-05');
    });
    it('handles half-hour clock changes', () => {
      expect(nextClockChange(Date.parse('2026-03-01T00:00:00Z'), 'Australia/Lord_Howe')?.minutes).toBe(-30);
    });
    it('reports no upcoming changes for Chennai or UTC', () => {
      const now = Date.parse('2026-03-01T00:00:00Z');
      expect(nextClockChange(now, 'Asia/Kolkata')).toBeNull();
      expect(nextClockChange(now, 'UTC')).toBeNull();
    });
  });
  it('skips the nonexistent spring hour', () => {
    const hours = timeline('2026-03-08', 'America/New_York');
    expect(hours).toHaveLength(23);
    expect(hours.map(hour => zoned(hour, 'America/New_York').hour)).not.toContain(2);
    expect(offsetLabel(hours[1], 'America/New_York')).toBe('UTC-05');
    expect(offsetLabel(hours[2], 'America/New_York')).toBe('UTC-04');
  });
  it('keeps both fall-back hours as distinct instants', () => {
    const hours = timeline('2026-11-01', 'America/New_York');
    expect(hours).toHaveLength(25);
    const repeated = hours.filter(hour => zoned(hour, 'America/New_York').hour === 1);
    expect(repeated).toHaveLength(2);
    expect(repeated[1] - repeated[0]).toBe(3600000);
    expect(repeated.map(hour => offsetLabel(hour, 'America/New_York'))).toEqual(['UTC-04', 'UTC-05']);
  });
  it('handles the different European DST transition date', () => {
    expect(timeline('2026-03-29', 'Europe/London')).toHaveLength(23);
    expect(timeline('2026-10-25', 'Europe/London')).toHaveLength(25);
  });
  it('handles southern-hemisphere DST', () => {
    expect(timeline('2026-04-05', 'Australia/Sydney')).toHaveLength(25);
    expect(timeline('2026-10-04', 'Australia/Sydney')).toHaveLength(23);
  });
  it('measures fractional-hour DST days without rounding their duration', () => {
    expect(dayLength('2026-04-05', 'Australia/Lord_Howe')).toBe(24.5);
    expect(dayLength('2026-10-04', 'Australia/Lord_Howe')).toBe(23.5);
    const hours = timeline('2026-10-04', 'Australia/Lord_Howe');
    expect(hours).toHaveLength(24);
    expect(zoned(hours.at(-1)!, 'Australia/Lord_Howe').minute).toBe(30);
  });
  it('uses actual date-specific offsets, including mismatched DST weeks', () => {
    const winter = Date.parse('2026-02-01T12:00:00Z');
    const gap = Date.parse('2026-03-15T12:00:00Z');
    expect(difference(winter, 'Europe/London', 'America/New_York')).toBe('+5h');
    expect(difference(gap, 'Europe/London', 'America/New_York')).toBe('+4h');
  });
});

describe('conversion and calendar behavior', () => {
  const instant = Date.parse('2026-01-15T18:00:00Z');
  it('converts half-hour and quarter-hour zones', () => {
    expect(formatTime(instant, 'Asia/Kolkata', false)).toBe('23:30');
    expect(formatTime(instant, 'Asia/Kathmandu', false)).toBe('23:45');
    expect(difference(instant, 'Asia/Kathmandu', 'UTC')).toBe('+5.75h');
  });
  it('converts the Chatham 45-minute offset with summer DST', () => {
    expect(formatTime(instant, 'Pacific/Chatham', false)).toBe('07:45');
    expect(offsetLabel(instant, 'Pacific/Chatham')).toBe('UTC+13:45');
  });
  it('shows 00:00, not 24:00, at midnight in 24-hour format', () => {
    expect(formatTime(Date.parse('2026-01-15T00:00:00Z'), 'UTC', false)).toBe('00:00');
  });
  it('formats AM and PM', () => {
    expect(formatTime(instant, 'America/New_York', true)).toBe('01:00 PM');
  });
  it('handles date rollover and the international date line', () => {
    expect(dateInZone(instant, 'Asia/Tokyo')).toBe('2026-01-16');
    expect(dayDifference(instant, 'Asia/Tokyo', 'America/New_York')).toBe(1);
    expect(dayDifference(instant, 'America/New_York', 'Asia/Tokyo')).toBe(-1);
    const dateLine = Date.parse('2026-01-15T10:30:00Z');
    expect(dayDifference(dateLine, 'Pacific/Kiritimati', 'Pacific/Honolulu')).toBe(1);
  });
  it('changes the home calendar date while preserving its wall time', () => {
    const next = changeDate(instant, '2026-07-15', 'America/New_York');
    expect(dateInZone(next, 'America/New_York')).toBe('2026-07-15');
    expect(formatTime(next, 'America/New_York', false)).toBe('13:00');
    expect(new Date(next).toISOString()).toBe('2026-07-15T17:00:00.000Z');
  });
  it('resolves a nonexistent date-selection time forward', () => {
    const before = Date.parse('2026-03-07T07:30:00Z');
    const next = changeDate(before, '2026-03-08', 'America/New_York');
    expect(formatTime(next, 'America/New_York', false)).toBe('03:30');
  });
  it('shifts across month, year, and leap-day boundaries', () => {
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDate('2028-02-28', 1)).toBe('2028-02-29');
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('defines work as 09:00 inclusive to 17:00 exclusive', () => {
    expect(timePeriod(Date.parse('2026-01-15T08:59:00Z'), 'UTC')).toBe('day');
    expect(timePeriod(Date.parse('2026-01-15T09:00:00Z'), 'UTC')).toBe('work');
    expect(timePeriod(Date.parse('2026-01-15T16:59:00Z'), 'UTC')).toBe('work');
    expect(timePeriod(Date.parse('2026-01-15T17:00:00Z'), 'UTC')).toBe('day');
    expect(timePeriod(Date.parse('2026-01-15T22:00:00Z'), 'UTC')).toBe('night');
  });
});
