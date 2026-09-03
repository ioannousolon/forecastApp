import { useEffect, useMemo, useState } from "react";
import { SPOTS, SPOT_GROUPS } from "./lib/spots";
import { fetchHourlyForecast, fetchCurrentConditions, fetchRecentWind, FORECAST_MODELS, type ModelId } from "./lib/openMeteo";
import { fetchStationReading } from "./lib/metar";
import { attachTides } from "./lib/tide";
import { rateForecast, rateWind } from "./lib/suitability";
import { zoneCurrentHourKey, zoneNowKey } from "./lib/time";
import { isWithinMiddayToSunset } from "./lib/sun";
import { recordStationReading, getStationHistory, pruneStationHistory, type ObservedReading } from "./lib/duck";
import type { LiveReading, RatedPoint, StationReading } from "./lib/types";
import { WindChart, LegendSwatch, LINE_STYLES } from "./components/WindChart";
import { ForecastTable } from "./components/ForecastTable";
import { LiveNow } from "./components/LiveNow";
import "./App.css";

const LIVE_REFRESH_MS = 5 * 60_000;
const HISTORY_RECORD_MS = 15 * 60_000;
const HISTORY_LOOKBACK_MS = 25 * 3_600_000; // safely covers "since local midnight" for any timezone
const HISTORY_PRUNE_MS = 48 * 3_600_000;
const FORECAST_DAY_OPTIONS = [5, 10, 16] as const;

type Tab = "report" | "forecast";

export default function App() {
  const [spotId, setSpotId] = useState(SPOTS[0].id);
  const [tab, setTab] = useState<Tab>("report");
  const [selectedModel, setSelectedModel] = useState<ModelId>(FORECAST_MODELS[0].id);
  const [forecastDays, setForecastDays] = useState<number>(FORECAST_DAY_OPTIONS[0]);
  const [modelData, setModelData] = useState<Record<ModelId, RatedPoint[]> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState<LiveReading | null>(null);
  const [station, setStation] = useState<StationReading | null>(null);
  const [recentPoints, setRecentPoints] = useState<RatedPoint[] | null>(null);
  const [forecastTimezone, setForecastTimezone] = useState<string | null>(null);
  const [recentTimezone, setRecentTimezone] = useState<string | null>(null);
  const [observedHistory, setObservedHistory] = useState<ObservedReading[]>([]);

  const spot = useMemo(() => SPOTS.find((s) => s.id === spotId)!, [spotId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setModelData(null);

    (async () => {
      try {
        const hourly = await fetchHourlyForecast(spot, forecastDays);
        // Tide is location-based, not model-based: fetch it once against the first model's hourly
        // grid, then reuse the same values across every model (they all share identical timestamps
        // up to each model's own truncation point, so index-aligned lookup stays correct).
        const primaryModelId = FORECAST_MODELS[0].id;
        const primaryWithTides = await attachTides(spot, hourly.byModel[primaryModelId]);
        const tideByIndex = primaryWithTides.map((p) => p.tideHeightM);

        if (cancelled) return;

        const ratedByModel = {} as Record<ModelId, RatedPoint[]>;
        for (const model of FORECAST_MODELS) {
          const withTide = hourly.byModel[model.id].map((p, i) => ({ ...p, tideHeightM: tideByIndex[i] ?? null }));
          ratedByModel[model.id] = rateForecast(withTide, spot);
        }
        setModelData(ratedByModel);
        setForecastTimezone(hourly.timezone);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load forecast.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [spot, forecastDays]);

  useEffect(() => {
    let cancelled = false;
    setCurrent(null);
    setStation(null);

    const refresh = async () => {
      const [liveNow, liveStation] = await Promise.all([
        fetchCurrentConditions(spot),
        spot.metarStation ? fetchStationReading(spot.lat, spot.lon, spot.metarStation) : Promise.resolve(null),
      ]);
      if (cancelled) return;
      setCurrent(liveNow);
      setStation(liveStation);
    };

    refresh();
    const interval = setInterval(refresh, LIVE_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [spot]);

  useEffect(() => {
    let cancelled = false;
    setObservedHistory([]);

    if (!spot.metarStation) return;
    const station = spot.metarStation;

    const reloadHistory = async () => {
      const history = await getStationHistory(spot.id, new Date(Date.now() - HISTORY_LOOKBACK_MS));
      if (!cancelled) setObservedHistory(history);
    };

    const maybeRecord = async () => {
      if (!isWithinMiddayToSunset(spot)) return;
      const reading = await fetchStationReading(spot.lat, spot.lon, station);
      if (!reading || cancelled) return;
      await recordStationReading(spot.id, {
        time: reading.observedAt,
        windSpeedKt: reading.windSpeedKt,
        windGustKt: reading.windGustKt,
        windDirDeg: reading.windDirDeg,
      });
      if (!cancelled) await reloadHistory();
    };

    reloadHistory();
    maybeRecord();
    pruneStationHistory(new Date(Date.now() - HISTORY_PRUNE_MS));

    const interval = setInterval(maybeRecord, HISTORY_RECORD_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [spot]);

  useEffect(() => {
    let cancelled = false;
    setRecentPoints(null);

    (async () => {
      try {
        const recent = await fetchRecentWind(spot);
        if (cancelled) return;
        setRecentPoints(rateForecast(recent.points, spot));
        setRecentTimezone(recent.timezone);
      } catch {
        if (!cancelled) setRecentPoints(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [spot]);

  const liveChartPoints = useMemo(() => {
    if (!recentPoints || !recentTimezone) return null;
    const nowKey = zoneNowKey(recentTimezone);
    const past = recentPoints.filter((p) => p.time <= nowKey);
    if (!current) return past;

    const last = past[past.length - 1];
    if (last && current.time <= last.time) return past;

    const liveRating = rateWind(current.windSpeedKt, current.windDirDeg, spot);
    const currentPoint: RatedPoint = {
      time: current.time,
      windSpeedKt: current.windSpeedKt,
      windGustKt: current.windGustKt,
      windDirDeg: current.windDirDeg,
      waveHeightM: null,
      wavePeriodS: null,
      tideHeightM: null,
      ...liveRating,
    };
    return [...past, currentPoint];
  }, [recentPoints, recentTimezone, current, spot]);

  const points = modelData?.[selectedModel] ?? null;
  const tideEnabled = points?.some((p) => p.tideHeightM != null) ?? false;

  const bestWindow = useMemo(() => {
    if (!points || !forecastTimezone) return null;
    const currentHourKey = zoneCurrentHourKey(forecastTimezone);
    const upcoming = points.filter((p) => p.time >= currentHourKey);
    const good = upcoming.filter((p) => p.rating === "good");
    return good.length > 0 ? good[0] : null;
  }, [points, forecastTimezone]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>🪁 Kitesurf Forecast</h1>
        <p className="subtitle">Wind, wave and suitability outlook for top kitesurfing spots</p>
      </header>

      <div className="layout">
        <nav className="spot-list">
          <h3 className="spot-list-title">Choose a spot:</h3>
          {SPOT_GROUPS.map(([region, spots]) => (
            <details key={region} className="spot-group">
              <summary className="spot-group-label">{region}</summary>
              {spots.map((s) => (
                <button
                  key={s.id}
                  className={`spot-item ${s.id === spotId ? "active" : ""}`}
                  onClick={() => setSpotId(s.id)}
                >
                  <div className="spot-name">{s.name}</div>
                  <div className="spot-country">{s.country}</div>
                </button>
              ))}
            </details>
          ))}
        </nav>

        <main className="content">
          <div className="spot-header">
            <h2>
              {spot.name}, {spot.country}
            </h2>
            <p className="blurb">{spot.blurb}</p>
          </div>

          <div className="tabs">
            <button className={`tab ${tab === "report" ? "active" : ""}`} onClick={() => setTab("report")}>
              Live Report
            </button>
            <button className={`tab ${tab === "forecast" ? "active" : ""}`} onClick={() => setTab("forecast")}>
              Forecast
            </button>
          </div>

          {tab === "report" && (
            <>
              <LiveNow spot={spot} current={current} station={station} />

              {liveChartPoints && liveChartPoints.length > 1 && (
                <div className="live-trend">
                  <h3 className="section-label">Today's wind so far</h3>
                  <WindChart
                    points={liveChartPoints}
                    todayView={recentTimezone ? { timezone: recentTimezone, observed: observedHistory } : undefined}
                  />
                  <div className="legend">
                    <LegendSwatch style={LINE_STYLES.speed} label="Model speed" />
                    <LegendSwatch style={LINE_STYLES.gust} label="Model gusts" />
                    {observedHistory.length > 0 && (
                      <>
                        <LegendSwatch style={LINE_STYLES.observedSpeed} label="Observed speed" />
                        <LegendSwatch style={LINE_STYLES.observedGust} label="Observed gusts" />
                      </>
                    )}
                  </div>
                  {spot.metarStation && observedHistory.length === 0 && (
                    <p className="tide-note">
                      Real station readings are logged every 15 min between local midday and sunset — none recorded yet today.
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {tab === "forecast" && (
            <>
              <div className="model-tabs">
                {FORECAST_MODELS.map((m) => (
                  <button
                    key={m.id}
                    className={`model-tab ${selectedModel === m.id ? "active" : ""}`}
                    onClick={() => setSelectedModel(m.id)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <p className="model-blurb">
                {FORECAST_MODELS.find((m) => m.id === selectedModel)?.blurb}
                {points && points.length > 0 && (
                  <>
                    {" "}
                    Data through{" "}
                    {new Date(points[points.length - 1].time).toLocaleString(undefined, {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                    .
                  </>
                )}
              </p>

              <div className="model-tabs">
                {FORECAST_DAY_OPTIONS.map((d) => (
                  <button key={d} className={`model-tab ${forecastDays === d ? "active" : ""}`} onClick={() => setForecastDays(d)}>
                    {d} days
                  </button>
                ))}
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
                    <div className="best-window fair">
                      No clearly "good" window in the next {forecastDays} days — check the table below for fair conditions.
                    </div>
                  )}

                  <WindChart points={points} />
                  <div className="legend">
                    <LegendSwatch style={LINE_STYLES.speed} label="Wind speed" />
                    <LegendSwatch style={LINE_STYLES.gust} label="Gusts" />
                    <span><span className="badge badge-good">good</span><span className="badge badge-fair">fair</span><span className="badge badge-poor">poor</span></span>
                  </div>

                  {!tideEnabled && <p className="tide-note">Tide data isn't available for this spot yet — it refreshes weekly.</p>}

                  <ForecastTable points={points} tideEnabled={tideEnabled} />
                </>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
