import React from "react";
import type { MetricItem } from "../../types";

interface MatrixCardProps { metric: MetricItem; }

const MatrixCard: React.FC<MatrixCardProps> = ({ metric }) => {
  return (
    <div className="glass-card rounded-2xl p-6 hover:shadow-glow transition-all duration-200 border-l-4" style={{ borderLeftColor: metric.color }}>
      <div className="flex justify-between items-center">
        <p className="text-dhaba-muted text-xs font-bold tracking-wider uppercase">{metric.title}</p>
        {metric?.percentage && (
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
            metric.isIncrease ? "bg-dhaba-success/15 text-dhaba-success" : "bg-dhaba-danger/15 text-dhaba-danger"
          }`}>
            {metric.isIncrease ? "↑" : "↓"} {metric.percentage}
          </span>
        )}
      </div>
      <p className="mt-3 font-display text-3xl font-bold text-dhaba-text">{metric.value}</p>
    </div>
  );
};

export default MatrixCard;
