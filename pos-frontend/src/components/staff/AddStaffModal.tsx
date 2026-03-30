import { motion } from "framer-motion";
import type { StaffMember, StaffRole } from "../../types";
import { ROLES, ROLE_CONFIG } from "./constants";

export interface StaffFormValues {
  name: string;
  phone: string;
  role: StaffRole;
  monthlySalary: string;
}

interface AddStaffModalProps {
  isOpen: boolean;
  editingStaff: StaffMember | null;
  form: StaffFormValues;
  onFieldChange: <K extends keyof StaffFormValues>(key: K, value: StaffFormValues[K]) => void;
  isPending: boolean;
  onSave: () => void;
  onClose: () => void;
}

const AddStaffModal: React.FC<AddStaffModalProps> = ({
  isOpen, editingStaff, form, onFieldChange, isPending, onSave, onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card rounded-2xl p-6 w-full max-w-md mx-4 space-y-5"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="font-display text-xl font-bold text-dhaba-text">
          {editingStaff ? "Edit Staff" : "Add Staff"}
        </h2>

        <div>
          <label className="text-xs text-dhaba-muted font-bold tracking-wider uppercase mb-2 block">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={e => onFieldChange("name", e.target.value)}
            placeholder="Full name"
            className="glass-input w-full rounded-xl px-4 py-2.5 text-dhaba-text text-sm outline-none placeholder:text-dhaba-muted/50"
          />
        </div>

        <div>
          <label className="text-xs text-dhaba-muted font-bold tracking-wider uppercase mb-2 block">Phone</label>
          <input
            type="tel"
            value={form.phone}
            onChange={e => onFieldChange("phone", e.target.value)}
            placeholder="Mobile number"
            className="glass-input w-full rounded-xl px-4 py-2.5 text-dhaba-text text-sm outline-none placeholder:text-dhaba-muted/50"
          />
        </div>

        <div>
          <label className="text-xs text-dhaba-muted font-bold tracking-wider uppercase mb-2 block">Role</label>
          <div className="grid grid-cols-3 gap-2">
            {ROLES.map(r => (
              <button
                key={r}
                onClick={() => onFieldChange("role", r)}
                className={`py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1 ${
                  form.role === r ? "bg-dhaba-accent/15 text-dhaba-accent" : "glass-input text-dhaba-muted hover:text-dhaba-text"
                }`}
              >
                {ROLE_CONFIG[r].emoji} {ROLE_CONFIG[r].label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-dhaba-muted font-bold tracking-wider uppercase mb-2 block">Monthly Salary (₹)</label>
          <input
            type="number"
            value={form.monthlySalary}
            onChange={e => onFieldChange("monthlySalary", e.target.value)}
            placeholder="e.g. 15000"
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
            onClick={onSave}
            disabled={isPending || !form.name.trim() || !form.phone.trim()}
            className="flex-1 bg-gradient-warm text-dhaba-bg rounded-xl py-2.5 font-bold text-sm hover:shadow-glow transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isPending
              ? <><div className="w-4 h-4 border-2 border-dhaba-bg border-t-transparent rounded-full animate-spin" />Saving…</>
              : editingStaff ? "Update" : "Add Staff"
            }
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default AddStaffModal;
