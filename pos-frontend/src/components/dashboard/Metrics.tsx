import React from "react";
import { itemsData } from "../../constants";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  getDashboardEarningsSummary,
  getExpensesByPeriod,
} from "../../https";
import MatrixCard from "../matrix/MatrixCard";
import type { MetricItem } from "../../types";

const METRICS_TYPES = [
  { value: "day", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "year", label: "This Year" },
];

const TypeMap: Record<string, string> = {
  day: "daily",
  week: "weekly",
  month: "monthly",
  year: "yearly",
};

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

  const handleInputChange = (type: (typeof METRICS_TYPES)[0]) => {
    setMetrics(type);
  };

  const earningsData = resData?.data?.data as
    | Record<string, { total: number; percentageChange: number }>
    | undefined;
  const earnings = earningsData?.[TypeMap[metrics.value]];
  const total = Math.floor(earnings?.total ?? 0);
  const percent = earnings?.percentageChange ?? 0;

  const expensesTotal = (
    todayDailyExpenses?.data?.data as { totalExpenses?: number } | undefined
  )?.totalExpenses;

  return (
    <div className="container mx-auto py-2 px-6 md:px-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="font-semibold text-[#f5f5f5] text-xl">
            Overall Performance
          </h2>
          <p className="text-sm text-[#ababab]">
            Lorem, ipsum dolor sit amet consectetur adipisicing elit.
            Distinctio, obcaecati?
          </p>
        </div>
        <select
          name="type"
          value={metrics.value}
          onChange={(e) => {
            const selected = METRICS_TYPES.find(
              (t) => t.value === e.target.value
            );
            if (selected) handleInputChange(selected);
          }}
          className="bg-[#1a1a1a] text-white px-3 py-3 rounded-md"
        >
          {METRICS_TYPES.map((type) => (
            <option
              key={type.value}
              value={type.value}
              className="bg-[#262626] text-white"
            >
              {type.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6 grid grid-cols-4 gap-4">
        <MatrixCard
          metric={{
            title: "Expenses",
            value: expensesTotal ?? "No Data",
            percentage: undefined,
            color: "#025cca",
            isIncrease: false,
          }}
        />
        <MatrixCard
          metric={{
            title: "Income",
            value: total,
            percentage: percent ? `${percent}%` : undefined,
            color: "#2888137f",
            isIncrease: false,
          }}
        />
      </div>

      <div className="flex flex-col justify-between mt-12">
        <div>
          <h2 className="font-semibold text-[#f5f5f5] text-xl">
            Item Details
          </h2>
          <p className="text-sm text-[#ababab]">
            Lorem, ipsum dolor sit amet consectetur adipisicing elit.
            Distinctio, obcaecati?
          </p>
        </div>
        <div className="mt-6 grid grid-cols-4 gap-4">
          {itemsData.map((item: MetricItem, index: number) => (
            <div
              key={index}
              className="shadow-sm rounded-lg p-4"
              style={{ backgroundColor: item.color }}
            >
              <div className="flex justify-between items-center">
                <p className="font-medium text-xs text-[#f5f5f5]">
                  {item.title}
                </p>
                <div className="flex items-center gap-1">
                  <svg
                    className="w-3 h-3 text-white"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  >
                    <path d="M5 15l7-7 7 7" />
                  </svg>
                  <p className="font-medium text-xs text-[#f5f5f5]">
                    {item.percentage}
                  </p>
                </div>
              </div>
              <p className="mt-1 font-semibold text-2xl text-[#f5f5f5]">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Metrics;
