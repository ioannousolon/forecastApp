import type { RatedPoint } from "../lib/types";
import { compassLabel } from "../lib/suitability";
import { ALT_MODEL_LABEL } from "../lib/openMeteo";

interface Props {
  points: RatedPoint[];
  tideEnabled: boolean;
}

function DirectionArrow({ deg }: { deg: number }) {
  return (
    <span className="dir-arrow" style={{ transform: `rotate(${deg}deg)` }} title={`${deg}°`}>
      ↓
    </span>
  );
}

function AltWindCell({ point }: { point: RatedPoint }) {
  if (point.altWindSpeedKt == null || point.altWindDirDeg == null) return <td>–</td>;
  const diff = Math.abs(point.altWindSpeedKt - point.windSpeedKt);
  const agreementClass = diff >= 8 ? "diff-high" : diff >= 4 ? "diff-mid" : "diff-low";
  return (
    <td className={agreementClass} title={`${ALT_MODEL_LABEL} model reading`}>
      {Math.round(point.altWindSpeedKt)} kt <DirectionArrow deg={point.altWindDirDeg} />{" "}
      <span className="diff-tag">Δ{diff.toFixed(0)}</span>
    </td>
  );
}

export function ForecastTable({ points, tideEnabled }: Props) {
  const days = new Map<string, RatedPoint[]>();
  for (const p of points) {
    const key = new Date(p.time).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
    if (!days.has(key)) days.set(key, []);
    days.get(key)!.push(p);
  }

  return (
    <div className="forecast-table-wrap">
      {[...days.entries()].map(([day, rows]) => (
        <div key={day} className="day-block">
          <h3>{day}</h3>
          <table className="forecast-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Rating</th>
                <th>Wind</th>
                <th>Gusts</th>
                <th>Dir</th>
                <th title={`Cross-check reading from the ${ALT_MODEL_LABEL} model`}>{ALT_MODEL_LABEL} wind</th>
                <th>Wave</th>
                {tideEnabled && <th>Tide</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.time} className={`rating-${p.rating}`}>
                  <td>{new Date(p.time).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</td>
                  <td>
                    <span className={`badge badge-${p.rating}`}>{p.rating}</span>
                  </td>
                  <td>{Math.round(p.windSpeedKt)} kt</td>
                  <td>{Math.round(p.windGustKt)} kt</td>
                  <td>
                    <DirectionArrow deg={p.windDirDeg} /> {compassLabel(p.windDirDeg)}
                  </td>
                  <AltWindCell point={p} />
                  <td>{p.waveHeightM != null ? `${p.waveHeightM.toFixed(1)} m` : "–"}</td>
                  {tideEnabled && <td>{p.tideHeightM != null ? `${p.tideHeightM.toFixed(1)} m` : "–"}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
