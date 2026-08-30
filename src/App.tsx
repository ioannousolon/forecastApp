import { useEffect, useMemo, useState } from "react";
import { SPOTS } from "./lib/spots";
import { fetchHourlyForecast, ALT_MODEL_LABEL } from "./lib/openMeteo";
import { attachTides, TIDE_ENABLED } from "./lib/tide";
import { rateForecast } from "./lib/suitability";
import type { RatedPoint } from "./lib/types";
import { WindChart } from "./components/WindChart";
import { ForecastTable } from "./components/ForecastTable";
import "./App.css";

export default function App() {
  const [spotId, setSpotId] = useState(SPOTS[0].id);
  const [points, setPoints] = useState<RatedPoint[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const spot = useMemo(() => SPOTS.find((s) => s.id === spotId)!, [spotId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPoints(null);

    (async () => {
      try {
        const hourly = await fetchHourlyForecast(spot);
        const withTides = await attachTides(spot, hourly);
        if (cancelled) return;
        setPoints(rateForecast(withTides, spot));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load forecast.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [spot]);

  const bestWindow = useMemo(() => {
    if (!points) return null;
    const now = Date.now();
    const upcoming = points.filter((p) => new Date(p.time).getTime() >= now - 3600_000);
    const good = upcoming.filter((p) => p.rating === "good");
    return good.length > 0 ? good[0] : null;
  }, [points]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>🪁 Kitesurf Forecast</h1>
        <p className="subtitle">Wind, wave and suitability outlook for top kitesurfing spots</p>
      </header>

      <div className="layout">
        <nav className="spot-list">
          {SPOTS.map((s) => (
            <button
              key={s.id}
              className={`spot-item ${s.id === spotId ? "active" : ""}`}
              onClick={() => setSpotId(s.id)}
            >
              <div className="spot-name">{s.name}</div>
              <div className="spot-country">{s.country}</div>
            </button>
          ))}
        </nav>

        <main className="content">
          <div className="spot-header">
            <h2>
              {spot.name}, {spot.country}
            </h2>
            <p className="blurb">{spot.blurb}</p>
          </div>

          {loading && <p className="status">Loading forecast…</p>}
          {error && <p className="status error">⚠ {error}</p>}

          {points && !loading && !error && (
            <>
              {bestWindow ? (
                <div className="best-window">
                  ✅ Next good window:{" "}
                  <strong>
                    {new Date(bestWindow.time).toLocaleString(undefined, {
                      weekday: "short",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </strong>{" "}
                  — {Math.round(bestWindow.windSpeedKt)}kt from {Math.round(bestWindow.windDirDeg)}°
                </div>
              ) : (
                <div className="best-window fair">No clearly "good" window in the next 5 days — check the table below for fair conditions.</div>
              )}

              <WindChart points={points} />
              <div className="legend">
                <span><i className="dot" style={{ background: "var(--chart-speed)" }} /> Wind speed</span>
                <span><i className="dot dash" /> Gusts</span>
                <span><i className="dot" style={{ background: "var(--chart-alt)" }} /> {ALT_MODEL_LABEL} cross-check</span>
                <span><span className="badge badge-good">good</span><span className="badge badge-fair">fair</span><span className="badge badge-poor">poor</span></span>
              </div>

              {!TIDE_ENABLED && (
                <p className="tide-note">
                  Tide data is off. Set <code>VITE_WORLDTIDES_API_KEY</code> (free tier at worldtides.info) to enable it.
                </p>
              )}

              <ForecastTable points={points} tideEnabled={TIDE_ENABLED} />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
