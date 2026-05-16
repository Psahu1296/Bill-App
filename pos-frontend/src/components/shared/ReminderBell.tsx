import React, { useRef, useEffect, useState } from "react";
import { IoNotificationsOutline, IoNotifications } from "react-icons/io5";
import { MdReceiptLong, MdPeopleAlt, MdAccountBalanceWallet } from "react-icons/md";
import { IoCheckmarkDone, IoClose } from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import type { ReminderItem } from "../../hooks/useReminders";

interface Props {
  reminders: ReminderItem[];
  onDismiss: (r: ReminderItem) => void;
  onAcknowledge: (r: ReminderItem) => void;
}

const ICON_MAP: Record<ReminderItem["type"], React.ReactNode> = {
  expense_reminder: <MdReceiptLong className="text-dhaba-accent text-lg flex-shrink-0" />,
  labor_reminder: <MdPeopleAlt className="text-orange-400 text-lg flex-shrink-0" />,
  credit_reminder: <MdAccountBalanceWallet className="text-dhaba-danger text-lg flex-shrink-0" />,
};

const NAV_MAP: Record<ReminderItem["type"], string> = {
  expense_reminder: "/expenses",
  labor_reminder: "/staff",
  credit_reminder: "/customers",
};

function formatDate(iso: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (iso === today) return "Today";
  if (iso === yesterday) return "Yesterday";
  return iso;
}

const ReminderBell: React.FC<Props> = ({ reminders, onDismiss, onAcknowledge }) => {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const count = reminders.length;

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="glass-card rounded-xl p-2.5 hover:bg-dhaba-surface-hover transition-all duration-200 group relative"
        title={count > 0 ? `${count} reminder(s) pending` : "No pending reminders"}
      >
        {count > 0 ? (
          <IoNotifications className="text-dhaba-accent text-xl" />
        ) : (
          <IoNotificationsOutline className="text-dhaba-muted text-xl group-hover:text-dhaba-accent transition-colors" />
        )}
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-dhaba-danger text-white text-[10px] font-bold flex items-center justify-center px-1 border-2 border-dhaba-surface">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 glass-card rounded-2xl shadow-glow border border-dhaba-border/30 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-dhaba-border/20 flex items-center justify-between">
            <span className="text-sm font-bold text-dhaba-text tracking-wide">
              {count > 0 ? `${count} Reminder${count > 1 ? "s" : ""}` : "All clear"}
            </span>
            <button onClick={() => setOpen(false)} className="text-dhaba-muted hover:text-dhaba-text transition-colors">
              <IoClose className="text-lg" />
            </button>
          </div>

          {count === 0 ? (
            <div className="px-4 py-6 text-center text-dhaba-muted text-sm">
              No pending reminders
            </div>
          ) : (
            <ul className="divide-y divide-dhaba-border/10 max-h-96 overflow-y-auto">
              {reminders.map((r, i) => (
                <li key={`${r.type}-${r.date}-${i}`} className="px-4 py-3 flex flex-col gap-2">
                  <div className="flex items-start gap-2">
                    {ICON_MAP[r.type]}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-dhaba-text leading-snug">{r.message}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-dhaba-muted font-medium uppercase tracking-wide">
                          {formatDate(r.date)}
                        </span>
                        {r.type === "credit_reminder" && r.totalAmount != null && (
                          <span className="text-[10px] text-dhaba-danger font-semibold">
                            ₹{r.totalAmount.toLocaleString("en-IN")} due
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pl-6">
                    <button
                      onClick={() => { navigate(NAV_MAP[r.type]); setOpen(false); }}
                      className="text-[11px] text-dhaba-accent font-semibold hover:underline"
                    >
                      Go there →
                    </button>
                    <div className="flex-1" />
                    <button
                      onClick={() => onDismiss(r)}
                      title="Dismiss until next reminder"
                      className="flex items-center gap-1 text-[11px] text-dhaba-muted hover:text-dhaba-text transition-colors px-2 py-1 rounded-lg hover:bg-dhaba-surface-hover"
                    >
                      <IoClose className="text-sm" />
                      Dismiss
                    </button>
                    <button
                      onClick={() => onAcknowledge(r)}
                      title="Mark as handled — won't show again today"
                      className="flex items-center gap-1 text-[11px] text-dhaba-success font-semibold hover:text-dhaba-success/80 transition-colors px-2 py-1 rounded-lg hover:bg-dhaba-success/10"
                    >
                      <IoCheckmarkDone className="text-sm" />
                      Done
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default ReminderBell;
