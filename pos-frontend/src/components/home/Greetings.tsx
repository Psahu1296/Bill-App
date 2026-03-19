import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../../redux/store";

const Greetings: React.FC = () => {
  const userData = useSelector((state: RootState) => state.user);
  const [dateTime, setDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getGreeting = () => {
    const h = dateTime.getHours();
    if (h < 12) return { text: "Good Morning", emoji: "☀️" };
    if (h < 17) return { text: "Good Afternoon", emoji: "🌤️" };
    return { text: "Good Evening", emoji: "🌙" };
  };

  const greeting = getGreeting();

  const formatDate = (date: Date) =>
    date.toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "2-digit", year: "numeric" });

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

  return (
    <div className="glass-card rounded-3xl p-6 relative overflow-hidden">
      {/* Decorative gradient blob */}
      <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-dhaba-accent/10 blur-2xl pointer-events-none" />
      <div className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-dhaba-success/8 blur-xl pointer-events-none" />

      <div className="relative flex justify-between items-center">
        {/* Left: greeting */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{greeting.emoji}</span>
            <p className="text-dhaba-accent text-xs font-bold tracking-widest uppercase">
              {greeting.text}
            </p>
          </div>
          <h1 className="font-display text-3xl font-bold text-dhaba-text leading-tight">
            {userData.name || "Chef"}
          </h1>
          <p className="text-dhaba-muted text-sm mt-1.5">
            Ready to serve excellence today?
          </p>
        </div>

        {/* Right: live clock */}
        <div className="text-right">
          <p className="font-display text-4xl font-bold text-dhaba-text tabular-nums tracking-wider">
            {formatTime(dateTime)}
          </p>
          <p className="text-dhaba-muted text-sm mt-1">{formatDate(dateTime)}</p>
        </div>
      </div>
    </div>
  );
};

export default Greetings;
