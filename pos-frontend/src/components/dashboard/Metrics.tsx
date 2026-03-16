import React from "react";
import { itemsData } from "../../constants";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getDashboardEarningsSummary, getExpensesByPeriod } from "../../https";
import MatrixCard from "../matrix/MatrixCard";
import type { MetricItem } from "../../types";

const METRICS_TYPES = [
  { value: "day", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "year", label: "This Year" },
];

const TypeMap: Record<string, string> = { day: "daily", week: "weekly", month: "monthly", year: "yearly" };

const Metrics: React.FC = () => {
  const [metrics, setMetrics] = React.useState(METRICS_TYPES[0]);

  const { data: todayDailyExpenses } = useQuery({
    queryKey: ["expensesSummary", "day", metrics.value],
    queryFn: () => getExpensesByPeriod(metrics.value),
  });

  const { data: resData } = useQuery({
    queryKey: ["earnings"],
    queryFn: () => getDashboardEarningsSummary(),
    placeholderData: keepPreviousData,
  });

  const earningsData = resData?.data?.data as Record<string, { total: number; percentageChange: number }> | undefined;
  const earnings = earningsData?.[TypeMap[metrics.value]];
  const total = Math.floor(earnings?.total ?? 0);
  const percent = earnings?.percentageChange ?? 0;
  const expensesTotal = (todayDailyExpenses?.data?.data as { totalExpenses?: number } | undefined)?.totalExpenses;

  return (
    <div className="container mx-auto px-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="font-display text-xl font-bold text-dhaba-text">Overall Performance</h2>
          <p className="text-sm text-dhaba-muted mt-1">Track your dhaba's growth and metrics</p>
        </div>
        <select
          value={metrics.value}
          onChange={(e) => {
            const selected = METRICS_TYPES.find((t) => t.value === e.target.value);
            if (selected) setMetrics(selected);
          }}
          className="glass-input rounded-xl px-4 py-2.5 text-dhaba-text text-sm font-medium focus:outline-none appearance-none"
        >
          {METRICS_TYPES.map((type) => (
            <option key={type.value} value={type.value} className="bg-dhaba-surface text-dhaba-text">{type.label}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-10">
        <MatrixCard metric={{ title: "Expenses", value: expensesTotal != null ? `₹${expensesTotal}` : "No Data", percentage: undefined, color: "hsl(var(--dhaba-danger))", isIncrease: false }} />
        <MatrixCard metric={{ title: "Income", value: `₹${total.toLocaleString()}`, percentage: percent ? `${percent}%` : undefined, color: "hsl(var(--dhaba-success))", isIncrease: percent >= 0 }} />
      </div>

      <div>
        <h2 className="font-display text-xl font-bold text-dhaba-text mb-2">Item Details</h2>
        <p className="text-sm text-dhaba-muted mb-6">Quick overview of your inventory stats</p>
        <div className="grid grid-cols-4 gap-4">
          {itemsData.map((item: MetricItem, index: number) => (
            <div key={index} className="glass-card rounded-2xl p-5 hover:shadow-glow transition-all duration-200">
              <div className="flex justify-between items-center">
                <p className="text-dhaba-muted text-xs font-bold tracking-wider uppercase">{item.title}</p>
                {item.percentage && (
                  <span className="text-xs font-bold text-dhaba-success bg-dhaba-success/15 px-2 py-0.5 rounded-full">
                    ↑ {item.percentage}
                  </span>
                )}
              </div>
              <p className="mt-3 font-display text-3xl font-bold text-dhaba-text">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Metrics;
