import React, { createContext, useContext, useCallback, useRef } from "react";
import { useReminders, ReminderItem } from "../hooks/useReminders";

interface ReminderContextValue {
  reminders: ReminderItem[];
  pushReminders: (incoming: ReminderItem[]) => void;
  dismiss: (r: ReminderItem) => void;
  acknowledge: (r: ReminderItem) => void;
}

const ReminderContext = createContext<ReminderContextValue | null>(null);

export function ReminderProvider({ children, enabled }: { children: React.ReactNode; enabled: boolean }) {
  const { reminders, pushReminders, dismiss, acknowledge } = useReminders(enabled);

  // Stable ref so useAdminNotify's useEffect doesn't re-run when reminders change
  const pushRef = useRef(pushReminders);
  pushRef.current = pushReminders;
  const stablePush = useCallback((incoming: ReminderItem[]) => pushRef.current(incoming), []);

  return (
    <ReminderContext.Provider value={{ reminders, pushReminders: stablePush, dismiss, acknowledge }}>
      {children}
    </ReminderContext.Provider>
  );
}

export function useReminderContext() {
  const ctx = useContext(ReminderContext);
  if (!ctx) throw new Error("useReminderContext must be used within ReminderProvider");
  return ctx;
}
