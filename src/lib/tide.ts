import type { HourlyPoint, Spot } from "./types";

interface TideHeight {
  dt: number;
  height: number;
}

interface TidesFile {
  [spotId: string]: {
    fetchedAt: string;
    heights: TideHeight[];
  };
}

let tidesPromise: Promise<TidesFile> | null = null;

/** Loads the static, weekly-refreshed tides.json once and caches it — see scripts/fetch-tides.ts. */
function loadTides(): Promise<TidesFile> {
  if (!tidesPromise) {
    tidesPromise = fetch(`${import.meta.env.BASE_URL}tides.json`)
      .then((res) => (res.ok ? res.json() : {}))
      .catch(() => ({}));
  }
  return tidesPromise;
}

/**
 * Merges hourly tide heights (m) into forecast points, matching by nearest hour. Reads from a
 * static, pre-fetched file rather than calling WorldTides directly — every visitor hitting the
 * API on every spot click would burn through the (metered) credit budget in no time. No-ops for
 * spots without pre-fetched data (e.g. non-tidal spots, or before the first scheduled fetch runs).
 */
export async function attachTides(spot: Spot, points: HourlyPoint[]): Promise<HourlyPoint[]> {
  if (points.length === 0) return points;

  const tides = await loadTides();
  const entry = tides[spot.id];
  if (!entry) return points;

  const byHour = new Map<string, number>();
  for (const h of entry.heights) {
    const hourKey = new Date(h.dt * 1000).toISOString().slice(0, 13);
    byHour.set(hourKey, h.height);
  }
  return points.map((p) => {
    const hourKey = new Date(p.time).toISOString().slice(0, 13);
    return { ...p, tideHeightM: byHour.get(hourKey) ?? null };
  });
}
