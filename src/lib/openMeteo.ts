import type { HourlyPoint, LiveReading, Spot } from "./types";

export interface ForecastModel {
  id: string;
  label: string;
  blurb: string;
}

export const FORECAST_MODELS: ForecastModel[] = [
  { id: "best_match", label: "Best Match", blurb: "Open-Meteo's automatic pick of the best available model for this location." },
  { id: "ecmwf_ifs025", label: "ECMWF", blurb: "The European Centre's global model — widely regarded as the strongest all-round forecaster." },
  { id: "gfs_seamless", label: "GFS", blurb: "NOAA's Global Forecast System (USA)." },
  { id: "icon_seamless", label: "ICON", blurb: "Germany's DWD global/regional blend." },
  { id: "ukmo_seamless", label: "UKMO", blurb: "The UK Met Office's global model." },
  { id: "meteofrance_seamless", label: "Météo-France", blurb: "France's ARPEGE global model." },
];

export type ModelId = (typeof FORECAST_MODELS)[number]["id"];

interface MarineHourly {
  time: string[];
  wave_height: (number | null)[];
  wave_period: (number | null)[];
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}): ${url}`);
  }
  return res.json() as Promise<T>;
}

export interface ForecastBundle {
  timezone: string;
  points: HourlyPoint[];
}

export interface MultiModelForecastBundle {
  timezone: string;
  byModel: Record<ModelId, HourlyPoint[]>;
}

/** Max forecast_days accepted by Open-Meteo (verified live — 20 is rejected, 16 is the real ceiling). */
export const MAX_FORECAST_DAYS = 16;

/** Fetches every model in `FORECAST_MODELS` in a single request (Open-Meteo supports comma-separated `models=`). */
export async function fetchHourlyForecast(spot: Spot, days: number): Promise<MultiModelForecastBundle> {
  const modelIds = FORECAST_MODELS.map((m) => m.id).join(",");
  const windUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${spot.lat}&longitude=${spot.lon}` +
    `&hourly=windspeed_10m,windgusts_10m,winddirection_10m&windspeed_unit=kn&timezone=auto&forecast_days=${days}&models=${modelIds}`;

  const marineUrl =
    `https://marine-api.open-meteo.com/v1/marine?latitude=${spot.lat}&longitude=${spot.lon}` +
    `&hourly=wave_height,wave_period&timezone=auto&forecast_days=${days}`;

  const [wind, marine] = await Promise.all([
    fetchJson<{ timezone: string; hourly: { time: string[] } & Record<string, (number | null)[]> }>(windUrl),
    fetchJson<{ hourly: MarineHourly }>(marineUrl).catch(() => null),
  ]);

  const marineByTime = new Map<string, { height: number | null; period: number | null }>();
  if (marine) {
    marine.hourly.time.forEach((t, i) => {
      marineByTime.set(t, {
        height: marine.hourly.wave_height[i] ?? null,
        period: marine.hourly.wave_period[i] ?? null,
      });
    });
  }

  const time = wind.hourly.time;
  const byModel = {} as Record<ModelId, HourlyPoint[]>;
  for (const model of FORECAST_MODELS) {
    const speeds = wind.hourly[`windspeed_10m_${model.id}`];
    const gusts = wind.hourly[`windgusts_10m_${model.id}`];
    const dirs = wind.hourly[`winddirection_10m_${model.id}`];
    if (!speeds || !gusts || !dirs) {
      byModel[model.id] = [];
      continue;
    }
    // Not every model covers the full requested range (e.g. Météo-France tops out around 4-5
    // days even when 16 were requested) — speed/direction come back null past a model's real
    // coverage, so stop at the first such gap rather than carrying nulls into non-nullable fields.
    let coverageEnd = time.length;
    for (let i = 0; i < time.length; i++) {
      if (speeds[i] == null || dirs[i] == null) {
        coverageEnd = i;
        break;
      }
    }
    byModel[model.id] = time.slice(0, coverageEnd).map((t, i) => {
      const m = marineByTime.get(t);
      return {
        time: t,
        windSpeedKt: speeds[i]!,
        windGustKt: gusts[i] ?? null,
        windDirDeg: dirs[i]!,
        waveHeightM: m?.height ?? null,
        wavePeriodS: m?.period ?? null,
        tideHeightM: null,
      };
    });
  }

  return { timezone: wind.timezone, byModel };
}

/** Today's wind so far (local midnight up to now) for the live-report trend chart. Uses the default best-match model. */
export async function fetchRecentWind(spot: Spot): Promise<ForecastBundle> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${spot.lat}&longitude=${spot.lon}` +
    `&hourly=windspeed_10m,windgusts_10m,winddirection_10m&windspeed_unit=kn&timezone=auto&forecast_days=1`;

  const data = await fetchJson<{ timezone: string; hourly: { time: string[]; windspeed_10m: number[]; windgusts_10m: number[]; winddirection_10m: number[] } }>(
    url,
  );
  const points = data.hourly.time.map((time, i) => ({
    time,
    windSpeedKt: data.hourly.windspeed_10m[i],
    windGustKt: data.hourly.windgusts_10m[i],
    windDirDeg: data.hourly.winddirection_10m[i],
    waveHeightM: null,
    wavePeriodS: null,
    tideHeightM: null,
  }));

  return { timezone: data.timezone, points };
}

interface CurrentBlock {
  time: string;
  wind_speed_10m: number;
  wind_gusts_10m: number;
  wind_direction_10m: number;
}

/** Latest model-analyzed "right now" reading (refreshes roughly every 15 minutes upstream). */
export async function fetchCurrentConditions(spot: Spot): Promise<LiveReading | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${spot.lat}&longitude=${spot.lon}` +
    `&current=wind_speed_10m,wind_gusts_10m,wind_direction_10m&windspeed_unit=kn&timezone=auto`;

  try {
    const data = await fetchJson<{ current: CurrentBlock }>(url);
    return {
      time: data.current.time,
      windSpeedKt: data.current.wind_speed_10m,
      windGustKt: data.current.wind_gusts_10m,
      windDirDeg: data.current.wind_direction_10m,
    };
  } catch {
    return null;
  }
}
