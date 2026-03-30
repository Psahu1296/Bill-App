import React from "react";
import { MdDeleteOutline } from "react-icons/md";

interface DeleteOrderModalProps {
  isOpen: boolean;
  orderId: string;
  customerName: string;
  password: string;
  isPending: boolean;
  onPasswordChange: (v: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

const DeleteOrderModal: React.FC<DeleteOrderModalProps> = ({
  isOpen, orderId, customerName, password, isPending, onPasswordChange, onConfirm, onClose,
}) => {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { e.stopPropagation(); onClose(); }}
    >
      <div className="glass-card rounded-2xl p-6 w-80 shadow-glow" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-dhaba-danger/15 flex items-center justify-center shrink-0">
            <MdDeleteOutline className="text-xl text-dhaba-danger" />
          </div>
          <div>
            <p className="font-bold text-dhaba-text text-sm">Delete Order?</p>
            <p className="text-xs text-dhaba-muted">#{orderId} · {customerName}</p>
          </div>
        </div>
        <p className="text-xs text-dhaba-muted mb-4 leading-relaxed">
          This permanently deletes the order and reverses any outstanding ledger balance and earnings.
        </p>
        <input
          type="password"
          placeholder="Enter your password to confirm"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="glass-input w-full rounded-xl px-4 py-2.5 text-sm mb-4 focus:outline-none focus:ring-1 focus:ring-dhaba-danger/50"
          autoFocus
        />
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-dhaba-surface text-dhaba-muted hover:bg-dhaba-surface-hover transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={isPending || !password}
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-dhaba-danger/15 text-dhaba-danger hover:bg-dhaba-danger/25 transition-colors disabled:opacity-50"
          >
            {isPending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteOrderModal;
