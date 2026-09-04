/**
 * Open-Meteo returns timezone-naive local timestamps (e.g. "2026-08-30T18:00") for whichever
 * spot timezone was requested. `new Date(...)` on those strings is parsed in the *browser's*
 * timezone, not the spot's, so comparing them against `Date.now()` is wrong whenever a viewer
 * isn't in the same timezone as the spot. This renders "now" as the same naive-string format,
 * in the spot's own timezone, so it can be compared lexicographically instead.
 */
export function zoneNowKey(timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Same as `zoneNowKey`, truncated to the start of the current hour (so the in-progress hour still counts as "now"). */
export function zoneCurrentHourKey(timezone: string): string {
  return zoneNowKey(timezone).slice(0, 13) + ":00";
}

/** Minutes since local midnight, read directly off a naive "...T HH:mm" string (no Date parsing, no timezone assumption). */
export function minutesSinceMidnightFromNaive(naiveTime: string): number {
  const hh = Number(naiveTime.slice(11, 13));
  const mm = Number(naiveTime.slice(14, 16));
  return hh * 60 + mm;
}

/** Minutes since midnight *in `timezone`*, for a real instant (e.g. a Date from a database row). */
export function minutesSinceMidnightInZone(instant: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return get("hour") * 60 + get("minute");
}
