import { FaEdit, FaTrash, FaPhone, FaMoneyBillWave, FaChevronDown, FaChevronUp } from "react-icons/fa";
import { MdPeople } from "react-icons/md";
import { motion, AnimatePresence } from "framer-motion";
import type { StaffMember } from "../../types";
import { ROLE_CONFIG } from "./constants";

function getTotalPaid(s: StaffMember): number {
  return s.payments.reduce((sum, p) => sum + (p.type === "deduction" ? -p.amount : p.amount), 0);
}

interface StaffListProps {
  staff: StaffMember[];
  isLoading: boolean;
  expandedId: string | null;
  onExpand: (id: string) => void;
  onEdit: (s: StaffMember) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string) => void;
  onAddPayment: (id: string) => void;
  onDeletePayment: (staffId: string, paymentId: string) => void;
}

const StaffList: React.FC<StaffListProps> = ({
  staff, isLoading, expandedId, onExpand, onEdit, onDelete, onToggleActive, onAddPayment, onDeletePayment,
}) => {
  if (isLoading) {
    return (
      <div className="glass-card rounded-2xl p-12 flex justify-center">
        <div className="w-6 h-6 border-2 border-dhaba-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (staff.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-12 text-center">
        <MdPeople className="text-dhaba-muted text-4xl mx-auto mb-3" />
        <p className="text-dhaba-muted font-medium">No staff found</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {staff.map(s => {
        const roleConf = ROLE_CONFIG[s.role];
        const isExpanded = expandedId === s._id;
        return (
          <motion.div key={s._id} layout className="glass-card rounded-2xl overflow-hidden">
            {/* Main row */}
            <div className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4 cursor-pointer" onClick={() => onExpand(s._id)}>
                <div className="h-12 w-12 rounded-xl bg-gradient-warm flex items-center justify-center text-lg font-bold text-dhaba-bg">
                  {s.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-dhaba-text">{s.name}</h3>
                    {!s.isActive && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-dhaba-danger/15 text-dhaba-danger font-bold">INACTIVE</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className={`text-xs font-semibold ${roleConf.color}`}>{roleConf.emoji} {roleConf.label}</span>
                    <span className="text-xs text-dhaba-muted flex items-center gap-1"><FaPhone size={8} /> {s.phone}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-5">
                <div className="text-right">
                  <p className="text-xs text-dhaba-muted font-bold tracking-wider uppercase">Salary</p>
                  <p className="text-sm font-bold text-dhaba-accent">₹{s.monthlySalary.toLocaleString()}/mo</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-dhaba-muted font-bold tracking-wider uppercase">Total Paid</p>
                  <p className="text-sm font-bold text-dhaba-success">₹{getTotalPaid(s).toLocaleString()}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={() => onAddPayment(s._id)}
                    className="glass-input rounded-xl p-2.5 hover:bg-dhaba-success/10 text-dhaba-muted hover:text-dhaba-success transition-all" title="Add Payment">
                    <FaMoneyBillWave size={14} />
                  </button>
                  <button onClick={() => onEdit(s)}
                    className="glass-input rounded-xl p-2.5 hover:bg-dhaba-accent/10 text-dhaba-muted hover:text-dhaba-accent transition-all" title="Edit">
                    <FaEdit size={14} />
                  </button>
                  <button onClick={() => onToggleActive(s._id)}
                    className={`glass-input rounded-xl p-2.5 transition-all text-xs font-bold ${
                      s.isActive
                        ? "hover:bg-dhaba-danger/10 text-dhaba-muted hover:text-dhaba-danger"
                        : "hover:bg-dhaba-success/10 text-dhaba-muted hover:text-dhaba-success"
                    }`}
                    title={s.isActive ? "Deactivate" : "Activate"}>
                    {s.isActive ? "✕" : "✓"}
                  </button>
                  <button onClick={() => onDelete(s._id)}
                    className="glass-input rounded-xl p-2.5 hover:bg-dhaba-danger/10 text-dhaba-muted hover:text-dhaba-danger transition-all" title="Delete">
                    <FaTrash size={12} />
                  </button>
                  <button onClick={() => onExpand(s._id)} className="text-dhaba-muted hover:text-dhaba-text transition-colors p-1">
                    {isExpanded ? <FaChevronUp size={12} /> : <FaChevronDown size={12} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Payment History */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="border-t border-dhaba-border/20 px-6 py-4">
                    <h4 className="text-xs font-bold text-dhaba-muted tracking-wider uppercase mb-3">Payment History</h4>
                    {s.payments.length === 0 ? (
                      <p className="text-sm text-dhaba-muted py-2">No payments recorded</p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {s.payments.map(p => (
                          <div key={p._id} className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-dhaba-surface-hover/50 transition-colors group">
                            <div className="flex items-center gap-3">
                              <span className={`text-xs px-2.5 py-1 rounded-lg font-bold uppercase tracking-wider ${
                                p.type === "deduction" ? "bg-dhaba-danger/15 text-dhaba-danger" : "bg-dhaba-success/15 text-dhaba-success"
                              }`}>{p.type}</span>
                              <span className="text-sm text-dhaba-text">{p.note}</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-xs text-dhaba-muted">
                                {new Date(p.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                              </span>
                              <span className={`text-sm font-bold ${p.type === "deduction" ? "text-dhaba-danger" : "text-dhaba-success"}`}>
                                {p.type === "deduction" ? "-" : "+"}₹{p.amount.toLocaleString()}
                              </span>
                              <button onClick={() => onDeletePayment(s._id, p._id)}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-dhaba-danger/10 text-dhaba-muted hover:text-dhaba-danger transition-all">
                                <FaTrash size={10} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 pt-3 border-t border-dhaba-border/10 flex items-center justify-between">
                      <span className="text-xs text-dhaba-muted">
                        Joined: {new Date(s.joinDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
};

export default StaffList;
