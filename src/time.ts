import { Temporal } from '@js-temporal/polyfill';

export function zoned(epoch: number, zone: string) {
  return Temporal.Instant.fromEpochMilliseconds(epoch).toZonedDateTimeISO(zone);
}

export function dateInZone(epoch: number, zone: string): string {
  return zoned(epoch, zone).toPlainDate().toString();
}

export function timeline(date: string, zone: string): number[] {
  const day = Temporal.PlainDate.from(date);
  const start = day.toZonedDateTime(zone);
  const end = day.add({ days: 1 }).toZonedDateTime(zone);
  const hours: number[] = [];
  for (let instant = start; instant.epochMilliseconds < end.epochMilliseconds; instant = instant.add({ hours: 1 })) {
    hours.push(instant.epochMilliseconds);
  }
  return hours;
}

export function dayLength(date: string, zone: string): number {
  const day = Temporal.PlainDate.from(date);
  return (day.add({ days: 1 }).toZonedDateTime(zone).epochMilliseconds -
    day.toZonedDateTime(zone).epochMilliseconds) / 3600000;
}

export function changeDate(epoch: number, date: string, zone: string): number {
  return Temporal.PlainDate.from(date).toZonedDateTime({
    timeZone: zone,
    plainTime: zoned(epoch, zone).toPlainTime(),
  }).epochMilliseconds;
}

export function shiftDate(date: string, days: number): string {
  return Temporal.PlainDate.from(date).add({ days }).toString();
}

export function formatTime(epoch: number, zone: string, hour12: boolean, seconds = false): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: zone, hour: '2-digit', minute: '2-digit',
    ...(seconds ? { second: '2-digit' as const } : {}),
    ...(hour12 ? { hour12: true } : { hourCycle: 'h23' as const }),
  }).format(epoch);
}

export function formatDate(epoch: number, zone: string, long = false): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: zone, weekday: long ? 'long' : 'short',
    month: long ? 'long' : 'short', day: 'numeric',
    ...(long ? { year: 'numeric' as const } : {}),
  }).format(epoch);
}

export function zoneName(epoch: number, zone: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'short' })
    .formatToParts(epoch).find(part => part.type === 'timeZoneName')!.value;
}

export function offsetLabel(epoch: number, zone: string): string {
  const offset = zoned(epoch, zone).offset;
  return offset === '+00:00' ? 'UTC' : `UTC${offset.replace(':00', '')}`;
}

export function difference(epoch: number, zone: string, home: string): string {
  const minutes = (zoned(epoch, zone).offsetNanoseconds - zoned(epoch, home).offsetNanoseconds) / 60e9;
  if (minutes === 0) return 'Same time';
  const hours = Math.abs(minutes) / 60;
  return `${minutes > 0 ? '+' : '-'}${Number(hours.toFixed(2))}h`;
}

export function dayDifference(epoch: number, zone: string, home: string): number {
  return zoned(epoch, home).toPlainDate().until(zoned(epoch, zone).toPlainDate()).days;
}

export function timePeriod(epoch: number, zone: string): 'work' | 'day' | 'night' {
  const hour = zoned(epoch, zone).hour;
  return hour >= 9 && hour < 17 ? 'work' : hour >= 7 && hour < 22 ? 'day' : 'night';
}

export function nextClockChange(epoch: number, zone: string) {
  const next = zoned(epoch, zone).getTimeZoneTransition('next');
  if (!next) return null;
  const instant = next.epochMilliseconds;
  return {
    instant,
    fromOffset: offsetLabel(instant - 1, zone),
    toOffset: offsetLabel(instant, zone),
    minutes: (next.offsetNanoseconds - zoned(instant - 1, zone).offsetNanoseconds) / 60e9,
  };
}
