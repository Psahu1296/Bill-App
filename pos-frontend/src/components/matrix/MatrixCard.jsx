import React from "react";

const MatrixCard = ({ metric }) => {
  return (
    <div
      className="shadow-sm rounded-lg p-4"
      style={{ backgroundColor: metric.color }}
    >
      <div className="flex justify-between items-center">
        <p className="font-medium text-xs text-[#f5f5f5]">{metric.title}</p>
        {metric?.percentage  && <div className="flex items-center gap-1">
          <svg
            className="w-3 h-3"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
            style={{ color: metric.isIncrease ? "#f5f5f5" : "red" }}
          >
            <path d={metric.isIncrease ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
          </svg>
          <p
            className="font-medium text-xs"
            style={{ color: metric.isIncrease ? "#f5f5f5" : "red" }}
          >
            {metric.percentage}
          </p>
        </div>}
      </div>
      <p className="mt-1 font-semibold text-2xl text-[#f5f5f5]">
        {metric.value}
      </p>
    </div>
  );
};

export default MatrixCard;
