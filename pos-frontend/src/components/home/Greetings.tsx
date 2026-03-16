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
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString("en-IN", {
      weekday: "long",
      month: "long",
      day: "2-digit",
      year: "numeric",
    });
  };

  const formatTime = (date: Date): string =>
    date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

  return (
    <div className="glass-card rounded-3xl p-6 flex justify-between items-center">
      <div>
        <p className="text-dhaba-accent text-xs font-bold tracking-widest uppercase mb-1">
          {getGreeting()} 👋
        </p>
        <h1 className="font-display text-3xl font-bold text-dhaba-text">
          {userData.name || "Chef"}
        </h1>
        <p className="text-dhaba-muted text-sm mt-1">
          Give your best service for customers today
        </p>
      </div>
      <div className="text-right">
        <h1 className="font-display text-4xl font-bold text-dhaba-text tabular-nums tracking-wider">
          {formatTime(dateTime)}
        </h1>
        <p className="text-dhaba-muted text-sm mt-1">{formatDate(dateTime)}</p>
      </div>
    </div>
  );
};

export default Greetings;
