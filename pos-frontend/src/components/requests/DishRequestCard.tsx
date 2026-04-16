import React, { useState } from "react";
import { FaUtensils, FaSpinner, FaTrash, FaUser, FaPhone } from "react-icons/fa";
import { DishRequest } from "../../types";
import { initials, fmtDate, dishStatusCfg, DISH_STATUSES } from "./RequestsHelpers";

interface DishRequestCardProps {
  item: DishRequest;
  onSave: (id: string, status: string, adminNote: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const DishRequestCard: React.FC<DishRequestCardProps> = ({ item, onSave, onDelete }) => {
  const [status, setStatus] = useState(item.status);
  const [adminNote, setAdminNote] = useState(item.adminNote || "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
    <div className="group relative bg-[#1A1C23]/80 backdrop-blur-md rounded-2xl p-5 border border-white/5 shadow-xl hover:shadow-2xl hover:border-dhaba-accent/30 transition-all duration-300">
      {/* Glow Effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-dhaba-accent/5 to-transparent opacity-0 group-hover:opacity-100 rounded-2xl transition-opacity duration-500 pointer-events-none" />

      {/* Header */}
      <div className="flex items-start gap-4 mb-4 relative z-10">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-dhaba-accent to-orange-600 text-white font-bold text-lg flex items-center justify-center shrink-0 shadow-lg shadow-dhaba-accent/20">
          {initials(item.customerName)}
        </div>
        
        <div className="flex-1 min-w-0 flex flex-col justify-center h-12">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-white text-base truncate">{item.customerName}</h3>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase shadow-sm ${cfg.badge}`}>
              {cfg.label}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-dhaba-muted">
            <span className="flex items-center gap-1.5"><FaPhone className="text-[10px]" /> {item.customerPhone}</span>
            <span className="w-1 h-1 rounded-full bg-dhaba-muted/50"></span>
            <span>{fmtDate(item.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Dish Info container */}
      <div className="bg-black/20 rounded-xl p-4 mb-5 border border-white/5 relative z-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-dhaba-accent/10 flex items-center justify-center shrink-0">
            <FaUtensils className="text-dhaba-accent text-sm" />
          </div>
          <span className="font-semibold text-white text-lg tracking-tight">{item.dishName}</span>
        </div>
        {item.description && (
          <p className="text-sm text-dhaba-muted/80 pl-11 italic border-l-2 border-dhaba-accent/30 ml-4 py-0.5">
            "{item.description}"
          </p>
        )}
      </div>

      {/* Action Controls */}
      <div className="flex flex-col gap-3 relative z-10">
        <div className="flex items-center gap-3">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as DishRequest["status"])}
            className="bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm font-semibold text-white outline-none focus:border-dhaba-accent focus:ring-1 focus:ring-dhaba-accent/50 transition-all shrink-0 cursor-pointer hover:bg-black/40"
          >
            {DISH_STATUSES.map((s) => (
              <option key={s} value={s} className="bg-[#1A1C23] text-white">
                {dishStatusCfg[s].label}
              </option>
            ))}
          </select>
          <input
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            placeholder="Add internal note..."
            className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-dhaba-accent focus:ring-1 focus:ring-dhaba-accent/50 transition-all hover:bg-black/40"
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-dhaba-muted hover:text-dhaba-danger hover:bg-dhaba-danger/10 transition-colors disabled:opacity-50"
          >
            {deleting ? <FaSpinner className="animate-spin" /> : <FaTrash />}
            Delete
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-dhaba-accent to-orange-500 text-white shadow-lg shadow-dhaba-accent/20 hover:shadow-dhaba-accent/40 transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:transform-none"
          >
            {saving ? <FaSpinner className="animate-spin" /> : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DishRequestCard;
