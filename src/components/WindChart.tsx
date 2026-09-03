import type { RatedPoint } from "../lib/types";
import type { ObservedReading } from "../lib/duck";
import { minutesSinceMidnightFromNaive, minutesSinceMidnightInZone } from "../lib/time";

const RATING_COLOR: Record<string, string> = {
  good: "#22c55e",
  fair: "#eab308",
  poor: "#ef4444",
};

type MarkerShape = "circle" | "diamond" | "square" | "none";

interface LineStyle {
  color: string;
  width: number;
  dash?: string;
  marker: MarkerShape;
}

export const LINE_STYLES: Record<"speed" | "gust" | "observedSpeed" | "observedGust", LineStyle> = {
  speed: { color: "var(--chart-speed)", width: 2.5, marker: "circle" },
  gust: { color: "var(--chart-gust)", width: 1.5, dash: "5 3", marker: "none" },
  observedSpeed: { color: "var(--chart-observed)", width: 2.25, marker: "square" },
  observedGust: { color: "var(--chart-observed-gust)", width: 1.5, dash: "3 2", marker: "none" },
};

interface TodayView {
  timezone: string;
  observed: ObservedReading[];
}

interface Props {
  points: RatedPoint[];
  todayView?: TodayView;
}

function buildPath<T>(items: T[], xFor: (i: number) => number, yFor: (v: number) => number, accessor: (item: T) => number | null): string {
  let d = "";
  let started = false;
  items.forEach((item, i) => {
    const v = accessor(item);
    if (v == null) {
      started = false;
      return;
    }
    d += `${started ? "L" : "M"} ${xFor(i)} ${yFor(v)} `;
    started = true;
  });
  return d;
}

export function LegendSwatch({ style, label }: { style: LineStyle; label: string }) {
  const y = 7;
  return (
    <span className="legend-item">
      <svg width={32} height={14} className="legend-swatch" aria-hidden="true">
        <line x1={1} x2={31} y1={y} y2={y} stroke={style.color} strokeWidth={style.width} strokeDasharray={style.dash} strokeLinecap="round" />
        {style.marker === "circle" && <circle cx={16} cy={y} r={2.5} fill={style.color} />}
        {style.marker === "diamond" && <rect x={13} y={4} width={6} height={6} fill={style.color} transform={`rotate(45 16 ${y})`} />}
        {style.marker === "square" && <rect x={13} y={4} width={6} height={6} fill={style.color} />}
      </svg>
      {label}
    </span>
  );
}

export function WindChart({ points, todayView }: Props) {
  if (points.length === 0) return null;

  const width = 900;
  const height = 220;
  const padding = { top: 16, right: 16, bottom: 28, left: 40 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const observed = todayView?.observed ?? [];

  const maxGust = Math.max(...points.map((p) => p.windGustKt ?? 0), ...observed.map((o) => o.windGustKt ?? 0), 20);
  const yMax = Math.ceil(maxGust / 5) * 5 + 5;
  const yFor = (v: number) => padding.top + plotH - (v / yMax) * plotH;

  let xFor: (i: number) => number;
  let xForObserved: (i: number) => number;

  if (todayView) {
    const modelMinutes = points.map((p) => minutesSinceMidnightFromNaive(p.time));
    const observedMinutes = observed.map((o) => minutesSinceMidnightInZone(o.time, todayView.timezone));
    const domainEnd = Math.max(...modelMinutes, ...observedMinutes, 1);
    xFor = (i) => padding.left + (modelMinutes[i] / domainEnd) * plotW;
    xForObserved = (i) => padding.left + (observedMinutes[i] / domainEnd) * plotW;
  } else {
    xFor = (i) => padding.left + (i / (points.length - 1)) * plotW;
    xForObserved = () => padding.left;
  }

  const speedPath = buildPath(points, xFor, yFor, (p) => p.windSpeedKt);
  const gustPath = buildPath(points, xFor, yFor, (p) => p.windGustKt);
  const observedSpeedPath = buildPath(observed, xForObserved, yFor, (o) => o.windSpeedKt);
  const observedGustPath = buildPath(observed, xForObserved, yFor, (o) => o.windGustKt);

  // Rating-band boundaries sit at the midpoint between neighboring points, so bands stay
  // contiguous and proportional even when points aren't evenly spaced in time.
  const bandLeft = (i: number) => (i === 0 ? padding.left : (xFor(i - 1) + xFor(i)) / 2);
  const bandRight = (i: number) => (i === points.length - 1 ? width - padding.right : (xFor(i) + xFor(i + 1)) / 2);

  const spanHours =
    points.length > 1 ? (new Date(points[points.length - 1].time).getTime() - new Date(points[0].time).getTime()) / 3_600_000 : 0;

  const dayTicks: { i: number; label: string }[] = [];
  if (todayView || spanHours <= 36) {
    // Single-day chart: label the hour-of-day instead of the date.
    points.forEach((p, i) => {
      const minute = minutesSinceMidnightFromNaive(p.time);
      if (minute % 180 === 0) {
        dayTicks.push({ i, label: `${String(Math.floor(minute / 60)).padStart(2, "0")}:00` });
      }
    });
    const lastIdx = points.length - 1;
    const lastTickX = dayTicks.length > 0 ? xFor(dayTicks[dayTicks.length - 1].i) : -Infinity;
    if (xFor(lastIdx) - lastTickX > 30) {
      const minute = minutesSinceMidnightFromNaive(points[lastIdx].time);
      dayTicks.push({ i: lastIdx, label: `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}` });
    }
  } else {
    let lastDay = "";
    points.forEach((p, i) => {
      const d = new Date(p.time);
      const day = d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
      if (day !== lastDay) {
        dayTicks.push({ i, label: day });
        lastDay = day;
      }
    });
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="wind-chart" role="img" aria-label="Wind speed and gust forecast chart">
      {[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const v = yMax * f;
        return (
          <g key={f}>
            <line x1={padding.left} x2={width - padding.right} y1={yFor(v)} y2={yFor(v)} className="chart-gridline" />
            <text x={padding.left - 8} y={yFor(v) + 4} textAnchor="end" className="chart-axis-label">
              {Math.round(v)}
            </text>
          </g>
        );
      })}

      {points.map((p, i) => (
        <rect
          key={p.time}
          x={bandLeft(i)}
          y={padding.top}
          width={Math.max(0, bandRight(i) - bandLeft(i))}
          height={plotH}
          fill={RATING_COLOR[p.rating]}
          opacity={0.08}
        />
      ))}

      <path d={gustPath} fill="none" stroke={LINE_STYLES.gust.color} strokeWidth={LINE_STYLES.gust.width} strokeDasharray={LINE_STYLES.gust.dash} />
      {observedGustPath && (
        <path
          d={observedGustPath}
          fill="none"
          stroke={LINE_STYLES.observedGust.color}
          strokeWidth={LINE_STYLES.observedGust.width}
          strokeDasharray={LINE_STYLES.observedGust.dash}
        />
      )}
      {observedSpeedPath && (
        <path d={observedSpeedPath} fill="none" stroke={LINE_STYLES.observedSpeed.color} strokeWidth={LINE_STYLES.observedSpeed.width} />
      )}
      <path d={speedPath} fill="none" stroke={LINE_STYLES.speed.color} strokeWidth={LINE_STYLES.speed.width} />

      {observed.map((o, i) => (
        <rect
          key={`observed-${o.time.toISOString()}`}
          x={xForObserved(i) - 3}
          y={yFor(o.windSpeedKt) - 3}
          width={6}
          height={6}
          fill={LINE_STYLES.observedSpeed.color}
        />
      ))}

      {points.map((p, i) => (
        <circle key={p.time} cx={xFor(i)} cy={yFor(p.windSpeedKt)} r={2.5} fill={RATING_COLOR[p.rating]} />
      ))}

      {dayTicks.map((t) => (
        <text key={t.i} x={xFor(t.i)} y={height - 6} textAnchor="middle" className="chart-axis-label">
          {t.label}
        </text>
      ))}
    </svg>
  );
}
