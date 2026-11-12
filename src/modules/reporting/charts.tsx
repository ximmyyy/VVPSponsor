"use client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/** Logoblauw, logo-oranje en aqua: gevalideerd (CVD ΔE 11,1; oranje/aqua < 3:1 → legenda + tabel). */
export const SERIES = {
  contract: "#045EA7",
  invoiced: "#EA751D",
  received: "#1baf7a",
} as const;
const GRID = "#e6ecf2";
const AXIS = "#56687c";
const TEXT = "#16263a";

const euro = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const euroCents = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});
/** Eén notatie per as: volledig onder 10.000, anders compact (3,5k / 14k / 1,2 mln). */
function axisFormatter(max: number) {
  return (value: number) => {
    if (max >= 1_000_000)
      return `€ ${(value / 1_000_000).toLocaleString("nl-NL", { maximumFractionDigits: 1 })} mln`;
    if (max >= 10_000)
      return `€ ${(value / 1000).toLocaleString("nl-NL", { maximumFractionDigits: 1 })}k`;
    return euro.format(value);
  };
}
const maxOf = (rows: Record<string, unknown>[], keys: string[]) =>
  Math.max(
    0,
    ...rows.flatMap((r) => keys.map((k) => Math.abs(Number(r[k]) || 0))),
  );

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="dash-tooltip">
      <p className="dash-tooltip-title">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="dash-tooltip-row">
          <span
            className="dash-swatch"
            style={{ background: p.color }}
            aria-hidden="true"
          />
          <span>{p.name}</span>
          <strong>{euroCents.format(p.value)}</strong>
        </p>
      ))}
    </div>
  );
}

function LegendKeys({ items }: { items: [string, string][] }) {
  return (
    <ul className="dash-legend" aria-label="Legenda">
      {items.map(([label, color]) => (
        <li key={label}>
          <span
            className="dash-swatch"
            style={{ background: color }}
            aria-hidden="true"
          />
          {label}
        </li>
      ))}
    </ul>
  );
}

const axisProps = {
  tick: { fill: AXIS, fontSize: 12 },
  tickLine: false,
  axisLine: { stroke: GRID },
} as const;

export function SeasonChart({
  data,
}: {
  data: {
    label: string;
    contract_value: number;
    invoiced: number;
    received: number;
  }[];
}) {
  const axisEuro = axisFormatter(
    maxOf(data, ["contract_value", "invoiced", "received"]),
  );
  return (
    <>
      <LegendKeys
        items={[
          ["Contractwaarde", SERIES.contract],
          ["Gefactureerd", SERIES.invoiced],
          ["Ontvangen", SERIES.received],
        ]}
      />
      <div
        className="dash-chart"
        role="img"
        aria-label="Staafdiagram per seizoen: contractwaarde, gefactureerd en ontvangen. Zie de tabelweergave voor de waarden."
      >
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={data}
            margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
            barGap={2}
            barCategoryGap="28%"
          >
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis
              tickFormatter={axisEuro}
              width={72}
              {...axisProps}
              axisLine={false}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ fill: "rgba(4,94,167,0.06)" }}
            />
            <Bar
              dataKey="contract_value"
              name="Contractwaarde"
              fill={SERIES.contract}
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
            />
            <Bar
              dataKey="invoiced"
              name="Gefactureerd"
              fill={SERIES.invoiced}
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
            />
            <Bar
              dataKey="received"
              name="Ontvangen"
              fill={SERIES.received}
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

export function MonthlyChart({
  data,
}: {
  data: {
    label: string;
    invoiced_cumulative: number | null;
    received_cumulative: number | null;
  }[];
}) {
  const axisEuro = axisFormatter(
    maxOf(data, ["invoiced_cumulative", "received_cumulative"]),
  );
  return (
    <>
      <LegendKeys
        items={[
          ["Gefactureerd (cumulatief)", SERIES.invoiced],
          ["Ontvangen (cumulatief)", SERIES.received],
        ]}
      />
      <div
        className="dash-chart"
        role="img"
        aria-label="Lijndiagram van cumulatief gefactureerd en ontvangen per maand in het seizoen. Zie de tabelweergave voor de waarden."
      >
        <ResponsiveContainer width="100%" height={280}>
          <LineChart
            data={data}
            margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
          >
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" />
            <YAxis
              tickFormatter={axisEuro}
              width={72}
              {...axisProps}
              axisLine={false}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ stroke: AXIS, strokeWidth: 1 }}
            />
            <Line
              type="monotone"
              dataKey="invoiced_cumulative"
              name="Gefactureerd"
              stroke={SERIES.invoiced}
              strokeWidth={2}
              strokeLinecap="round"
              dot={false}
              activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }}
            />
            <Line
              type="monotone"
              dataKey="received_cumulative"
              name="Ontvangen"
              stroke={SERIES.received}
              strokeWidth={2}
              strokeLinecap="round"
              dot={false}
              activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

export function TopSponsorsChart({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  const axisEuro = axisFormatter(maxOf(data, ["value"]));
  const height = Math.max(120, data.length * 36 + 24);
  return (
    <div
      className="dash-chart"
      role="img"
      aria-label="Horizontaal staafdiagram van de sponsors met de hoogste contractwaarde dit seizoen. Zie de tabelweergave voor de waarden."
    >
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 88, left: 0, bottom: 0 }}
          barCategoryGap="30%"
        >
          <CartesianGrid horizontal={false} stroke={GRID} />
          <XAxis type="number" tickFormatter={axisEuro} {...axisProps} />
          <YAxis
            type="category"
            dataKey="name"
            width={170}
            tick={{ fill: TEXT, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: string) =>
              v.length > 22 ? `${v.slice(0, 21)}…` : v
            }
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ fill: "rgba(4,94,167,0.06)" }}
          />
          <Bar
            dataKey="value"
            name="Contractwaarde"
            fill={SERIES.contract}
            radius={[0, 4, 4, 0]}
            maxBarSize={20}
          >
            <LabelList
              dataKey="value"
              position="right"
              formatter={(v: unknown) => axisEuro(Number(v))}
              fill={TEXT}
              fontSize={12}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
