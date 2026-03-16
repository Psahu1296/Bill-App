import React from "react";

interface MiniCardProps {
  title: string;
  icon: React.ReactNode;
  number: number;
  footerNum: number;
  variant?: "earnings" | "progress";
}

const MiniCard: React.FC<MiniCardProps> = ({ title, icon, number, footerNum, variant = "earnings" }) => {
  const isEarnings = variant === "earnings";

  return (
    <div className="glass-card rounded-2xl p-5 group hover:shadow-glow transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <p className="text-dhaba-muted text-xs font-bold tracking-widest uppercase">{title}</p>
        <div className={`p-3 rounded-xl ${isEarnings ? "bg-dhaba-success/15 text-dhaba-success" : "bg-dhaba-accent/15 text-dhaba-accent"} text-xl transition-transform group-hover:scale-110`}>
          {icon}
        </div>
      </div>
      <h1 className="font-display text-4xl font-bold text-dhaba-text">
        {isEarnings ? `₹${number.toLocaleString()}` : number}
      </h1>
      <div className="flex items-center gap-2 mt-3">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${footerNum >= 0 ? "bg-dhaba-success/15 text-dhaba-success" : "bg-dhaba-danger/15 text-dhaba-danger"}`}>
          {footerNum >= 0 ? "↑" : "↓"} {Math.abs(footerNum)}%
        </span>
        <span className="text-dhaba-muted text-xs">vs yesterday</span>
      </div>
    </div>
  );
};

export default MiniCard;
