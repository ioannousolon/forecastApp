import type { AppMode, RatedPoint } from "../lib/types";
import { compassLabel } from "../lib/suitability";
import { SURF_RATING_LABEL } from "./SurfChart";

interface Props {
  points: RatedPoint[];
  tideEnabled: boolean;
  appMode?: AppMode;
}

function DirectionArrow({ deg }: { deg: number }) {
  return (
    <span className="dir-arrow" style={{ transform: `rotate(${deg}deg)` }} title={`${deg}°`}>
      ↓
    </span>
  );
}

export function ForecastTable({ points, tideEnabled, appMode = "kite" }: Props) {
  const days = new Map<string, RatedPoint[]>();
  for (const p of points) {
    const key = new Date(p.time).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
    if (!days.has(key)) days.set(key, []);
    days.get(key)!.push(p);
  }

  const isSurf = appMode === "surf";

  return (
    <div className="forecast-table-wrap">
      {[...days.entries()].map(([day, rows]) => (
        <div key={day} className="day-block">
          <h3>{day}</h3>
          <table className="forecast-table">
            <thead>
              {isSurf ? (
                <tr>
                  <th>Time</th>
                  <th>Surf Rating</th>
                  <th>Surf Height</th>
                  <th>Primary Swell</th>
                  <th>Wind</th>
                  <th>Wind Type</th>
                  {tideEnabled && <th>Tide</th>}
                </tr>
              ) : (
                <tr>
                  <th>Time</th>
                  <th>Rating</th>
                  <th>Wind</th>
                  <th>Gusts</th>
                  <th>Dir</th>
                  <th>Wave</th>
                  {tideEnabled && <th>Tide</th>}
                </tr>
              )}
            </thead>
            <tbody>
              {rows.map((p) => {
                if (isSurf) {
                  const swellH = p.primarySwell?.heightM ?? p.waveHeightM;
                  const swellP = p.primarySwell?.periodS ?? p.wavePeriodS;
                  const swellDir = p.primarySwell?.dirDeg ?? p.waveDirDeg;
                  const surfRating = p.surfRating ?? "fair";

                  return (
                    <tr key={p.time} className={`surf-row rating-surf-${surfRating}`}>
                      <td>{new Date(p.time).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</td>
                      <td>
                        <span className={`badge badge-surf badge-surf-${surfRating}`}>{SURF_RATING_LABEL[surfRating]}</span>
                      </td>
                      <td className="surf-height-cell">
                        <strong>
                          {p.surfHeightMMin != null && p.surfHeightMMax != null
                            ? `${p.surfHeightMMin.toFixed(1)}–${p.surfHeightMMax.toFixed(1)} m`
                            : "–"}
                        </strong>
                      </td>
                      <td>
                        {swellH != null ? (
                          <>
                            {swellH.toFixed(1)}m {swellP != null ? `@ ${Math.round(swellP)}s` : ""}{" "}
                            {swellDir != null && <DirectionArrow deg={swellDir} />}
                          </>
                        ) : (
                          "–"
                        )}
                      </td>
                      <td>
                        {Math.round(p.windSpeedKt)} kt <DirectionArrow deg={p.windDirDeg} /> {compassLabel(p.windDirDeg)}
                      </td>
                      <td>
                        <span className={`wind-badge wind-${p.windClass ?? "cross_shore"}`}>
                          {(p.windClass ?? "cross_shore").replace("_", " ")}
                        </span>
                      </td>
                      {tideEnabled && <td>{p.tideHeightM != null ? `${p.tideHeightM.toFixed(1)} m` : "–"}</td>}
                    </tr>
                  );
                }

                return (
                  <tr key={p.time} className={`rating-${p.rating}`}>
                    <td>{new Date(p.time).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</td>
                    <td>
                      <span className={`badge badge-${p.rating}`}>{p.rating}</span>
                    </td>
                    <td>{Math.round(p.windSpeedKt)} kt</td>
                    <td>{p.windGustKt != null ? `${Math.round(p.windGustKt)} kt` : "–"}</td>
                    <td>
                      <DirectionArrow deg={p.windDirDeg} /> {compassLabel(p.windDirDeg)}
                    </td>
                    <td>{p.waveHeightM != null ? `${p.waveHeightM.toFixed(1)} m` : "–"}</td>
                    {tideEnabled && <td>{p.tideHeightM != null ? `${p.tideHeightM.toFixed(1)} m` : "–"}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

