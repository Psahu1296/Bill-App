import React from "react";

/** Shimmering skeleton block — drop-in replacement for full-page loaders */
const Skeleton: React.FC<{
  className?: string;
  count?: number;
  gap?: string;
}> = ({ className = "", count = 1, gap = "gap-3" }) => {
  const items = Array.from({ length: count });
  return (
    <div className={`flex flex-col ${gap}`}>
      {items.map((_, i) => (
        <div
          key={i}
          className={`animate-pulse rounded-2xl bg-dhaba-surface/60 ${className}`}
          style={{ backgroundImage: "linear-gradient(90deg, transparent 25%, rgba(255,255,255,0.04) 50%, transparent 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }}
        />
      ))}
    </div>
  );
};

export default Skeleton;
