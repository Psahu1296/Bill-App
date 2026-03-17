import React, { useState, useEffect, useCallback } from "react";
import { FaPlus, FaEdit, FaTrash, FaPhone, FaMoneyBillWave, FaSearch, FaChevronDown, FaChevronUp } from "react-icons/fa";
import { MdPeople } from "react-icons/md";
import { FiRefreshCw } from "react-icons/fi";
import BackButton from "../components/shared/BackButton";
import { motion, AnimatePresence } from "framer-motion";
import {
  getAllStaff,
  addStaff,
  updateStaff,
  deleteStaff,
  toggleStaffActive,
  addStaffPayment,
  deleteStaffPayment,
} from "../https";
import type { StaffMember, StaffPayment, StaffRole } from "../types";

export type { StaffRole };

const ROLE_CONFIG: Record<StaffRole, { label: string; emoji: string; color: string }> = {
  cook: { label: "Cook", emoji: "👨‍🍳", color: "text-dhaba-orange" },
  supplier: { label: "Supplier", emoji: "🚚", color: "text-dhaba-info" },
  owner: { label: "Owner", emoji: "👑", color: "text-dhaba-accent" },
  manager: { label: "Manager", emoji: "📋", color: "text-dhaba-success" },
  delivery: { label: "Delivery", emoji: "🏍️", color: "text-dhaba-warning" },
  other: { label: "Other", emoji: "👤", color: "text-dhaba-muted" },
};

const ROLES: StaffRole[] = ["cook", "supplier", "owner", "manager", "delivery", "other"];

const Staff: React.FC = () => {
  useEffect(() => { document.title = "Dhaba POS | Staff"; }, []);

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<StaffRole | "all">("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({ name: "", phone: "", role: "cook" as StaffRole, monthlySalary: "" });
  const [payForm, setPayForm] = useState({ amount: "", type: "daily" as StaffPayment["type"], note: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchStaff = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getAllStaff();
      setStaff(res.data?.data ?? []);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to load staff.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  const filtered = staff.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.phone.includes(search);
    const matchRole = filterRole === "all" || s.role === filterRole;
    return matchSearch && matchRole;
  });

  const totalMonthlyExpense = staff.filter(s => s.isActive).reduce((sum, s) => sum + s.monthlySalary, 0);
  const totalPaidToday = staff.reduce((sum, s) => {
    const today = new Date().toDateString();
    return sum + s.payments.filter(p => new Date(p.date).toDateString() === today).reduce((ps, p) => ps + p.amount, 0);
  }, 0);

  const openAdd = () => {
    setForm({ name: "", phone: "", role: "cook", monthlySalary: "" });
    setEditingStaff(null);
    setShowAddModal(true);
  };

  const openEdit = (s: StaffMember) => {
    setForm({ name: s.name, phone: s.phone, role: s.role, monthlySalary: String(s.monthlySalary) });
    setEditingStaff(s);
    setShowAddModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.phone.trim()) return;
    setIsSubmitting(true);
    try {
      const payload = { name: form.name.trim(), phone: form.phone.trim(), role: form.role, monthlySalary: Number(form.monthlySalary) || 0 };
      if (editingStaff) {
        await updateStaff(editingStaff._id, payload);
      } else {
        await addStaff(payload);
      }
      setShowAddModal(false);
      await fetchStaff();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to save staff.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setStaff(prev => prev.filter(s => s._id !== id));
      await deleteStaff(id);
    } catch {
      await fetchStaff();
    }
  };

  const handleToggleActive = async (id: string) => {
    try {
      setStaff(prev => prev.map(s => s._id === id ? { ...s, isActive: !s.isActive } : s));
      await toggleStaffActive(id);
    } catch {
      await fetchStaff();
    }
  };

  const handlePayment = async () => {
    if (!showPaymentModal || !payForm.amount) return;
    setIsSubmitting(true);
    try {
      await addStaffPayment(showPaymentModal, {
        amount: Number(payForm.amount),
        type: payForm.type,
        note: payForm.note || payForm.type,
      });
      setShowPaymentModal(null);
      setPayForm({ amount: "", type: "daily", note: "" });
      await fetchStaff();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to record payment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePayment = async (staffId: string, paymentId: string) => {
    try {
      setStaff(prev => prev.map(s => s._id === staffId
        ? { ...s, payments: s.payments.filter(p => p._id !== paymentId) }
        : s
      ));
      await deleteStaffPayment(staffId, paymentId);
    } catch {
      await fetchStaff();
    }
  };

  const getTotalPaid = (s: StaffMember) => s.payments.reduce((sum, p) => sum + (p.type === "deduction" ? -p.amount : p.amount), 0);

  return (
    <div className="bg-dhaba-bg min-h-[calc(100vh-4rem)] pb-8">
      <div className="container mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <BackButton />
            <div>
              <h1 className="font-display text-2xl font-bold text-dhaba-text">Staff Management</h1>
              <p className="text-sm text-dhaba-muted">{staff.filter(s => s.isActive).length} active · {staff.length} total</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchStaff} disabled={isLoading}
              className="p-2.5 rounded-xl glass-input text-dhaba-muted hover:text-dhaba-text transition-colors" title="Refresh">
              <FiRefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
            </button>
            <button onClick={openAdd} className="bg-gradient-warm text-dhaba-bg px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:shadow-glow transition-all">
              <FaPlus /> Add Staff
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-dhaba-danger/10 border border-dhaba-danger/30 text-dhaba-danger text-sm font-medium flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-4 text-dhaba-muted hover:text-dhaba-danger">✕</button>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="glass-card rounded-2xl p-5">
            <p className="text-dhaba-muted text-xs font-bold tracking-wider uppercase mb-2">Total Staff</p>
            <p className="font-display text-2xl font-bold text-dhaba-text">{staff.length}</p>
          </div>
          <div className="glass-card rounded-2xl p-5">
            <p className="text-dhaba-muted text-xs font-bold tracking-wider uppercase mb-2">Active</p>
            <p className="font-display text-2xl font-bold text-dhaba-success">{staff.filter(s => s.isActive).length}</p>
          </div>
          <div className="glass-card rounded-2xl p-5">
            <p className="text-dhaba-muted text-xs font-bold tracking-wider uppercase mb-2">Monthly Expense</p>
            <p className="font-display text-2xl font-bold text-dhaba-accent">₹{totalMonthlyExpense.toLocaleString()}</p>
          </div>
          <div className="glass-card rounded-2xl p-5">
            <p className="text-dhaba-muted text-xs font-bold tracking-wider uppercase mb-2">Paid Today</p>
            <p className="font-display text-2xl font-bold text-dhaba-orange">₹{totalPaidToday.toLocaleString()}</p>
          </div>
        </div>

        {/* Search + Filter */}
        <div className="flex items-center gap-4 mb-6">
          <div className="glass-input flex items-center gap-3 rounded-xl px-4 py-2.5 flex-1 max-w-md">
            <FaSearch className="text-dhaba-muted text-sm" />
            <input type="text" placeholder="Search by name or phone..." value={search} onChange={e => setSearch(e.target.value)}
              className="bg-transparent outline-none text-dhaba-text text-sm font-medium placeholder:text-dhaba-muted/50 flex-1" />
          </div>
          <div className="glass-card rounded-xl p-1 flex gap-1">
            <button onClick={() => setFilterRole("all")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${filterRole === "all" ? "bg-dhaba-accent/15 text-dhaba-accent" : "text-dhaba-muted hover:text-dhaba-text"}`}>
              All
            </button>
            {ROLES.map(r => (
              <button key={r} onClick={() => setFilterRole(r)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${filterRole === r ? "bg-dhaba-accent/15 text-dhaba-accent" : "text-dhaba-muted hover:text-dhaba-text"}`}>
                {ROLE_CONFIG[r].emoji} {ROLE_CONFIG[r].label}
              </button>
            ))}
          </div>
        </div>

        {/* Staff List */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="glass-card rounded-2xl p-12 flex justify-center">
              <div className="w-6 h-6 border-2 border-dhaba-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center">
              <MdPeople className="text-dhaba-muted text-4xl mx-auto mb-3" />
              <p className="text-dhaba-muted font-medium">No staff found</p>
            </div>
          ) : (
            filtered.map(s => {
              const roleConf = ROLE_CONFIG[s.role];
              const isExpanded = expandedId === s._id;
              return (
                <motion.div key={s._id} layout className="glass-card rounded-2xl overflow-hidden">
                  {/* Main row */}
                  <div className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : s._id)}>
                      <div className="h-12 w-12 rounded-xl bg-gradient-warm flex items-center justify-center text-lg font-bold text-dhaba-bg">
                        {s.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-dhaba-text">{s.name}</h3>
                          {!s.isActive && <span className="text-[10px] px-2 py-0.5 rounded-full bg-dhaba-danger/15 text-dhaba-danger font-bold">INACTIVE</span>}
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
                        <button onClick={() => { setPayForm({ amount: "", type: "daily", note: "" }); setShowPaymentModal(s._id); }}
                          className="glass-input rounded-xl p-2.5 hover:bg-dhaba-success/10 text-dhaba-muted hover:text-dhaba-success transition-all" title="Add Payment">
                          <FaMoneyBillWave size={14} />
                        </button>
                        <button onClick={() => openEdit(s)}
                          className="glass-input rounded-xl p-2.5 hover:bg-dhaba-accent/10 text-dhaba-muted hover:text-dhaba-accent transition-all" title="Edit">
                          <FaEdit size={14} />
                        </button>
                        <button onClick={() => handleToggleActive(s._id)}
                          className={`glass-input rounded-xl p-2.5 transition-all text-xs font-bold ${s.isActive ? "hover:bg-dhaba-danger/10 text-dhaba-muted hover:text-dhaba-danger" : "hover:bg-dhaba-success/10 text-dhaba-muted hover:text-dhaba-success"}`}
                          title={s.isActive ? "Deactivate" : "Activate"}>
                          {s.isActive ? "✕" : "✓"}
                        </button>
                        <button onClick={() => handleDelete(s._id)}
                          className="glass-input rounded-xl p-2.5 hover:bg-dhaba-danger/10 text-dhaba-muted hover:text-dhaba-danger transition-all" title="Delete">
                          <FaTrash size={12} />
                        </button>
                        <button onClick={() => setExpandedId(isExpanded ? null : s._id)} className="text-dhaba-muted hover:text-dhaba-text transition-colors p-1">
                          {isExpanded ? <FaChevronUp size={12} /> : <FaChevronDown size={12} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Payment History */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
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
                                    <button onClick={() => handleDeletePayment(s._id, p._id)}
                                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-dhaba-danger/10 text-dhaba-muted hover:text-dhaba-danger transition-all">
                                      <FaTrash size={10} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="mt-3 pt-3 border-t border-dhaba-border/10 flex items-center justify-between">
                            <span className="text-xs text-dhaba-muted">Joined: {new Date(s.joinDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Add/Edit Staff Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAddModal(false)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card rounded-2xl p-6 w-full max-w-md mx-4 space-y-5" onClick={e => e.stopPropagation()}>
            <h2 className="font-display text-xl font-bold text-dhaba-text">{editingStaff ? "Edit Staff" : "Add Staff"}</h2>

            <div>
              <label className="text-xs text-dhaba-muted font-bold tracking-wider uppercase mb-2 block">Name</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Full name" className="glass-input w-full rounded-xl px-4 py-2.5 text-dhaba-text text-sm outline-none placeholder:text-dhaba-muted/50" />
            </div>

            <div>
              <label className="text-xs text-dhaba-muted font-bold tracking-wider uppercase mb-2 block">Phone</label>
              <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="Mobile number" className="glass-input w-full rounded-xl px-4 py-2.5 text-dhaba-text text-sm outline-none placeholder:text-dhaba-muted/50" />
            </div>

            <div>
              <label className="text-xs text-dhaba-muted font-bold tracking-wider uppercase mb-2 block">Role</label>
              <div className="grid grid-cols-3 gap-2">
                {ROLES.map(r => (
                  <button key={r} onClick={() => setForm(f => ({ ...f, role: r }))}
                    className={`py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1 ${form.role === r ? "bg-dhaba-accent/15 text-dhaba-accent" : "glass-input text-dhaba-muted hover:text-dhaba-text"}`}>
                    {ROLE_CONFIG[r].emoji} {ROLE_CONFIG[r].label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-dhaba-muted font-bold tracking-wider uppercase mb-2 block">Monthly Salary (₹)</label>
              <input type="number" value={form.monthlySalary} onChange={e => setForm(f => ({ ...f, monthlySalary: e.target.value }))}
                placeholder="e.g. 15000" className="glass-input w-full rounded-xl px-4 py-2.5 text-dhaba-text text-sm outline-none placeholder:text-dhaba-muted/50" />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowAddModal(false)} disabled={isSubmitting} className="flex-1 glass-input rounded-xl py-2.5 text-dhaba-muted font-semibold text-sm hover:text-dhaba-text transition-colors disabled:opacity-50">Cancel</button>
              <button onClick={handleSave} disabled={isSubmitting || !form.name.trim() || !form.phone.trim()}
                className="flex-1 bg-gradient-warm text-dhaba-bg rounded-xl py-2.5 font-bold text-sm hover:shadow-glow transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                {isSubmitting ? <><div className="w-4 h-4 border-2 border-dhaba-bg border-t-transparent rounded-full animate-spin" />Saving…</> : (editingStaff ? "Update" : "Add Staff")}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Payment Modal ── */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowPaymentModal(null)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card rounded-2xl p-6 w-full max-w-md mx-4 space-y-5" onClick={e => e.stopPropagation()}>
            <h2 className="font-display text-xl font-bold text-dhaba-text flex items-center gap-2">
              <FaMoneyBillWave className="text-dhaba-success" /> Record Payment
            </h2>
            <p className="text-sm text-dhaba-muted">For: <span className="text-dhaba-text font-semibold">{staff.find(s => s._id === showPaymentModal)?.name}</span></p>

            <div>
              <label className="text-xs text-dhaba-muted font-bold tracking-wider uppercase mb-2 block">Type</label>
              <div className="flex gap-2 flex-wrap">
                {(["daily", "monthly", "advance", "bonus", "deduction"] as StaffPayment["type"][]).map(t => (
                  <button key={t} onClick={() => setPayForm(f => ({ ...f, type: t }))}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all capitalize ${payForm.type === t ? (t === "deduction" ? "bg-dhaba-danger/15 text-dhaba-danger" : "bg-dhaba-accent/15 text-dhaba-accent") : "glass-input text-dhaba-muted hover:text-dhaba-text"}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-dhaba-muted font-bold tracking-wider uppercase mb-2 block">Amount (₹)</label>
              <input type="number" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="Enter amount" className="glass-input w-full rounded-xl px-4 py-2.5 text-dhaba-text text-sm outline-none placeholder:text-dhaba-muted/50" />
            </div>

            <div>
              <label className="text-xs text-dhaba-muted font-bold tracking-wider uppercase mb-2 block">Note (optional)</label>
              <input type="text" value={payForm.note} onChange={e => setPayForm(f => ({ ...f, note: e.target.value }))}
                placeholder="Reason or note" className="glass-input w-full rounded-xl px-4 py-2.5 text-dhaba-text text-sm outline-none placeholder:text-dhaba-muted/50" />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowPaymentModal(null)} disabled={isSubmitting} className="flex-1 glass-input rounded-xl py-2.5 text-dhaba-muted font-semibold text-sm hover:text-dhaba-text transition-colors disabled:opacity-50">Cancel</button>
              <button onClick={handlePayment} disabled={isSubmitting || !payForm.amount}
                className="flex-1 bg-gradient-warm text-dhaba-bg rounded-xl py-2.5 font-bold text-sm hover:shadow-glow transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                {isSubmitting ? <><div className="w-4 h-4 border-2 border-dhaba-bg border-t-transparent rounded-full animate-spin" />Saving…</> : "Record Payment"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Staff;
