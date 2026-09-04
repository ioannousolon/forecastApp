import { getTimes } from "suncalc";
import type { Spot } from "./types";

/** Solar noon → sunset window for a spot, on the given day (defaults to now). */
export function middayToSunset(spot: Spot, date: Date = new Date()): { start: Date; end: Date } {
  const times = getTimes(date, spot.lat, spot.lon);
  // sunset is null at extreme latitudes during polar day/night (the sun never sets that day) —
  // none of our spots are anywhere near that, but fall back sensibly rather than assume non-null.
  const end = times.sunset ?? new Date(times.solarNoon.getTime() + 12 * 3_600_000);
  return { start: times.solarNoon, end };
}

export function isWithinMiddayToSunset(spot: Spot, date: Date = new Date()): boolean {
  const { start, end } = middayToSunset(spot, date);
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
}
