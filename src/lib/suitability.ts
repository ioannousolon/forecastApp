import type { HourlyPoint, RatedPoint, Rating, Spot } from "./types";

function angleDiff(a: number, b: number): number {
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

export function ratePoint(point: HourlyPoint, spot: Spot): RatedPoint {
  const speedRating = rateSpeed(point.windSpeedKt);
  const directionRating = rateDirection(point.windDirDeg, spot.onshoreWindDir);
  return {
    ...point,
    speedRating,
    directionRating,
    rating: combine(speedRating, directionRating),
  };
}

export function rateForecast(points: HourlyPoint[], spot: Spot): RatedPoint[] {
  return points.map((p) => ratePoint(p, spot));
}

export function compassLabel(deg: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}
