import type { HourlyPoint, Spot } from "./types";

const WORLDTIDES_API_KEY = import.meta.env.VITE_WORLDTIDES_API_KEY as string | undefined;

export const TIDE_ENABLED = Boolean(WORLDTIDES_API_KEY);

interface WorldTidesResponse {
  heights: { dt: number; date: string; height: number }[];
}

/** Merges hourly tide heights (m) into forecast points, matching by nearest hour. Silently no-ops if no API key is configured. */
export async function attachTides(spot: Spot, points: HourlyPoint[]): Promise<HourlyPoint[]> {
  if (!TIDE_ENABLED || points.length === 0) return points;

  const start = Math.floor(new Date(points[0].time).getTime() / 1000);
  const length = points.length * 3600;

  const url =
    `https://www.worldtides.info/api/v3?heights&lat=${spot.lat}&lon=${spot.lon}` +
    `&start=${start}&length=${length}&key=${WORLDTIDES_API_KEY}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return points;
    const data = (await res.json()) as WorldTidesResponse;
    const byHour = new Map<string, number>();
    for (const h of data.heights) {
      const hourKey = new Date(h.dt * 1000).toISOString().slice(0, 13);
      byHour.set(hourKey, h.height);
    }
    return points.map((p) => {
      const hourKey = new Date(p.time).toISOString().slice(0, 13);
      return { ...p, tideHeightM: byHour.get(hourKey) ?? null };
    });
  } catch {
    return points;
  }
}
