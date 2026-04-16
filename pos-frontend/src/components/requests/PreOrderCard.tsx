import React, { useState } from "react";
import { 
  FaCalendarAlt, FaUsers, FaCheck, FaMapMarkerAlt, 
  FaSpinner, FaTrash, FaPhone, FaClipboardList, FaMoneyBillWave 
} from "react-icons/fa";
import { PreOrder } from "../../types";
import { fmtScheduled, preOrderStatusCfg, initials } from "./RequestsHelpers";
import PreOrderPaymentModal from "./PreOrderPaymentModal";

interface PreOrderCardProps {
  item: PreOrder;
  onUpdate: (id: string, data: { status?: string; adminNote?: string; estimatedAmount?: number; depositAmount?: number; depositPaid?: boolean }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const PreOrderCard: React.FC<PreOrderCardProps> = ({ item, onUpdate, onDelete }) => {
  const [adminNote, setAdminNote] = useState(item.adminNote || "");
  const [estimatedAmount, setEstimatedAmount] = useState<number>(item.estimatedAmount || 0);
  const [depositAmount, setDepositAmount] = useState<number>(item.depositAmount || 0);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const cfg = preOrderStatusCfg[item.status] ?? preOrderStatusCfg.pending;

  async function handleStatusChange(newStatus: string) {
    setSaving(true);
    await onUpdate(item._id, { status: newStatus });
    setSaving(false);
  }

  async function handleSaveDetails() {
    setSaving(true);
    await onUpdate(item._id, { 
      adminNote, 
      estimatedAmount: Number(estimatedAmount),
      depositAmount: Number(depositAmount),
      depositPaid: Number(depositAmount) > 0
    });
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
    .join(" • ");
  const extraItems = item.items.length > 3 ? `+${item.items.length - 3} more` : "";

  // Dynamic styling based on order type
  const orderTypeColors: Record<string, string> = {
    delivery: "bg-purple-500/15 text-purple-400 border-purple-500/20",
    pickup: "bg-teal-500/15 text-teal-400 border-teal-500/20",
    "dine-in": "bg-blue-500/15 text-blue-400 border-blue-500/20",
  };
  const typeBadgeClass = orderTypeColors[item.orderType.toLowerCase()] || "bg-gray-500/15 text-gray-400 border-gray-500/20";

  return (
    <div className={`group relative bg-[#1A1C23]/80 backdrop-blur-md rounded-2xl overflow-hidden border border-white/5 shadow-xl hover:shadow-2xl transition-all duration-300 flex flex-col h-full`}>
      {/* Decorative vertical band matching status color */}
      <div className={`absolute top-0 bottom-0 left-0 w-1.5 ${cfg.border} shadow-[0_0_10px_currentColor] opacity-70`} />
      
      {/* Glow Effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      {/* Header Section */}
      <div className="p-5 pb-4 border-b border-white/5 bg-gradient-to-b from-white/[0.04] to-transparent relative z-10 flex-shrink-0">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-black/40 border border-white/10 text-white font-bold text-sm flex items-center justify-center shrink-0">
              {initials(item.customerName)}
            </div>
            <div>
              <h3 className="font-bold text-white text-base leading-tight">{item.customerName}</h3>
              <div className="flex items-center gap-1.5 text-xs text-dhaba-muted mt-0.5">
                <FaPhone className="text-[10px]" /> {item.customerPhone}
              </div>
            </div>
          </div>
          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider uppercase border shadow-sm ${cfg.badge}`}>
            {cfg.label}
          </span>
        </div>

        {/* Info Tags Row */}
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <span className={`px-2 py-1 rounded border text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${typeBadgeClass}`}>
            {item.orderType}
          </span>
          <span className="px-2 py-1 rounded bg-black/30 border border-white/5 text-[10px] text-dhaba-muted flex items-center gap-1.5 font-medium">
            <FaUsers className="text-white/50" /> {item.guestCount} GUESTS
          </span>
          <span className="px-2 py-1 rounded bg-black/30 border border-white/5 text-[10px] text-dhaba-accent flex items-center gap-1.5 font-bold">
             <FaCalendarAlt /> {fmtScheduled(item.scheduledFor)}
          </span>
          {item.depositPaid && (
            <span className="px-2 py-1 rounded bg-dhaba-success/15 border border-dhaba-success/30 text-[10px] text-dhaba-success flex items-center gap-1.5 font-bold shadow-[0_0_8px_rgba(34,197,94,0.15)]">
              <FaCheck /> ₹{item.depositAmount} ADVANCE
            </span>
          )}
        </div>

        {item.orderType === "delivery" && item.deliveryAddress && (
          <div className="mt-3 flex items-start gap-2 text-[11px] text-dhaba-muted/80 bg-black/20 p-2 rounded-lg border border-white/5">
            <FaMapMarkerAlt className="text-dhaba-danger mt-0.5 shrink-0" />
            <span className="line-clamp-2 leading-relaxed">{item.deliveryAddress}</span>
          </div>
        )}
      </div>

      {/* Body Section (Items & Estimates) */}
      <div className="p-5 bg-transparent flex-1 relative z-10 flex flex-col gap-4">
        {/* Order Items */}
        <div>
          <h4 className="text-[10px] uppercase font-bold text-dhaba-muted tracking-widest mb-2 flex items-center gap-1.5">
            <FaClipboardList className="text-white/40" /> Order Summary
          </h4>
          <div className="bg-black/20 rounded-xl p-3 border border-white/5">
            <p className="text-sm text-white font-medium leading-relaxed">
              {itemsPreview} 
              {extraItems && <span className="text-dhaba-accent ml-2 text-xs font-bold bg-dhaba-accent/10 px-1.5 py-0.5 rounded">{extraItems}</span>}
            </p>
            {item.specialInstructions && (
              <p className="mt-2 text-xs text-yellow-500/80 italic border-l-2 border-yellow-500/30 pl-2 py-0.5">
                "{item.specialInstructions}"
              </p>
            )}
          </div>
        </div>

        {/* Financial Details */}
        <div className="bg-black/20 rounded-xl p-3 border border-white/5 mt-auto">
          <div className="flex items-center justify-between text-xs mb-2 pb-2 border-b border-white/5">
             <span className="text-dhaba-muted font-medium">Customer Estim.:</span>
             <span className="font-bold text-white">₹{item.estimatedTotal || 0}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-dhaba-muted flex items-center gap-1.5 font-medium text-xs">
              <FaMoneyBillWave className="text-dhaba-accent/70" /> Our Estimate:
            </span>
            <div className="flex items-center bg-black/40 border border-white/10 rounded-lg overflow-hidden focus-within:border-dhaba-accent focus-within:ring-1 focus-within:ring-dhaba-accent/50 transition-all">
              <span className="text-dhaba-muted px-2 py-1.5 bg-white/5 border-r border-white/5 text-xs font-bold leading-none flex items-center">₹</span>
              <input
                type="number"
                min={0}
                value={estimatedAmount || ""}
                onChange={(e) => setEstimatedAmount(Number(e.target.value))}
                placeholder="0"
                className="w-16 bg-transparent text-white font-bold text-sm px-2 py-1 outline-none text-right placeholder:text-white/20"
              />
            </div>
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
            <span className="text-dhaba-muted flex items-center gap-1.5 font-medium text-xs">
              <FaCheck className="text-dhaba-success/70" /> Deposit Recv:
            </span>
            <div className="flex items-center bg-black/40 border border-white/10 rounded-lg overflow-hidden focus-within:border-dhaba-success focus-within:ring-1 focus-within:ring-dhaba-success/50 transition-all">
              <span className="text-dhaba-muted px-2 py-1.5 bg-white/5 border-r border-white/5 text-xs font-bold leading-none flex items-center">₹</span>
              <input
                type="number"
                min={0}
                value={depositAmount || ""}
                onChange={(e) => setDepositAmount(Number(e.target.value))}
                placeholder="0"
                className="w-16 bg-transparent text-white font-bold text-sm px-2 py-1 outline-none text-right placeholder:text-white/20"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer Section (Actions) */}
      <div className="p-5 pt-4 bg-black/40 border-t border-white/5 relative z-10 flex-shrink-0 space-y-3">
        {/* Admin Note Input */}
        <div className="flex gap-2">
          <input
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            placeholder="Internal admin note..."
            className="flex-1 bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/30 outline-none focus:border-dhaba-accent focus:ring-1 focus:ring-dhaba-accent/50 transition-all"
          />
          <button
            onClick={handleSaveDetails}
            disabled={saving}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-white/10 text-white hover:bg-white/20 border border-white/5 hover:border-white/20 transition-all disabled:opacity-50 shrink-0"
          >
            {saving ? <FaSpinner className="animate-spin" /> : "Save"}
          </button>
        </div>

        {/* Status Actions */}
        <div className="flex items-center justify-between pt-1">
           <div className="flex gap-2">
              {item.status === "pending" && (
                <button
                  onClick={() => handleStatusChange("confirmed")}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-dhaba-success/20 text-dhaba-success hover:bg-dhaba-success hover:text-white border border-dhaba-success/30 transition-colors shadow-sm"
                >
                  Confirm
                </button>
              )}
              {item.status === "confirmed" && (
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white border border-blue-500/30 transition-colors shadow-sm"
                >
                  Complete
                </button>
              )}
              {(item.status === "pending" || item.status === "confirmed") && (
                <button
                  onClick={() => handleStatusChange("cancelled")}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-dhaba-danger/10 text-dhaba-danger hover:bg-dhaba-danger/20 border border-dhaba-danger/20 transition-colors"
                >
                  Cancel
                </button>
              )}
           </div>

           <button
             onClick={handleDelete}
             disabled={deleting}
             className="w-8 h-8 flex items-center justify-center rounded-lg text-dhaba-muted hover:text-dhaba-danger hover:bg-dhaba-danger/10 transition-colors disabled:opacity-50 ml-auto"
             title="Delete Pre-order"
           >
             {deleting ? <FaSpinner className="animate-spin text-xs" /> : <FaTrash className="text-xs" />}
           </button>
         </div>
      </div>

      {showPaymentModal && (
        <PreOrderPaymentModal
          item={item}
          onClose={() => setShowPaymentModal(false)}
          onConfirm={async (amountPaid, method) => {
            const newDeposit = (item.depositAmount || 0) + amountPaid;
            const paymentNote = amountPaid > 0 ? `[Action: Completed with payment ₹${amountPaid} via ${method}]` : `[Action: Completed without payment]`;
            const newNote = adminNote ? `${adminNote}\n${paymentNote}` : paymentNote;
            
            await onUpdate(item._id, {
              status: "completed",
              depositAmount: newDeposit,
              depositPaid: newDeposit > 0,
              adminNote: newNote,
            });
            setShowPaymentModal(false);
          }}
        />
      )}
    </div>
  );
}

export default PreOrderCard;
