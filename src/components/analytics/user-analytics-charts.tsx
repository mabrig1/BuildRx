"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { UserAnalytics } from "@/lib/analytics/user-data";

/** Same validated categorical palette as the admin dashboard (admin-charts.tsx) — kept in sync for visual consistency across the two analytics surfaces. */
const chartVars = `
.user-viz {
  --viz-cat-1: #2a78d6;
  --viz-cat-2: #008300;
  --viz-cat-3: #e87ba4;
  --viz-cat-4: #b06a2f;
  --viz-grid: color-mix(in oklab, currentColor 12%, transparent);
  --viz-text: var(--muted-foreground);
}
.dark .user-viz {
  --viz-cat-1: #3987e5;
  --viz-cat-2: #008300;
  --viz-cat-3: #d55181;
  --viz-cat-4: #c98247;
}
`;

const SLOTS = ["var(--viz-cat-1)", "var(--viz-cat-2)", "var(--viz-cat-3)", "var(--viz-cat-4)"];

function shortDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

interface TooltipPayload {
  active?: boolean;
  label?: string | number;
  payload?: Array<{ value?: number | string }>;
  formatter?: (value: number | string) => string;
  labelDate?: boolean;
}

function ChartTooltip({ active, label, payload, formatter, labelDate }: TooltipPayload) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value ?? "";
  const heading = labelDate && typeof label === "string" ? shortDate(label) : label;
  return (
    <div className="bg-popover text-popover-foreground rounded-md border px-2.5 py-1.5 text-xs shadow-md">
      <p className="text-muted-foreground">{heading}</p>
      <p className="font-medium tabular-nums">{formatter ? formatter(value) : value}</p>
    </div>
  );
}

export function UserAnalyticsCharts({ data }: { data: UserAnalytics }) {
  const axisStyle = { fontSize: 11, fill: "var(--viz-text)" };

  return (
    <div className="user-viz grid gap-4 lg:grid-cols-2">
      <style dangerouslySetInnerHTML={{ __html: chartVars }} />

      <Card>
        <CardHeader>
          <CardTitle>Requests over time</CardTitle>
          <CardDescription>AI requests per day · last 30 days</CardDescription>
        </CardHeader>
        <CardContent className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.requestsByDay} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
              <XAxis
                dataKey="date"
                tickFormatter={shortDate}
                tick={axisStyle}
                tickLine={false}
                axisLine={false}
                interval={6}
              />
              <YAxis tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                content={<ChartTooltip formatter={(v) => `${v} requests`} labelDate />}
                cursor={{ stroke: "var(--viz-grid)" }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="var(--viz-cat-1)"
                strokeWidth={2}
                fill="var(--viz-cat-1)"
                fillOpacity={0.12}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>By feature</CardTitle>
          <CardDescription>Requests by action · last 30 days</CardDescription>
        </CardHeader>
        <CardContent className="h-56">
          {data.requestsByAction.length === 0 ? (
            <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
              No activity yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.requestsByAction.map((row) => ({
                  ...row,
                  label: row.key.replace(/_/g, " "),
                }))}
                layout="vertical"
                margin={{ top: 0, right: 16, left: -8, bottom: 0 }}
              >
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ ...axisStyle, fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={96}
                />
                <Tooltip
                  content={<ChartTooltip formatter={(v) => `${v} requests`} />}
                  cursor={{ fill: "var(--viz-grid)" }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={22}>
                  {data.requestsByAction.map((row, index) => (
                    <Cell key={row.key} fill={SLOTS[index % SLOTS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>By provider</CardTitle>
          <CardDescription>Requests by AI provider · last 30 days</CardDescription>
        </CardHeader>
        <CardContent className="h-44">
          {data.requestsByProvider.length === 0 ? (
            <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
              No activity yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.requestsByProvider} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
                <XAxis dataKey="key" tick={axisStyle} tickLine={false} axisLine={false} />
                <YAxis tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  content={<ChartTooltip formatter={(v) => `${v} requests`} />}
                  cursor={{ fill: "var(--viz-grid)" }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {data.requestsByProvider.map((row, index) => (
                    <Cell key={row.key} fill={SLOTS[index % SLOTS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
