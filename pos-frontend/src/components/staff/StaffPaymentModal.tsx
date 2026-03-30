import { motion } from "framer-motion";
import { FaMoneyBillWave } from "react-icons/fa";
import type { StaffPayment } from "../../types";

export interface PayFormValues {
  amount: string;
  type: StaffPayment["type"];
  note: string;
  date: string;
}

const PAYMENT_TYPES: StaffPayment["type"][] = ["daily", "monthly", "advance", "bonus", "deduction"];

interface StaffPaymentModalProps {
  staffId: string | null;
  staffName: string | undefined;
  form: PayFormValues;
  onFieldChange: <K extends keyof PayFormValues>(key: K, value: PayFormValues[K]) => void;
  isPending: boolean;
  onSubmit: () => void;
  onClose: () => void;
}

const StaffPaymentModal: React.FC<StaffPaymentModalProps> = ({
  staffId, staffName, form, onFieldChange, isPending, onSubmit, onClose,
}) => {
  if (!staffId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card rounded-2xl p-6 w-full max-w-md mx-4 space-y-5"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="font-display text-xl font-bold text-dhaba-text flex items-center gap-2">
          <FaMoneyBillWave className="text-dhaba-success" /> Record Payment
        </h2>
        <p className="text-sm text-dhaba-muted">
          For: <span className="text-dhaba-text font-semibold">{staffName}</span>
        </p>

        <div>
          <label className="text-xs text-dhaba-muted font-bold tracking-wider uppercase mb-2 block">Type</label>
          <div className="flex gap-2 flex-wrap">
            {PAYMENT_TYPES.map(t => (
              <button
                key={t}
                onClick={() => onFieldChange("type", t)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all capitalize ${
                  form.type === t
                    ? t === "deduction" ? "bg-dhaba-danger/15 text-dhaba-danger" : "bg-dhaba-accent/15 text-dhaba-accent"
                    : "glass-input text-dhaba-muted hover:text-dhaba-text"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-dhaba-muted font-bold tracking-wider uppercase mb-2 block">Amount (₹)</label>
          <input
            type="number"
            value={form.amount}
            onChange={e => onFieldChange("amount", e.target.value)}
            placeholder="Enter amount"
            className="glass-input w-full rounded-xl px-4 py-2.5 text-dhaba-text text-sm outline-none placeholder:text-dhaba-muted/50"
          />
        </div>

        <div>
          <label className="text-xs text-dhaba-muted font-bold tracking-wider uppercase mb-2 block">Date</label>
          <input
            type="date"
            value={form.date}
            onChange={e => onFieldChange("date", e.target.value)}
            className="glass-input w-full rounded-xl px-4 py-2.5 text-dhaba-text text-sm outline-none"
          />
        </div>

        <div>
          <label className="text-xs text-dhaba-muted font-bold tracking-wider uppercase mb-2 block">Note (optional)</label>
          <input
            type="text"
            value={form.note}
            onChange={e => onFieldChange("note", e.target.value)}
            placeholder="Reason or note"
            className="glass-input w-full rounded-xl px-4 py-2.5 text-dhaba-text text-sm outline-none placeholder:text-dhaba-muted/50"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isPending}
            className="flex-1 glass-input rounded-xl py-2.5 text-dhaba-muted font-semibold text-sm hover:text-dhaba-text transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={isPending || !form.amount}
            className="flex-1 bg-gradient-warm text-dhaba-bg rounded-xl py-2.5 font-bold text-sm hover:shadow-glow transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isPending
              ? <><div className="w-4 h-4 border-2 border-dhaba-bg border-t-transparent rounded-full animate-spin" />Saving…</>
              : "Record Payment"
            }
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default StaffPaymentModal;
