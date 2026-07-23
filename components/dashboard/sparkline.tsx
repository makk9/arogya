/*
 * Inline SVG sparkline — the §6.1 "sparklines + trend arrows" mark for
 * summary-card stat tiles, reused at a larger size as the vitals history
 * page's per-type trend chart. Server-renderable (no interactivity — the
 * table beside/below it is the data view).
 *
 * Mark spec (dataviz skill): the series line is the de-emphasis hue with the
 * current period in the accent — final segment + end dot in `--primary`,
 * earlier span in muted ink. Values/labels never wear the series color. A
 * single series needs no legend; the optional secondary series (BP diastolic)
 * is a lighter shade of the same ink with a direct end label supplied by the
 * caller, not a legend box.
 *
 * Points are index-spaced (standard sparkline practice); exact dates live in
 * the adjacent table/labels, so uneven gaps between readings are not encoded.
 */

interface SparklineProps {
  /** Chronological (oldest → newest) numeric values. */
  points: number[];
  /** Optional second series, same order (e.g. BP diastolic). */
  secondary?: number[];
  width?: number;
  height?: number;
  className?: string;
}

const PAD = 3;

interface Domain {
  min: number;
  span: number;
}

function xy(
  values: number[],
  width: number,
  height: number,
  { min, span }: Domain,
): Array<[number, number]> {
  const stepX = values.length > 1 ? (width - PAD * 2) / (values.length - 1) : 0;
  return values.map((v, i) => [
    PAD + i * stepX,
    height - PAD - ((v - min) / span) * (height - PAD * 2),
  ]);
}

function toPath(coords: Array<[number, number]>): string {
  return coords
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
}

const LINE = {
  fill: "none",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function Sparkline({
  points,
  secondary,
  width = 96,
  height = 28,
  className,
}: SparklineProps) {
  if (points.length < 2) return null;

  // One shared y-domain across both series so their vertical relation is true.
  const all = secondary && secondary.length >= 2 ? [...points, ...secondary] : points;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const domain: Domain = { min, span: max - min || 1 };

  const coords = xy(points, width, height, domain);
  const [endX, endY] = coords[coords.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden
      className={className}
    >
      {secondary && secondary.length >= 2 ? (
        <path
          d={toPath(xy(secondary, width, height, domain))}
          className="stroke-muted-foreground/30"
          {...LINE}
        />
      ) : null}
      <path d={toPath(coords)} className="stroke-muted-foreground/50" {...LINE} />
      {/* Current period in the accent: the final segment + end dot. */}
      <path d={toPath(coords.slice(-2))} className="stroke-primary" {...LINE} />
      <circle cx={endX} cy={endY} r={2.5} className="fill-primary" />
    </svg>
  );
}

/**
 * Direction of the latest move, latest vs. previous value. Rendered as a
 * neutral glyph — deliberately NOT colored by direction: whether "up" is good
 * is a clinical judgment (BP up ≠ SpO₂ up), and the hard rules forbid the UI
 * implying one. The per-reading `flag` field is where clinical judgment lives.
 */
export function trendArrow(points: number[]): "↑" | "↓" | "→" | null {
  if (points.length < 2) return null;
  const delta = points[points.length - 1] - points[points.length - 2];
  if (delta > 0) return "↑";
  if (delta < 0) return "↓";
  return "→";
}
