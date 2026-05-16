import { useState, useEffect, useCallback } from "react";
import { getReminders } from "../https";

export type ReminderItem = {
  type: "expense_reminder" | "labor_reminder" | "credit_reminder";
  message: string;
  date: string;
  count?: number;
  totalAmount?: number;
};

const ACK_KEY_PREFIX = "reminders_ack_";

function getTodayAcked(): Set<string> {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const raw = localStorage.getItem(`${ACK_KEY_PREFIX}${today}`);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function ackReminder(reminder: ReminderItem) {
  const today = new Date().toISOString().slice(0, 10);
  const key = `${ACK_KEY_PREFIX}${today}`;
  const acked = getTodayAcked();
  // Key uniquely identifies a reminder by type + date
  acked.add(`${reminder.type}__${reminder.date}`);
  try {
    localStorage.setItem(key, JSON.stringify([...acked]));
  } catch { /* ignore quota errors */ }
}

function filterAcked(reminders: ReminderItem[]): ReminderItem[] {
  const acked = getTodayAcked();
  return reminders.filter((r) => !acked.has(`${r.type}__${r.date}`));
}

export function useReminders(enabled = true) {
  const [reminders, setReminders] = useState<ReminderItem[]>([]);

  // ── Startup check ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    getReminders()
      .then((res) => {
        const fetched: ReminderItem[] = res.data?.reminders ?? [];
        setReminders(filterAcked(fetched));
      })
      .catch(() => { /* silently ignore — reminders are non-critical */ });
  }, [enabled]);

  // ── Receive reminders pushed from SSE (called by useAdminNotify) ───────────
  const pushReminders = useCallback((incoming: ReminderItem[]) => {
    setReminders((prev) => {
      const merged = [...incoming];
      // Keep any existing reminders that aren't overridden by the new batch
      prev.forEach((existing) => {
        const overridden = merged.some(
          (r) => r.type === existing.type && r.date === existing.date
        );
        if (!overridden) merged.push(existing);
      });
      return filterAcked(merged);
    });
  }, []);

  // ── Dismiss: removes from state only (reappears on next cron push) ─────────
  const dismiss = useCallback((reminder: ReminderItem) => {
    setReminders((prev) =>
      prev.filter((r) => !(r.type === reminder.type && r.date === reminder.date))
    );
  }, []);

  // ── Acknowledge: persists to localStorage, won't reappear today ───────────
  const acknowledge = useCallback((reminder: ReminderItem) => {
    ackReminder(reminder);
    setReminders((prev) =>
      prev.filter((r) => !(r.type === reminder.type && r.date === reminder.date))
    );
  }, []);

  return { reminders, pushReminders, dismiss, acknowledge };
}
