import type { MetarStation, StationReading } from "./types";

/** Great-circle distance in km between two lat/lon points. */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const WIND_RE = /\b(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?KT\b/;
const TIME_RE = /\b(\d{2})(\d{2})(\d{2})Z\b/;

function parseObsTime(raw: string): Date {
  const m = raw.match(TIME_RE);
  const now = new Date();
  if (!m) return now;
  const [, dd, hh, mm] = m;
  const day = Number(dd);
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day, Number(hh), Number(mm)));
  // METAR only carries day-of-month; if it's ahead of "now" by more than a couple days, the
  // observation must be from last month (only matters right at a month boundary).
  if (date.getTime() > now.getTime() + 2 * 24 * 3600_000) {
    date.setUTCMonth(date.getUTCMonth() - 1);
  }
  return date;
}

function parseMetar(icao: string, spotLat: number, spotLon: number, station: MetarStation, raw: string): StationReading | null {
  const windMatch = raw.match(WIND_RE);
  if (!windMatch) return null;
  const [, dir, speed, gust] = windMatch;

  return {
    stationIcao: icao,
    stationName: station.name,
    distanceKm: haversineKm(spotLat, spotLon, station.lat, station.lon),
    observedAt: parseObsTime(raw),
    windSpeedKt: Number(speed),
    windGustKt: gust ? Number(gust) : null,
    windDirDeg: dir === "VRB" ? null : Number(dir),
    raw,
  };
}

export async function fetchStationReading(spotLat: number, spotLon: number, station: MetarStation): Promise<StationReading | null> {
  try {
    const res = await fetch(`https://metar.vatsim.net/${station.icao}`);
    if (!res.ok) return null;
    const raw = (await res.text()).trim();
    if (!raw) return null;
    return parseMetar(station.icao, spotLat, spotLon, station, raw);
  } catch {
    return null;
  }
}
