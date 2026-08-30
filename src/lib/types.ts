export interface Spot {
  id: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
  /** Meteorological direction (deg, "from") of wind blowing straight onshore at this spot. */
  onshoreWindDir: number;
  blurb: string;
}

export interface HourlyPoint {
  time: string; // ISO local time
  windSpeedKt: number;
  windGustKt: number;
  windDirDeg: number;
  waveHeightM: number | null;
  wavePeriodS: number | null;
  tideHeightM: number | null;
  /** Cross-check reading from an independent forecast model (see ALT_MODEL_LABEL). */
  altWindSpeedKt: number | null;
  altWindDirDeg: number | null;
}

export type Rating = "poor" | "fair" | "good";

export interface RatedPoint extends HourlyPoint {
  rating: Rating;
  speedRating: Rating;
  directionRating: Rating;
}
