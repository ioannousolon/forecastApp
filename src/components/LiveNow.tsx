import type { AppMode, LiveReading, Spot, StationReading } from "../lib/types";
import { rateWind, compassLabel, classifyWind, evaluateLiveSurfReading } from "../lib/suitability";
import { SURF_RATING_LABEL } from "./SurfChart";

interface Props {
  spot: Spot;
  current: LiveReading | null;
  station: StationReading | null;
  appMode?: AppMode;
}

function timeAgo(date: Date): string {
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

export function LiveNow({ spot, current, station, appMode = "kite" }: Props) {
  if (!current && !station) return null;

  const isSurf = appMode === "surf";

  return (
    <div className="live-now">
      {current && (
        <div className="live-card">
          <div className="live-card-head">
            <span className="live-dot" /> {isSurf ? "Live Surf Conditions" : "Live model estimate"}
          </div>
          {(() => {
            if (isSurf) {
              const surfEval = evaluateLiveSurfReading(current, spot);
              return (
                <div className="live-card-body live-card-body-surf">
                  <div className="live-surf-top">
                    <span className={`badge badge-surf badge-surf-${surfEval.surfRating}`}>
                      {SURF_RATING_LABEL[surfEval.surfRating]}
                    </span>
                    <span className={`wind-badge wind-${surfEval.windClass}`}>
                      {surfEval.windClass.replace("_", " ")}
                    </span>
                  </div>
                  <strong className="live-surf-height">
                    {surfEval.surfHeightMMin.toFixed(1)}–{surfEval.surfHeightMMax.toFixed(1)} m face
                  </strong>
                  {current.waveHeightM != null && (
                    <span className="live-sub">
                      🌊 Open-water wave: {current.waveHeightM.toFixed(1)}m
                      {current.wavePeriodS != null ? ` @ ${current.wavePeriodS}s` : ""}
                      {current.waveDirDeg != null ? ` ${compassLabel(current.waveDirDeg)}` : ""}
                    </span>
                  )}
                  <span className="live-sub">
                    💨 Wind: {Math.round(current.windSpeedKt)} kt {compassLabel(current.windDirDeg)} ({Math.round(current.windDirDeg)}°)
                  </span>
                  <div className="live-surf-meta">
                    {spot.breakType && <span className="live-sub spot-break-tag">📍 {spot.breakType}</span>}
                    {spot.optimalTide && <span className="live-sub spot-tide-tag">🌊 Best tide: {spot.optimalTide}</span>}
                  </div>
                </div>
              );
            }

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
            {isSurf ? (
              <>
                {station.windDirDeg != null &&
                  (() => {
                    const stationWindClass = classifyWind(station.windDirDeg, station.windSpeedKt, spot);
                    return (
                      <span className={`wind-badge wind-${stationWindClass}`}>{stationWindClass.replace("_", " ")}</span>
                    );
                  })()}
                <strong>{station.windSpeedKt} kt wind</strong>
                <span className="live-sub">
                  {station.windDirDeg != null ? `${compassLabel(station.windDirDeg)} (${station.windDirDeg}°)` : "variable"}
                </span>
              </>
            ) : (
              <>
                <strong>{station.windSpeedKt} kt</strong>
                {station.windGustKt != null && <span className="live-sub">gusting {station.windGustKt} kt</span>}
                <span className="live-sub">{station.windDirDeg != null ? `${compassLabel(station.windDirDeg)} (${station.windDirDeg}°)` : "variable"}</span>
              </>
            )}
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
