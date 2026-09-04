import type { HourlyPoint, LiveReading, RatedPoint, Rating, Spot } from "./types";

export function angleDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function rateSpeed(speedKt: number): Rating {
  if (speedKt < 10 || speedKt > 32) return "poor";
  if (speedKt < 12 || speedKt > 25) return "fair";
  return "good";
}

/** Rates direction by how far the wind is from blowing straight offshore (the dangerous case). */
function rateDirection(windDirDeg: number, onshoreWindDir: number): Rating {
  const offshoreDir = (onshoreWindDir + 180) % 360;
  const diffFromOffshore = angleDiff(windDirDeg, offshoreDir);
  if (diffFromOffshore < 45) return "poor";
  if (diffFromOffshore < 90) return "fair";
  return "good";
}

const RATING_RANK: Record<Rating, number> = { poor: 0, fair: 1, good: 2 };

function combine(a: Rating, b: Rating): Rating {
  return RATING_RANK[a] <= RATING_RANK[b] ? a : b;
}

export interface WindRating {
  rating: Rating;
  speedRating: Rating;
  directionRating: Rating;
}

export function rateWind(windSpeedKt: number, windDirDeg: number, spot: Spot): WindRating {
  const speedRating = rateSpeed(windSpeedKt);
  const directionRating = rateDirection(windDirDeg, spot.onshoreWindDir);
  return { speedRating, directionRating, rating: combine(speedRating, directionRating) };
}

export function classifyWind(windDirDeg: number, windSpeedKt: number, spot: Spot): import("./types").WindClass {
  if (windSpeedKt < 5) return "glassy";
  const facingDir = spot.facingDir ?? (spot.onshoreWindDir + 180) % 360;
  const offshoreDir = (facingDir + 180) % 360;
  const diffOffshore = angleDiff(windDirDeg, offshoreDir);
  const diffOnshore = angleDiff(windDirDeg, spot.onshoreWindDir);

  if (diffOffshore <= 50) return "offshore";
  if (diffOnshore <= 50) return "onshore";
  return "cross_shore";
}

export function calculateSurfFaceHeightM(
  swellHeightM: number | null,
  waveHeightM: number | null,
  periodS: number | null
): { minM: number; maxM: number } {
  const hM = swellHeightM ?? waveHeightM ?? 0;
  if (hM <= 0.05) return { minM: 0, maxM: 0.2 };
  const pS = periodS ?? 6;
  const shoal = Math.sqrt(Math.max(pS, 4) / 7.5);
  const baseFaceM = hM * shoal;
  const minM = Math.max(0, Math.floor(baseFaceM * 0.85 * 10) / 10);
  const maxM = Math.max(minM + 0.1, Math.ceil(baseFaceM * 1.25 * 10) / 10);
  return { minM, maxM };
}

export function rateSurfPoint(
  point: HourlyPoint,
  spot: Spot
): { surfRating: import("./types").SurfRating; windClass: import("./types").WindClass; surfHeightMMin: number; surfHeightMMax: number } {
  const windClass = classifyWind(point.windDirDeg, point.windSpeedKt, spot);
  const swellH = point.primarySwell?.heightM ?? point.waveHeightM;
  const swellP = point.primarySwell?.periodS ?? point.wavePeriodS;
  const { minM, maxM } = calculateSurfFaceHeightM(swellH, point.waveHeightM, swellP);

  let surfRating: import("./types").SurfRating = "fair";

  if (maxM < 0.3) {
    surfRating = "flat";
  } else if (windClass === "onshore" && point.windSpeedKt > 11) {
    surfRating = "poor";
  } else if (windClass === "onshore") {
    surfRating = "poor_to_fair";
  } else if (windClass === "offshore" && (swellP ?? 0) >= 11 && maxM >= 0.9) {
    surfRating = "epic";
  } else if ((windClass === "offshore" || windClass === "glassy") && (swellP ?? 0) >= 9) {
    surfRating = "good";
  } else if (windClass === "offshore" || windClass === "glassy") {
    surfRating = "fair_to_good";
  } else if (windClass === "cross_shore" && point.windSpeedKt <= 12) {
    surfRating = "fair";
  } else {
    surfRating = "poor_to_fair";
  }

  return { surfRating, windClass, surfHeightMMin: minM, surfHeightMMax: maxM };
}

export function evaluateLiveSurfReading(
  reading: LiveReading,
  spot: Spot
): {
  surfRating: import("./types").SurfRating;
  windClass: import("./types").WindClass;
  surfHeightMMin: number;
  surfHeightMMax: number;
} {
  const dummyPoint: HourlyPoint = {
    time: reading.time,
    windSpeedKt: reading.windSpeedKt,
    windGustKt: reading.windGustKt,
    windDirDeg: reading.windDirDeg,
    waveHeightM: reading.waveHeightM ?? null,
    wavePeriodS: reading.wavePeriodS ?? null,
    waveDirDeg: reading.waveDirDeg ?? null,
    tideHeightM: null,
  };
  return rateSurfPoint(dummyPoint, spot);
}

export function ratePoint(point: HourlyPoint, spot: Spot): RatedPoint {
  const kiteRating = rateWind(point.windSpeedKt, point.windDirDeg, spot);
  const surfDetails = rateSurfPoint(point, spot);
  return {
    ...point,
    ...kiteRating,
    surfRating: surfDetails.surfRating,
    windClass: surfDetails.windClass,
    surfHeightMMin: surfDetails.surfHeightMMin,
    surfHeightMMax: surfDetails.surfHeightMMax,
  };
}

export function rateForecast(points: HourlyPoint[], spot: Spot): RatedPoint[] {
  return points.map((p) => ratePoint(p, spot));
}

export function compassLabel(deg: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

