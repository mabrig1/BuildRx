"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
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
import type { AdminAnalytics } from "@/lib/analytics/admin-data";

/**
 * Validated categorical palette (dataviz reference instance):
 * slots 1–3, light/dark selected per surface. Single-series charts use
 * slot 1; the revenue chart assigns slots in fixed plan order with
 * direct value labels (contrast relief for the light magenta slot).
 */
const chartVars = `
.admin-viz {
  --viz-cat-1: #2a78d6;
  --viz-cat-2: #008300;
  --viz-cat-3: #e87ba4;
  --viz-grid: color-mix(in oklab, currentColor 12%, transparent);
  --viz-text: var(--muted-foreground);
}
.dark .admin-viz {
  --viz-cat-1: #3987e5;
  --viz-cat-2: #008300;
  --viz-cat-3: #d55181;
}
`;

const PLAN_SLOTS = ["var(--viz-cat-1)", "var(--viz-cat-2)", "var(--viz-cat-3)"];

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

function ChartTooltip({
  active,
  label,
  payload,
  formatter,
  labelDate,
}: TooltipPayload) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value ?? "";
  const heading =
    labelDate && typeof label === "string" ? shortDate(label) : label;
  return (
    <div className="bg-popover text-popover-foreground rounded-md border px-2.5 py-1.5 text-xs shadow-md">
      <p className="text-muted-foreground">{heading}</p>
      <p className="font-medium tabular-nums">
        {formatter ? formatter(value) : value}
      </p>
    </div>
  );
}

export function AdminCharts({ data }: { data: AdminAnalytics }) {
  const axisStyle = { fontSize: 11, fill: "var(--viz-text)" };

  return (
    <div className="admin-viz grid gap-4 lg:grid-cols-2">
      <style dangerouslySetInnerHTML={{ __html: chartVars }} />

      {/* Signups — change over time, single series (slot 1; no legend) */}
      <Card>
        <CardHeader>
          <CardTitle>Signups</CardTitle>
          <CardDescription>New users per day · last 30 days</CardDescription>
        </CardHeader>
        <CardContent className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.signupsByDay} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
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
                content={
                  <ChartTooltip formatter={(v) => `${v} signups`} labelDate />
                }
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

      {/* AI requests — change over time, single series */}
      <Card>
        <CardHeader>
          <CardTitle>AI requests</CardTitle>
          <CardDescription>Requests per day · last 14 days</CardDescription>
        </CardHeader>
        <CardContent className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.aiRequestsByDay} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
              <XAxis
                dataKey="date"
                tickFormatter={shortDate}
                tick={axisStyle}
                tickLine={false}
                axisLine={false}
                interval={2}
              />
              <YAxis tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                content={
                  <ChartTooltip formatter={(v) => `${v} requests`} labelDate />
                }
                cursor={{ fill: "var(--viz-grid)" }}
              />
              <Bar
                dataKey="count"
                fill="var(--viz-cat-1)"
                radius={[4, 4, 0, 0]}
                maxBarSize={22}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Revenue by plan — magnitude comparison, categorical slots in
          fixed plan order + direct value labels */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Revenue by plan</CardTitle>
          <CardDescription>
            Monthly recurring revenue ·{" "}
            {data.revenueByPlan.reduce((s, p) => s + p.subscribers, 0)}{" "}
            subscribers
          </CardDescription>
        </CardHeader>
        <CardContent className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data.revenueByPlan}
              layout="vertical"
              margin={{ top: 0, right: 56, left: -8, bottom: 0 }}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="plan"
                tick={{ ...axisStyle, fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={64}
              />
              <Tooltip
                content={
                  <ChartTooltip formatter={(v) => `$${Number(v).toLocaleString()} MRR`} />
                }
                cursor={{ fill: "var(--viz-grid)" }}
              />
              <Bar dataKey="mrr" radius={[0, 4, 4, 0]} maxBarSize={22}>
                {data.revenueByPlan.map((entry, index) => (
                  <Cell
                    key={entry.plan}
                    fill={PLAN_SLOTS[index % PLAN_SLOTS.length]}
                  />
                ))}
                <LabelList
                  dataKey="mrr"
                  position="right"
                  formatter={(value) =>
                    `$${Number(value).toLocaleString()}`
                  }
                  className="fill-foreground"
                  fontSize={12}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
