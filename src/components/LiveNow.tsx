import type { LiveReading, Spot, StationReading } from "../lib/types";
import { rateWind, compassLabel } from "../lib/suitability";

interface Props {
  spot: Spot;
  current: LiveReading | null;
  station: StationReading | null;
}

function timeAgo(date: Date): string {
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

export function LiveNow({ spot, current, station }: Props) {
  if (!current && !station) return null;

  return (
    <div className="live-now">
      {current && (
        <div className="live-card">
          <div className="live-card-head">
            <span className="live-dot" /> Live model estimate
          </div>
          {(() => {
            const r = rateWind(current.windSpeedKt, current.windDirDeg, spot);
            return (
              <div className="live-card-body">
                <span className={`badge badge-${r.rating}`}>{r.rating}</span>
                <strong>{Math.round(current.windSpeedKt)} kt</strong>
                <span className="live-sub">gusting {Math.round(current.windGustKt)} kt</span>
                <span className="live-sub">
                  {compassLabel(current.windDirDeg)} ({Math.round(current.windDirDeg)}°)
                </span>
              </div>
            );
          })()}
          <div className="live-card-foot">as of {new Date(current.time).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} · updates automatically</div>
        </div>
      )}

      {spot.metarStation && station && (
        <div className="live-card">
          <div className="live-card-head">
            <span className="live-dot station" /> {station.stationName} · {station.distanceKm.toFixed(0)} km away
          </div>
          <div className="live-card-body">
            <strong>{station.windSpeedKt} kt</strong>
            {station.windGustKt != null && <span className="live-sub">gusting {station.windGustKt} kt</span>}
            <span className="live-sub">{station.windDirDeg != null ? `${compassLabel(station.windDirDeg)} (${station.windDirDeg}°)` : "variable"}</span>
          </div>
          <div className="live-card-foot" title={station.raw}>
            observed {timeAgo(station.observedAt)} · real station reading, not a forecast
          </div>
        </div>
      )}

      {spot.metarStation && !station && (
        <div className="live-card live-card-muted">Live station reading temporarily unavailable.</div>
      )}

      {!spot.metarStation && (
        <div className="live-card live-card-muted">No nearby live weather station for this spot — model estimate only.</div>
      )}
    </div>
  );
}
