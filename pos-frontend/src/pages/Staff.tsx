import React, { useState, useEffect, useCallback } from "react";
import { FaPlus, FaSearch } from "react-icons/fa";
import { FiRefreshCw } from "react-icons/fi";
import BackButton from "../components/shared/BackButton";
import {
  getAllStaff, addStaff, updateStaff, deleteStaff,
  toggleStaffActive, addStaffPayment, deleteStaffPayment,
} from "../https";
import type { StaffMember } from "../types";
import { getErrorMessage, getTodayISO } from "../utils";
import { useFormState } from "../hooks";
import {
  StaffSummaryCards, StaffList, AddStaffModal, StaffPaymentModal,
} from "../components/staff";
import type { StaffFormValues, PayFormValues } from "../components/staff";
import { ROLES, ROLE_CONFIG } from "../components/staff/constants";

const INITIAL_STAFF_FORM: StaffFormValues = { name: "", phone: "", role: "cook", monthlySalary: "" };
const getInitialPayForm = (): PayFormValues => ({ amount: "", type: "daily", note: "", date: getTodayISO() });

const Staff: React.FC = () => {
  useEffect(() => { document.title = "Dhaba POS | Staff"; }, []);

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const staffForm = useFormState<StaffFormValues>(INITIAL_STAFF_FORM);
  const payForm = useFormState<PayFormValues>(getInitialPayForm());

  const fetchStaff = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getAllStaff();
      setStaff(res.data?.data ?? []);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load staff."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  const filtered = staff.filter(s =>
    (s.name.toLowerCase().includes(search.toLowerCase()) || s.phone.includes(search))
    && (filterRole === "all" || s.role === filterRole)
  );

  const totalMonthlyExpense = staff.filter(s => s.isActive).reduce((sum, s) => sum + s.monthlySalary, 0);
  const totalPaidToday = staff.reduce((sum, s) => {
    const today = new Date().toDateString();
    return sum + s.payments
      .filter(p => new Date(p.date).toDateString() === today)
      .reduce((ps, p) => ps + p.amount, 0);
  }, 0);

  const handleOpenAdd = useCallback(() => {
    staffForm.setValues(INITIAL_STAFF_FORM);
    setEditingStaff(null);
    setShowAddModal(true);
  }, [staffForm]);

  const handleOpenEdit = useCallback((s: StaffMember) => {
    staffForm.setValues({ name: s.name, phone: s.phone, role: s.role, monthlySalary: String(s.monthlySalary) });
    setEditingStaff(s);
    setShowAddModal(true);
  }, [staffForm]);

  const handleCloseAddModal = useCallback(() => setShowAddModal(false), []);

  const handleSave = useCallback(async () => {
    const { name, phone, role, monthlySalary } = staffForm.values;
    if (!name.trim() || !phone.trim()) return;
    setIsSubmitting(true);
    try {
      const payload = { name: name.trim(), phone: phone.trim(), role, monthlySalary: Number(monthlySalary) || 0 };
      if (editingStaff) await updateStaff(editingStaff._id, payload);
      else await addStaff(payload);
      setShowAddModal(false);
      await fetchStaff();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save staff."));
    } finally {
      setIsSubmitting(false);
    }
  }, [staffForm.values, editingStaff, fetchStaff]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      setStaff(prev => prev.filter(s => s._id !== id));
      await deleteStaff(id);
    } catch {
      await fetchStaff();
    }
  }, [fetchStaff]);

  const handleToggleActive = useCallback(async (id: string) => {
    try {
      setStaff(prev => prev.map(s => s._id === id ? { ...s, isActive: !s.isActive } : s));
      await toggleStaffActive(id);
    } catch {
      await fetchStaff();
    }
  }, [fetchStaff]);

  const handleOpenPayment = useCallback((staffId: string) => {
    payForm.setValues(getInitialPayForm());
    setShowPaymentModal(staffId);
  }, [payForm]);

  const handleClosePayment = useCallback(() => setShowPaymentModal(null), []);

  const handlePayment = useCallback(async () => {
    if (!showPaymentModal || !payForm.values.amount) return;
    setIsSubmitting(true);
    try {
      await addStaffPayment(showPaymentModal, {
        amount: Number(payForm.values.amount),
        type: payForm.values.type,
        note: payForm.values.note || payForm.values.type,
        date: payForm.values.date,
      });
      setShowPaymentModal(null);
      payForm.setValues(getInitialPayForm());
      await fetchStaff();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to record payment."));
    } finally {
      setIsSubmitting(false);
    }
  }, [showPaymentModal, payForm, fetchStaff]);

  const handleDeletePayment = useCallback(async (staffId: string, paymentId: string) => {
    try {
      setStaff(prev => prev.map(s => s._id === staffId
        ? { ...s, payments: s.payments.filter(p => p._id !== paymentId) }
        : s
      ));
      await deleteStaffPayment(staffId, paymentId);
    } catch {
      await fetchStaff();
    }
  }, [fetchStaff]);

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  }, []);

  const handleFilterAll = useCallback(() => setFilterRole("all"), []);
  const handleFilterRole = useCallback((r: string) => setFilterRole(r), []);
  const handleDismissError = useCallback(() => setError(null), []);

  return (
    <div className="bg-dhaba-bg min-h-[calc(100vh-4rem)] pb-8">
      <div className="container mx-auto px-6 py-6">

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
            <button onClick={handleOpenAdd}
              className="bg-gradient-warm text-dhaba-bg px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:shadow-glow transition-all">
              <FaPlus /> Add Staff
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-dhaba-danger/10 border border-dhaba-danger/30 text-dhaba-danger text-sm font-medium flex items-center justify-between">
            <span>{error}</span>
            <button onClick={handleDismissError} className="ml-4 text-dhaba-muted hover:text-dhaba-danger">✕</button>
          </div>
        )}

        <StaffSummaryCards
          totalStaff={staff.length}
          activeCount={staff.filter(s => s.isActive).length}
          monthlyExpense={totalMonthlyExpense}
          paidToday={totalPaidToday}
        />

        <div className="flex items-center gap-4 mb-6">
          <div className="glass-input flex items-center gap-3 rounded-xl px-4 py-2.5 flex-1 max-w-md">
            <FaSearch className="text-dhaba-muted text-sm" />
            <input type="text" placeholder="Search by name or phone..." value={search} onChange={handleSearchChange}
              className="bg-transparent outline-none text-dhaba-text text-sm font-medium placeholder:text-dhaba-muted/50 flex-1" />
          </div>
          <div className="glass-card rounded-xl p-1 flex gap-1">
            <button onClick={handleFilterAll}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${filterRole === "all" ? "bg-dhaba-accent/15 text-dhaba-accent" : "text-dhaba-muted hover:text-dhaba-text"}`}>
              All
            </button>
            {ROLES.map(r => (
              <button key={r} onClick={() => handleFilterRole(r)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${filterRole === r ? "bg-dhaba-accent/15 text-dhaba-accent" : "text-dhaba-muted hover:text-dhaba-text"}`}>
                {ROLE_CONFIG[r].emoji} {ROLE_CONFIG[r].label}
              </button>
            ))}
          </div>
        </div>

        <StaffList
          staff={filtered}
          isLoading={isLoading}
          expandedId={expandedId}
          onExpand={handleToggleExpand}
          onEdit={handleOpenEdit}
          onDelete={handleDelete}
          onToggleActive={handleToggleActive}
          onAddPayment={handleOpenPayment}
          onDeletePayment={handleDeletePayment}
        />
      </div>

      <AddStaffModal
        isOpen={showAddModal}
        editingStaff={editingStaff}
        form={staffForm.values}
        onFieldChange={staffForm.setField}
        isPending={isSubmitting}
        onSave={handleSave}
        onClose={handleCloseAddModal}
      />

      <StaffPaymentModal
        staffId={showPaymentModal}
        staffName={staff.find(s => s._id === showPaymentModal)?.name}
        form={payForm.values}
        onFieldChange={payForm.setField}
        isPending={isSubmitting}
        onSubmit={handlePayment}
        onClose={handleClosePayment}
      />
    </div>
  );
};

export default Staff;
