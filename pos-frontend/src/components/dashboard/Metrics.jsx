import React, { useEffect, useMemo } from "react";
import { itemsData, metricsData } from "../../constants";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  getDailyEarnings,
  getDashboardEarningsSummary,
  getExpensesByPeriod,
  getPeriodEarnings,
} from "../../https";
import MatrixCard from "../matrix/MatrixCard";

const METRICS_TYPES = [
  { value: "day", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "year", label: "This Year" },
];

const TypeMap = {
  day: "daily",
  week: "weekly",
  month: "monthly",
  year: "yearly",
};
const Metrics = () => {
  const [metrics, setMetrics] = React.useState(METRICS_TYPES[0]);
  const {
    data: todayDailyExpenses,
    isLoading: loadingDaily,
    isError: errorDaily,
    refetch: refetchDaily,
  } = useQuery({
    queryKey: ["expensesSummary", "day", metrics.value], // Key for today's daily expenses
    queryFn: () => getExpensesByPeriod(metrics.value), // Omit 'date' param to get today's
  });

  const {
    data: resData,
    isError,
    refetch: refetchEarnings,
  } = useQuery({
    queryKey: ["earnings"],
    queryFn: () => getDashboardEarningsSummary(),
    placeholderData: keepPreviousData,
  });

  const handleInputChange = (type) => {
    setMetrics(type);
  };

  // useEffect(() => {
  //   refetchDaily(metrics.value);
  //   refetchEarnings(metrics.value);
  // }, [metrics]);

  const earnings = resData?.data.data[TypeMap[metrics.value]] || 0;

  const total = Math.floor(earnings?.total || 0);
  const percent = earnings?.percentageChange || 0;
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
        {/* <button className="flex items-center gap-1 px-4 py-2 rounded-md text-[#f5f5f5] bg-[#1a1a1a]">
          Last 1 Month
          <svg
            className="w-3 h-3"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="4"
          >
            <path d="M19 9l-7 7-7-7" />
          </svg>
        </button> */}
        <select
          name="type"
          value={metrics.value}
          // onChange={() => handleInputChange()}
          className="bg-[#1a1a1a] text-white px-3 py-3 rounded-md"
          required
        >
          <option value="" disabled>
            Select Type
          </option>
          {METRICS_TYPES.map((type) => (
            <option
              key={type.value}
              value={type.value}
              className="bg-[#262626] text-white"
              onClick={() => handleInputChange(type)}
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
            value: todayDailyExpenses?.data.data.totalExpenses ?? 'No Data',
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
        {/* {metricsData.map((metric, index) => {
          return <MatrixCard metric={metric} key={index} />;
        })} */}
      </div>

      <div className="flex flex-col justify-between mt-12">
        <div>
          <h2 className="font-semibold text-[#f5f5f5] text-xl">Item Details</h2>
          <p className="text-sm text-[#ababab]">
            Lorem, ipsum dolor sit amet consectetur adipisicing elit.
            Distinctio, obcaecati?
          </p>
        </div>

        <div className="mt-6 grid grid-cols-4 gap-4">
          {itemsData.map((item, index) => {
            return (
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
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Metrics;
