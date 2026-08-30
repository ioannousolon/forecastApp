import type { HourlyPoint, Spot } from "./types";

/** Independent model used to cross-check the primary (auto-blended) forecast. */
export const ALT_MODEL_LABEL = "GFS";
const ALT_MODEL_ID = "gfs_seamless";

interface ForecastHourly {
  time: string[];
  windspeed_10m: number[];
  windgusts_10m: number[];
  winddirection_10m: number[];
}

interface AltForecastHourly {
  time: string[];
  windspeed_10m: number[];
  winddirection_10m: number[];
}

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

export async function fetchHourlyForecast(spot: Spot): Promise<HourlyPoint[]> {
  const windUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${spot.lat}&longitude=${spot.lon}` +
    `&hourly=windspeed_10m,windgusts_10m,winddirection_10m&windspeed_unit=kn&timezone=auto&forecast_days=5`;

  const altWindUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${spot.lat}&longitude=${spot.lon}` +
    `&hourly=windspeed_10m,winddirection_10m&windspeed_unit=kn&timezone=auto&forecast_days=5&models=${ALT_MODEL_ID}`;

  const marineUrl =
    `https://marine-api.open-meteo.com/v1/marine?latitude=${spot.lat}&longitude=${spot.lon}` +
    `&hourly=wave_height,wave_period&timezone=auto&forecast_days=5`;

  const [wind, altWind, marine] = await Promise.all([
    fetchJson<{ hourly: ForecastHourly }>(windUrl),
    fetchJson<{ hourly: AltForecastHourly }>(altWindUrl).catch(() => null),
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

  const altByTime = new Map<string, { speed: number; dir: number }>();
  if (altWind) {
    altWind.hourly.time.forEach((t, i) => {
      altByTime.set(t, { speed: altWind.hourly.windspeed_10m[i], dir: altWind.hourly.winddirection_10m[i] });
    });
  }

  return wind.hourly.time.map((time, i) => {
    const m = marineByTime.get(time);
    const alt = altByTime.get(time);
    return {
      time,
      windSpeedKt: wind.hourly.windspeed_10m[i],
      windGustKt: wind.hourly.windgusts_10m[i],
      windDirDeg: wind.hourly.winddirection_10m[i],
      waveHeightM: m?.height ?? null,
      wavePeriodS: m?.period ?? null,
      tideHeightM: null,
      altWindSpeedKt: alt?.speed ?? null,
      altWindDirDeg: alt?.dir ?? null,
    };
  });
}
