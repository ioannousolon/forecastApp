import type { RatedPoint, SurfRating } from "../lib/types";

export const SURF_RATING_COLOR: Record<SurfRating, string> = {
  epic: "#f59e0b",
  good: "#10b981",
  fair_to_good: "#84cc16",
  fair: "#06b6d4",
  poor_to_fair: "#f97316",
  poor: "#ef4444",
  flat: "#64748b",
};

export const SURF_RATING_LABEL: Record<SurfRating, string> = {
  epic: "Epic",
  good: "Good",
  fair_to_good: "Fair to Good",
  fair: "Fair",
  poor_to_fair: "Poor to Fair",
  poor: "Poor",
  flat: "Flat",
};

interface Props {
  points: RatedPoint[];
}

export function SurfChart({ points }: Props) {
  if (points.length === 0) return null;

  const width = 900;
  const height = 220;
  const padding = { top: 24, right: 16, bottom: 28, left: 40 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const maxM = Math.max(...points.map((p) => p.surfHeightMMax ?? 0), 1.5);
  const yMax = Math.ceil(maxM * 2) / 2 + 0.5;
  const yFor = (v: number) => padding.top + plotH - (v / yMax) * plotH;

  const xFor = (i: number) => padding.left + (i / (points.length - 1 || 1)) * plotW;

  const barWidth = Math.max(3, Math.min(18, plotW / points.length - 2));

  // Build period path
  let periodPath = "";
  points.forEach((p, i) => {
    const period = p.primarySwell?.periodS ?? p.wavePeriodS;
    if (period != null) {
      // Map period (0-20s) onto plot height
      const y = padding.top + plotH - (Math.min(period, 20) / 20) * plotH;
      periodPath += `${i === 0 ? "M" : "L"} ${xFor(i)} ${y} `;
    }
  });

  const dayTicks: { i: number; label: string }[] = [];
  let lastDay = "";
  points.forEach((p, i) => {
    const d = new Date(p.time);
    const day = d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
    if (day !== lastDay) {
      dayTicks.push({ i, label: day });
      lastDay = day;
    }
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="wind-chart surf-chart" role="img" aria-label="Surf face height forecast chart">
      {[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const v = yMax * f;
        return (
          <g key={f}>
            <line x1={padding.left} x2={width - padding.right} y1={yFor(v)} y2={yFor(v)} className="chart-gridline" />
            <text x={padding.left - 8} y={yFor(v) + 4} textAnchor="end" className="chart-axis-label">
              {v.toFixed(1)}m
            </text>
          </g>
        );
      })}

      {/* Bars for Surf Face Height in Meters */}
      {points.map((p, i) => {
        const minM = p.surfHeightMMin ?? 0;
        const maxBarM = p.surfHeightMMax ?? 0.3;
        const yTop = yFor(maxBarM);
        const yBot = yFor(minM);
        const barH = Math.max(4, yBot - yTop);
        const color = SURF_RATING_COLOR[p.surfRating ?? "fair"];

        return (
          <g key={p.time}>
            <rect
              x={xFor(i) - barWidth / 2}
              y={yTop}
              width={barWidth}
              height={barH}
              fill={color}
              rx={2}
              opacity={0.85}
            >
              <title>{`${new Date(p.time).toLocaleString()}: ${minM.toFixed(1)}–${maxBarM.toFixed(1)} m (${SURF_RATING_LABEL[p.surfRating ?? "fair"]})`}</title>
            </rect>
          </g>
        );
      })}

      {/* Swell Period Line Overlay */}
      {periodPath && (
        <path d={periodPath} fill="none" stroke="#38bdf8" strokeWidth={1.75} strokeDasharray="3 3" opacity={0.8} />
      )}

      {dayTicks.map((t) => (
        <text key={t.i} x={xFor(t.i)} y={height - 6} textAnchor="middle" className="chart-axis-label">
          {t.label}
        </text>
      ))}
    </svg>
  );
}
