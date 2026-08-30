import type { RatedPoint } from "../lib/types";

const RATING_COLOR: Record<string, string> = {
  good: "#22c55e",
  fair: "#eab308",
  poor: "#ef4444",
};

interface Props {
  points: RatedPoint[];
}

export function WindChart({ points }: Props) {
  if (points.length === 0) return null;

  const width = 900;
  const height = 220;
  const padding = { top: 16, right: 16, bottom: 28, left: 40 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const maxGust = Math.max(...points.map((p) => p.windGustKt), 20);
  const yMax = Math.ceil(maxGust / 5) * 5 + 5;

  const xFor = (i: number) => padding.left + (i / (points.length - 1)) * plotW;
  const yFor = (v: number) => padding.top + plotH - (v / yMax) * plotH;

  const speedPath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(p.windSpeedKt)}`).join(" ");
  const gustPath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(p.windGustKt)}`).join(" ");

  const altPath = points
    .map((p, i) => (p.altWindSpeedKt == null ? null : `${xFor(i)} ${yFor(p.altWindSpeedKt)}`))
    .reduce<{ d: string; started: boolean }>(
      (acc, coord) => {
        if (coord == null) return { ...acc, started: false };
        return { d: acc.d + `${acc.started ? "L" : "M"} ${coord} `, started: true };
      },
      { d: "", started: false },
    ).d;

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
          x={xFor(i) - plotW / points.length / 2}
          y={padding.top}
          width={plotW / points.length}
          height={plotH}
          fill={RATING_COLOR[p.rating]}
          opacity={0.08}
        />
      ))}

      <path d={gustPath} fill="none" stroke="var(--chart-gust)" strokeWidth={1.5} strokeDasharray="4 3" />
      {altPath && <path d={altPath} fill="none" stroke="var(--chart-alt)" strokeWidth={1.5} strokeDasharray="2 2" />}
      <path d={speedPath} fill="none" stroke="var(--chart-speed)" strokeWidth={2.5} />

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
