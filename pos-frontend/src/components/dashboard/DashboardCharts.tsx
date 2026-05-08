import React from "react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";

interface ChartData {
  labels: string[];
  income: number[];
  expenses: number[];
  orders: number[];
}

interface DashboardChartsProps {
  data: ChartData | undefined;
  isLoading: boolean;
  period: string;
}

const LABEL: Record<string, string> = {
  day: "Today (hourly)", week: "This Week (daily)",
  month: "This Month (daily)", year: "This Year (monthly)",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FinancialTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card rounded-xl px-4 py-3 text-xs space-y-1.5 border border-dhaba-border/30">
      <p className="font-bold text-dhaba-muted uppercase tracking-wider mb-2">{label}</p>
      {payload.map((p: { name: string; value: number; color: string }) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-dhaba-muted capitalize">{p.name}:</span>
          <span className="font-bold text-dhaba-text">₹{p.value.toLocaleString("en-IN")}</span>
        </div>
      ))}
    </div>
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const OrdersTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card rounded-xl px-4 py-3 text-xs border border-dhaba-border/30">
      <p className="font-bold text-dhaba-muted uppercase tracking-wider mb-2">{label}</p>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-dhaba-accent" />
        <span className="text-dhaba-muted">Orders:</span>
        <span className="font-bold text-dhaba-text">{payload[0].value}</span>
      </div>
    </div>
  );
};

const DashboardCharts: React.FC<DashboardChartsProps> = ({ data, isLoading, period }) => {
  const chartData = data?.labels.map((label, i) => ({
    label,
    income:   data.income[i]   ?? 0,
    expenses: data.expenses[i] ?? 0,
    orders:   data.orders[i]   ?? 0,
  })) ?? [];

  const tickStyle = { fill: "hsl(30 8% 55%)", fontSize: 11 };

  if (isLoading) {
    return (
      <div className="mt-8 space-y-4">
        {[1, 2].map(i => (
          <div key={i} className="glass-card rounded-2xl p-5 h-52 animate-pulse bg-dhaba-surface/40" />
        ))}
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-4">
      {/* ── Income vs Expenses ── */}
      <div className="glass-card rounded-2xl p-5">
        <div className="mb-4">
          <h3 className="font-display font-bold text-dhaba-text text-base">Income vs Expenses</h3>
          <p className="text-xs text-dhaba-muted mt-0.5">{LABEL[period]}</p>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="hsl(142 60% 45%)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="hsl(142 60% 45%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="hsl(0 72% 51%)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="hsl(0 72% 51%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(25 8% 22% / 0.4)" vertical={false} />
            <XAxis dataKey="label" tick={tickStyle} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis
              tick={tickStyle} axisLine={false} tickLine={false} width={55}
              tickFormatter={v => v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`}
            />
            <Tooltip content={<FinancialTooltip />} cursor={{ stroke: "hsl(25 8% 22%)", strokeWidth: 1 }} />
            <Legend
              iconType="circle" iconSize={8}
              formatter={v => <span style={{ color: "hsl(30 8% 55%)", fontSize: 11, textTransform: "capitalize" }}>{v}</span>}
            />
            <Area type="monotone" dataKey="income"   stroke="hsl(142 60% 45%)" strokeWidth={2} fill="url(#incomeGrad)"  dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
            <Area type="monotone" dataKey="expenses" stroke="hsl(0 72% 51%)"   strokeWidth={2} fill="url(#expenseGrad)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Order Count ── */}
      <div className="glass-card rounded-2xl p-5">
        <div className="mb-4">
          <h3 className="font-display font-bold text-dhaba-text text-base">Orders</h3>
          <p className="text-xs text-dhaba-muted mt-0.5">{LABEL[period]}</p>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }} barCategoryGap="40%">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(25 8% 22% / 0.4)" vertical={false} />
            <XAxis dataKey="label" tick={tickStyle} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={tickStyle} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
            <Tooltip content={<OrdersTooltip />} cursor={{ fill: "hsl(25 8% 22% / 0.3)" }} />
            <Bar dataKey="orders" fill="hsl(42 96% 56%)" radius={[4, 4, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default DashboardCharts;
