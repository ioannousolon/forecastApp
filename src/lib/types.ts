export interface MetarStation {
  icao: string;
  name: string;
  lat: number;
  lon: number;
}

export interface Spot {
  id: string;
  name: string;
  country: string;
  /** Sidebar grouping — usually the country, but the original curated spots stay grouped as "Worldwide". */
  region: string;
  lat: number;
  lon: number;
  /** Meteorological direction (deg, "from") of wind blowing straight onshore at this spot. */
  onshoreWindDir: number;
  blurb: string;
  /** Nearest airport with real METAR observations, when one close enough to be representative exists. */
  metarStation?: MetarStation;
}

export interface LiveReading {
  time: string; // ISO, model's current-conditions timestamp
  windSpeedKt: number;
  windGustKt: number;
  windDirDeg: number;
}

export interface StationReading {
  stationIcao: string;
  stationName: string;
  distanceKm: number;
  observedAt: Date;
  windSpeedKt: number;
  windGustKt: number | null;
  windDirDeg: number | null; // null when METAR reports variable ("VRB") direction
  raw: string;
}

export interface HourlyPoint {
  time: string; // ISO local time
  windSpeedKt: number;
  /** Some models (e.g. ECMWF via Open-Meteo) don't report gusts at all. */
  windGustKt: number | null;
  windDirDeg: number;
  waveHeightM: number | null;
  wavePeriodS: number | null;
  tideHeightM: number | null;
}

export type Rating = "poor" | "fair" | "good";

export interface RatedPoint extends HourlyPoint {
  rating: Rating;
  speedRating: Rating;
  directionRating: Rating;
}
