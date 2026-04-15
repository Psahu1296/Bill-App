import React, { useCallback, useEffect, useState } from "react";
import { useSnackbar } from "notistack";
import {
  FaClipboardList, FaTrash, FaCheck, FaUtensils,
  FaCalendarAlt, FaUsers, FaSpinner,
} from "react-icons/fa";
import {
  getDishRequests, updateDishRequest, deleteDishRequest,
  getPreOrders, updatePreOrder, deletePreOrder,
} from "../https";
import type { DishRequest, PreOrder } from "../types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function fmtScheduled(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

// ── Status config ─────────────────────────────────────────────────────────────

const DISH_STATUSES = ["pending", "noted", "added", "rejected"] as const;
const PREORDER_STATUSES = ["pending", "confirmed", "cancelled", "completed"] as const;

const dishStatusCfg: Record<string, { badge: string; label: string }> = {
  pending:  { badge: "bg-dhaba-warning/15 text-dhaba-warning border border-dhaba-warning/20",   label: "Pending" },
  noted:    { badge: "bg-blue-500/15 text-blue-400 border border-blue-500/20",                 label: "Noted" },
  added:    { badge: "bg-dhaba-success/15 text-dhaba-success border border-dhaba-success/20",  label: "Added" },
  rejected: { badge: "bg-dhaba-danger/15 text-dhaba-danger border border-dhaba-danger/20",     label: "Rejected" },
};

const preOrderStatusCfg: Record<string, { badge: string; label: string; border: string }> = {
  pending:   { badge: "bg-dhaba-warning/15 text-dhaba-warning border border-dhaba-warning/20",   label: "Pending",   border: "border-l-dhaba-warning" },
  confirmed: { badge: "bg-dhaba-success/15 text-dhaba-success border border-dhaba-success/20",  label: "Confirmed", border: "border-l-dhaba-success" },
  cancelled: { badge: "bg-dhaba-danger/15 text-dhaba-danger border border-dhaba-danger/20",     label: "Cancelled", border: "border-l-dhaba-danger" },
  completed: { badge: "bg-blue-500/15 text-blue-400 border border-blue-500/20",                 label: "Completed", border: "border-l-dhaba-muted" },
};

// ── Dish Request Card ─────────────────────────────────────────────────────────

function DishRequestCard({
  item,
  onSave,
  onDelete,
}: {
  item: DishRequest;
  onSave: (id: string, status: string, adminNote: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [status, setStatus]       = useState(item.status);
  const [adminNote, setAdminNote] = useState(item.adminNote);
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState(false);

  const cfg = dishStatusCfg[status] ?? dishStatusCfg.pending;

  async function handleSave() {
    setSaving(true);
    await onSave(item._id, status, adminNote);
    setSaving(false);
  }

  async function handleDelete() {
    if (!window.confirm(`Delete request for "${item.dishName}"?`)) return;
    setDeleting(true);
    await onDelete(item._id);
  }

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-dhaba-accent/20 text-dhaba-accent font-bold text-sm flex items-center justify-center shrink-0">
          {initials(item.customerName)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-dhaba-text text-sm">{item.customerName}</span>
            <span className="text-[11px] text-dhaba-muted">{item.customerPhone}</span>
          </div>
          <span className="text-[11px] text-dhaba-muted">{fmtDate(item.createdAt)}</span>
        </div>
        <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-lg ${cfg.badge}`}>
          {cfg.label}
        </span>
      </div>

      {/* Dish info */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <FaUtensils className="text-dhaba-accent text-xs shrink-0" />
          <span className="font-bold text-dhaba-text text-base">{item.dishName}</span>
        </div>
        {item.description && (
          <p className="text-sm text-dhaba-muted pl-4">{item.description}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-dhaba-border/20">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as DishRequest["status"])}
          className="glass-input rounded-lg px-3 py-1.5 text-xs font-semibold text-dhaba-text bg-transparent shrink-0"
        >
          {DISH_STATUSES.map((s) => (
            <option key={s} value={s}>{dishStatusCfg[s].label}</option>
          ))}
        </select>
        <input
          value={adminNote}
          onChange={(e) => setAdminNote(e.target.value)}
          placeholder="Admin note…"
          className="glass-input rounded-xl px-4 py-2 text-sm flex-1 bg-transparent placeholder:text-dhaba-muted/50 outline-none"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 rounded-lg text-xs font-bold bg-gradient-warm text-dhaba-bg hover:shadow-glow transition-all disabled:opacity-50 disabled:shadow-none shrink-0"
        >
          {saving ? <FaSpinner className="animate-spin" /> : "Save"}
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="p-2 rounded-lg text-dhaba-muted hover:text-dhaba-danger hover:bg-dhaba-danger/10 transition-colors shrink-0"
          title="Delete"
        >
          {deleting ? <FaSpinner className="animate-spin text-xs" /> : <FaTrash className="text-xs" />}
        </button>
      </div>
    </div>
  );
}

// ── Pre-Order Card ────────────────────────────────────────────────────────────

function PreOrderCard({
  item,
  onUpdate,
  onDelete,
}: {
  item: PreOrder;
  onUpdate: (id: string, data: { status?: string; adminNote?: string; estimatedAmount?: number }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [adminNote, setAdminNote]           = useState(item.adminNote);
  const [estimatedAmount, setEstimatedAmount] = useState(item.estimatedAmount);
  const [saving, setSaving]                 = useState(false);
  const [deleting, setDeleting]             = useState(false);

  const cfg = preOrderStatusCfg[item.status] ?? preOrderStatusCfg.pending;

  async function handleStatusChange(newStatus: string) {
    setSaving(true);
    await onUpdate(item._id, { status: newStatus });
    setSaving(false);
  }

  async function handleSaveDetails() {
    setSaving(true);
    await onUpdate(item._id, { adminNote, estimatedAmount });
    setSaving(false);
  }

  async function handleDelete() {
    if (!window.confirm(`Delete pre-order from ${item.customerName}?`)) return;
    setDeleting(true);
    await onDelete(item._id);
  }

  const itemsPreview = item.items
    .slice(0, 3)
    .map((i) => `${i.name} × ${i.quantity}`)
    .join("  /  ");
  const extraItems = item.items.length > 3 ? ` +${item.items.length - 3} more` : "";

  return (
    <div className={`glass-card rounded-2xl overflow-hidden border-l-4 ${cfg.border}`}>
      {/* Header */}
      <div className="px-5 py-4 bg-dhaba-surface/60 border-b border-dhaba-border/20 space-y-2">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-dhaba-text">{item.customerName}</span>
              <span className="text-[11px] text-dhaba-muted">{item.customerPhone}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <FaCalendarAlt className="text-dhaba-accent text-[10px]" />
              <span className="text-dhaba-accent font-semibold text-sm">{fmtScheduled(item.scheduledFor)}</span>
            </div>
          </div>
          <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-lg ${cfg.badge}`}>
            {cfg.label}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold bg-dhaba-bg px-2 py-1 rounded text-dhaba-muted uppercase tracking-wider">
            {item.orderType}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] text-dhaba-muted">
            <FaUsers className="text-[9px]" /> {item.guestCount} guests
          </span>
          {item.depositPaid && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-dhaba-success/15 text-dhaba-success border border-dhaba-success/20">
              <FaCheck className="text-[9px]" /> ₹{item.depositAmount} Advance Paid
            </span>
          )}
        </div>
      </div>

      {/* Items & instructions */}
      <div className="px-5 py-3 space-y-1.5">
        <p className="text-sm text-dhaba-text">{itemsPreview}<span className="text-dhaba-accent font-bold">{extraItems}</span></p>
        {item.specialInstructions && (
          <p className="text-xs text-dhaba-muted italic">"{item.specialInstructions}"</p>
        )}
      </div>

      {/* Admin controls */}
      <div className="px-5 py-4 border-t border-dhaba-border/20 space-y-3">
        {/* Estimates row */}
        <div className="flex items-center gap-3 flex-wrap text-xs text-dhaba-muted">
          {item.estimatedTotal > 0 && (
            <span>Customer est: <strong className="text-dhaba-text">₹{item.estimatedTotal}</strong></span>
          )}
          {item.depositAmount > 0 && (
            <span>Deposit: <strong className="text-dhaba-text">₹{item.depositAmount}</strong></span>
          )}
          <div className="flex items-center gap-1 ml-auto">
            <span className="shrink-0">Est. Amt:</span>
            <div className="flex items-center glass-input rounded-lg px-2 py-1">
              <span className="text-dhaba-muted mr-0.5">₹</span>
              <input
                type="number"
                min={0}
                value={estimatedAmount}
                onChange={(e) => setEstimatedAmount(Number(e.target.value))}
                className="w-20 bg-transparent text-dhaba-text outline-none text-xs"
              />
            </div>
          </div>
        </div>

        {/* Admin note + save */}
        <div className="flex items-center gap-2">
          <input
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            placeholder="Admin note…"
            className="glass-input rounded-xl px-4 py-2 text-sm flex-1 bg-transparent placeholder:text-dhaba-muted/50 outline-none"
          />
          <button
            onClick={handleSaveDetails}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-gradient-warm text-dhaba-bg hover:shadow-glow transition-all disabled:opacity-50 shrink-0"
          >
            {saving ? <FaSpinner className="animate-spin" /> : "Save"}
          </button>
        </div>

        {/* Status action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {item.status === "pending" && (
            <button
              onClick={() => handleStatusChange("confirmed")}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-dhaba-success/15 text-dhaba-success hover:bg-dhaba-success/25 transition-colors"
            >
              Confirm
            </button>
          )}
          {(item.status === "pending" || item.status === "confirmed") && (
            <button
              onClick={() => handleStatusChange("cancelled")}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-dhaba-danger/15 text-dhaba-danger hover:bg-dhaba-danger/25 transition-colors"
            >
              Cancel
            </button>
          )}
          {item.status === "confirmed" && (
            <button
              onClick={() => handleStatusChange("completed")}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 transition-colors"
            >
              Complete
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="ml-auto p-2 rounded-lg text-dhaba-muted hover:text-dhaba-danger hover:bg-dhaba-danger/10 transition-colors"
            title="Delete"
          >
            {deleting ? <FaSpinner className="animate-spin text-xs" /> : <FaTrash className="text-xs" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const Requests: React.FC = () => {
  useEffect(() => { document.title = "Dhaba POS | Requests"; }, []);
  const { enqueueSnackbar } = useSnackbar();

  const [activeTab, setActiveTab]         = useState<"dish" | "preorder">("dish");
  const [dishFilter, setDishFilter]       = useState("all");
  const [preOrderFilter, setPreOrderFilter] = useState("all");
  const [dishRequests, setDishRequests]   = useState<DishRequest[]>([]);
  const [preOrders, setPreOrders]         = useState<PreOrder[]>([]);
  const [loading, setLoading]             = useState(false);

  const fetchDishRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getDishRequests(dishFilter !== "all" ? { status: dishFilter } : undefined);
      setDishRequests((res.data as { data: DishRequest[] }).data ?? []);
    } catch {
      enqueueSnackbar("Failed to load dish requests", { variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [dishFilter, enqueueSnackbar]);

  const fetchPreOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPreOrders(preOrderFilter !== "all" ? { status: preOrderFilter } : undefined);
      setPreOrders((res.data as { data: PreOrder[] }).data ?? []);
    } catch {
      enqueueSnackbar("Failed to load pre-orders", { variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [preOrderFilter, enqueueSnackbar]);

  useEffect(() => { if (activeTab === "dish") fetchDishRequests(); }, [activeTab, fetchDishRequests]);
  useEffect(() => { if (activeTab === "preorder") fetchPreOrders(); }, [activeTab, fetchPreOrders]);

  // ── Handlers ──

  async function handleSaveDish(id: string, status: string, adminNote: string) {
    try {
      await updateDishRequest(id, { status, adminNote });
      enqueueSnackbar("Updated", { variant: "success" });
      fetchDishRequests();
    } catch {
      enqueueSnackbar("Failed to update", { variant: "error" });
    }
  }

  async function handleDeleteDish(id: string) {
    try {
      await deleteDishRequest(id);
      enqueueSnackbar("Deleted", { variant: "success" });
      setDishRequests((prev) => prev.filter((d) => d._id !== id));
    } catch {
      enqueueSnackbar("Failed to delete", { variant: "error" });
    }
  }

  async function handleUpdatePreOrder(
    id: string,
    data: { status?: string; adminNote?: string; estimatedAmount?: number }
  ) {
    try {
      await updatePreOrder(id, data);
      enqueueSnackbar("Updated", { variant: "success" });
      fetchPreOrders();
    } catch {
      enqueueSnackbar("Failed to update", { variant: "error" });
    }
  }

  async function handleDeletePreOrder(id: string) {
    try {
      await deletePreOrder(id);
      enqueueSnackbar("Deleted", { variant: "success" });
      setPreOrders((prev) => prev.filter((p) => p._id !== id));
    } catch {
      enqueueSnackbar("Failed to delete", { variant: "error" });
    }
  }

  // ── Summary counts ──
  const pendingDish     = dishRequests.filter((d) => d.status === "pending").length;
  const pendingPreOrder = preOrders.filter((p) => p.status === "pending").length;
  const depositPaidCount = preOrders.filter((p) => p.depositPaid).length;

  return (
    <section className="bg-dhaba-bg min-h-[calc(100vh-4rem)] pb-24 overflow-y-auto">
      <div className="px-8 pt-6 space-y-6 max-w-[1400px] mx-auto">

        {/* ── Page hero ── */}
        <div className="bg-gradient-to-br from-dhaba-surface to-dhaba-bg border border-dhaba-border/20 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-dhaba-accent/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center gap-3 relative z-10 mb-1">
            <FaClipboardList className="text-2xl text-dhaba-accent" />
            <h1 className="font-display text-2xl font-bold text-dhaba-text">Customer Requests</h1>
          </div>
          <p className="text-sm text-dhaba-muted relative z-10">
            Dish suggestions & advance food bookings
          </p>
        </div>

        {/* ── Summary chips ── */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border bg-dhaba-warning/10 text-dhaba-warning border-dhaba-warning/20">
            {pendingDish} dish {pendingDish === 1 ? "request" : "requests"} pending
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border bg-blue-500/10 text-blue-400 border-blue-500/20">
            {pendingPreOrder} pre-{pendingPreOrder === 1 ? "order" : "orders"} pending
          </span>
          {depositPaidCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border bg-dhaba-success/10 text-dhaba-success border-dhaba-success/20">
              <FaCheck className="text-[10px]" /> {depositPaidCount} deposit{depositPaidCount === 1 ? "" : "s"} paid
            </span>
          )}
        </div>

        {/* ── Tab switcher ── */}
        <div className="glass-card rounded-xl p-1 flex gap-1 self-start w-fit">
          {(["dish", "preorder"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === tab
                  ? "bg-dhaba-accent/15 text-dhaba-accent"
                  : "text-dhaba-muted hover:text-dhaba-text"
              }`}
            >
              {tab === "dish" ? "Dish Requests" : "Pre-Orders"}
            </button>
          ))}
        </div>

        {/* ── Status filter pills ── */}
        {activeTab === "dish" ? (
          <div className="glass-card rounded-xl p-1 flex gap-1 flex-wrap w-fit">
            {["all", ...DISH_STATUSES].map((s) => (
              <button
                key={s}
                onClick={() => setDishFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  dishFilter === s
                    ? "bg-dhaba-accent/15 text-dhaba-accent"
                    : "text-dhaba-muted hover:text-dhaba-text"
                }`}
              >
                {s === "all" ? "All" : dishStatusCfg[s].label}
              </button>
            ))}
          </div>
        ) : (
          <div className="glass-card rounded-xl p-1 flex gap-1 flex-wrap w-fit">
            {["all", ...PREORDER_STATUSES].map((s) => (
              <button
                key={s}
                onClick={() => setPreOrderFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  preOrderFilter === s
                    ? "bg-dhaba-accent/15 text-dhaba-accent"
                    : "text-dhaba-muted hover:text-dhaba-text"
                }`}
              >
                {s === "all" ? "All" : preOrderStatusCfg[s].label}
              </button>
            ))}
          </div>
        )}

        {/* ── Content ── */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <FaSpinner className="animate-spin text-3xl text-dhaba-accent" />
          </div>
        ) : activeTab === "dish" ? (
          dishRequests.length === 0 ? (
            <div className="glass-card rounded-xl p-10 text-center space-y-3">
              <FaClipboardList className="text-4xl text-dhaba-muted mx-auto" />
              <p className="text-dhaba-muted text-sm">No dish requests yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {dishRequests.map((item) => (
                <DishRequestCard
                  key={item._id}
                  item={item}
                  onSave={handleSaveDish}
                  onDelete={handleDeleteDish}
                />
              ))}
            </div>
          )
        ) : (
          preOrders.length === 0 ? (
            <div className="glass-card rounded-xl p-10 text-center space-y-3">
              <FaCalendarAlt className="text-4xl text-dhaba-muted mx-auto" />
              <p className="text-dhaba-muted text-sm">No pre-orders yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {preOrders.map((item) => (
                <PreOrderCard
                  key={item._id}
                  item={item}
                  onUpdate={handleUpdatePreOrder}
                  onDelete={handleDeletePreOrder}
                />
              ))}
            </div>
          )
        )}

      </div>
    </section>
  );
};

export default Requests;
