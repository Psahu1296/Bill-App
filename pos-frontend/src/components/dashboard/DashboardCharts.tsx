import React from "react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from "recharts";

interface ChartData {
  labels: string[];
  income: number[];
  expenses: number[];
  orders: number[];
}

interface TopDish {
  name: string;
  totalRevenue: number;
  totalQuantity: number;
  orderCount: number;
}

interface PaymentSplit {
  cash: number;
  upi: number;
  card: number;
  credit: number;
}

interface DashboardChartsProps {
  data: ChartData | undefined;
  isLoading: boolean;
  period: string;
  customRange?: { from: string; to: string };
  topDishes?: TopDish[];
  paymentSplit?: PaymentSplit;
  avgOrderValue?: number;
}

const LABEL: Record<string, string> = {
  day: "Today (hourly)", week: "This Week (daily)",
  month: "This Month (daily)", year: "This Year (monthly)",
};

const PERIOD_LABEL: Record<string, string> = {
  day: "Today", week: "This Week", month: "This Month", year: "This Year",
};

function customLabel(range: { from: string; to: string }): string {
  return `${range.from} → ${range.to} (daily)`;
}

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DishTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as TopDish;
  return (
    <div className="glass-card rounded-xl px-4 py-3 text-xs space-y-1.5 border border-dhaba-border/30">
      <p className="font-bold text-dhaba-text mb-2 max-w-[160px] truncate">{d.name}</p>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-dhaba-accent" />
        <span className="text-dhaba-muted">Revenue:</span>
        <span className="font-bold text-dhaba-text">₹{d.totalRevenue.toLocaleString("en-IN")}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-dhaba-warning" />
        <span className="text-dhaba-muted">Qty sold:</span>
        <span className="font-bold text-dhaba-text">{d.totalQuantity}</span>
      </div>
    </div>
  );
};

const PAYMENT_COLORS: Record<string, string> = {
  cash:   "hsl(142 60% 45%)",
  upi:    "hsl(217 91% 60%)",
  card:   "hsl(42 96% 56%)",
  credit: "hsl(0 72% 51%)",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PaymentTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="glass-card rounded-xl px-4 py-3 text-xs border border-dhaba-border/30">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full" style={{ background: p.payload.fill }} />
        <span className="text-dhaba-muted capitalize">{p.name}:</span>
        <span className="font-bold text-dhaba-text">{p.value} orders</span>
      </div>
    </div>
  );
};

const DashboardCharts: React.FC<DashboardChartsProps> = ({
  data, isLoading, period, customRange, topDishes, paymentSplit, avgOrderValue,
}) => {
  const chartSubLabel = period === "custom" && customRange
    ? customLabel(customRange)
    : (LABEL[period] ?? period);
  const chartData = data?.labels.map((label, i) => ({
    label,
    income:   data.income[i]   ?? 0,
    expenses: data.expenses[i] ?? 0,
    profit:   (data.income[i] ?? 0) - (data.expenses[i] ?? 0),
    orders:   data.orders[i]   ?? 0,
  })) ?? [];

  const tickStyle = { fill: "hsl(30 8% 55%)", fontSize: 11 };

  const pieData = paymentSplit
    ? Object.entries(paymentSplit)
        .filter(([, v]) => v > 0)
        .map(([name, value]) => ({ name, value, fill: PAYMENT_COLORS[name] ?? "hsl(30 8% 55%)" }))
    : [];

  const totalPayments = pieData.reduce((s, d) => s + d.value, 0);

  if (isLoading) {
    return (
      <div className="mt-8 space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="glass-card rounded-2xl p-5 h-52 animate-pulse bg-dhaba-surface/40" />
        ))}
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-4">
      {/* ── Income vs Expenses + Profit ── */}
      <div className="glass-card rounded-2xl p-5">
        <div className="mb-4">
          <h3 className="font-display font-bold text-dhaba-text text-base">Income vs Expenses</h3>
          <p className="text-xs text-dhaba-muted mt-0.5">{chartSubLabel}</p>
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
              <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="hsl(217 91% 60%)" stopOpacity={0.2} />
                <stop offset="95%" stopColor="hsl(217 91% 60%)" stopOpacity={0} />
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
            <Area type="monotone" dataKey="profit"   stroke="hsl(217 91% 60%)" strokeWidth={1.5} strokeDasharray="4 3" fill="url(#profitGrad)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Order Count ── */}
      <div className="glass-card rounded-2xl p-5">
        <div className="mb-4">
          <h3 className="font-display font-bold text-dhaba-text text-base">Orders</h3>
          <p className="text-xs text-dhaba-muted mt-0.5">{chartSubLabel}</p>
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

      {/* ── Top Dishes by Revenue ── */}
      {topDishes && topDishes.length > 0 && (
        <div className="glass-card rounded-2xl p-5">
          <div className="mb-4">
            <h3 className="font-display font-bold text-dhaba-text text-base">Top Dishes by Revenue</h3>
            <p className="text-xs text-dhaba-muted mt-0.5">
              {period === "custom" && customRange
                ? `${customRange.from} → ${customRange.to}`
                : (PERIOD_LABEL[period] ?? period)}
            </p>
          </div>
          <ResponsiveContainer width="100%" height={topDishes.length * 44 + 20}>
            <BarChart
              data={topDishes}
              layout="vertical"
              margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
              barCategoryGap="25%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(25 8% 22% / 0.4)" horizontal={false} />
              <XAxis
                type="number" tick={tickStyle} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`}
              />
              <YAxis
                type="category" dataKey="name" tick={tickStyle} axisLine={false} tickLine={false}
                width={110}
                tickFormatter={v => v.length > 14 ? v.slice(0, 13) + "…" : v}
              />
              <Tooltip content={<DishTooltip />} cursor={{ fill: "hsl(25 8% 22% / 0.3)" }} />
              <Bar dataKey="totalRevenue" fill="hsl(var(--dhaba-accent))" radius={[0, 4, 4, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Payment Split + Avg Order Value ── */}
      {pieData.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Donut */}
          <div className="glass-card rounded-2xl p-5">
            <div className="mb-2">
              <h3 className="font-display font-bold text-dhaba-text text-base">Payment Methods</h3>
              <p className="text-xs text-dhaba-muted mt-0.5">Today's order split</p>
            </div>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie
                    data={pieData} cx="50%" cy="50%"
                    innerRadius={40} outerRadius={62}
                    dataKey="value" paddingAngle={3}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip content={<PaymentTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2 flex-1">
                {pieData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.fill }} />
                      <span className="text-xs text-dhaba-muted capitalize">{d.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-dhaba-text">{d.value}</span>
                      <span className="text-[10px] text-dhaba-muted">
                        ({Math.round((d.value / totalPayments) * 100)}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Avg Order Value stat */}
          {avgOrderValue != null && (
            <div className="glass-card rounded-2xl p-5 flex flex-col justify-between">
              <div>
                <h3 className="font-display font-bold text-dhaba-text text-base">Avg Order Value</h3>
                <p className="text-xs text-dhaba-muted mt-0.5">Today's average</p>
              </div>
              <div>
                <p className="font-display text-4xl font-black text-dhaba-accent mt-4">
                  ₹{avgOrderValue.toLocaleString("en-IN")}
                </p>
                <p className="text-xs text-dhaba-muted mt-1">per completed order</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DashboardCharts;
