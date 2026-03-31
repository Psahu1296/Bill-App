import { motion, AnimatePresence } from "framer-motion";
import { FaChevronDown, FaChevronUp, FaEdit, FaTrash } from "react-icons/fa";
import type { CustomerLedger, LedgerTransaction } from "../../types";

function getAvatarInitials(name: string) {
  return name.trim().split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function withRunningBalance(txs: LedgerTransaction[]): (LedgerTransaction & { runningBalance: number })[] {
  const oldest = [...txs].reverse();
  let bal = 0;
  const withBal = oldest.map((tx) => {
    const isCredit =
      tx.transactionType === "balance_decreased" ||
      tx.transactionType === "payment_received";
    bal = isCredit ? bal - tx.amount : bal + tx.amount;
    return { ...tx, runningBalance: Math.max(0, bal) };
  });
  return withBal.reverse();
}

function formatTxType(type: string) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface LedgerCustomerCardProps {
  customer: CustomerLedger;
  isExpanded: boolean;
  onExpand: () => void;
  onRecordPayment: (customer: CustomerLedger) => void;
  onSettle: (customer: CustomerLedger) => void;
  onEdit: (customer: CustomerLedger) => void;
  onDelete: (customer: CustomerLedger) => void;
}

const LedgerCustomerCard: React.FC<LedgerCustomerCardProps> = ({
  customer, isExpanded, onExpand, onRecordPayment, onSettle, onEdit, onDelete,
}) => {
  const txsWithBal = withRunningBalance(customer.transactions ?? []);

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* Row */}
      <div
        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-dhaba-surface-hover transition-colors"
        onClick={onExpand}
      >
        {/* Avatar */}
        <div className="h-10 w-10 rounded-xl bg-gradient-warm flex items-center justify-center text-dhaba-bg font-bold text-sm shrink-0">
          {getAvatarInitials(customer.customerName)}
        </div>

        {/* Name + phone */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-dhaba-text truncate">{customer.customerName}</p>
          <p className="text-xs text-dhaba-muted">{customer.customerPhone}</p>
        </div>

        {/* Balance */}
        <div className="text-right shrink-0">
          <p className={`font-display text-lg font-bold ${customer.balanceDue > 0 ? "text-dhaba-danger" : "text-dhaba-success"}`}>
            ₹{(customer.balanceDue ?? 0).toFixed(2)}
          </p>
          <p className="text-[10px] text-dhaba-muted font-medium">
            {customer.balanceDue > 0 ? "outstanding" : "settled"}
          </p>
        </div>

        {/* Pay / Settle buttons */}
        {customer.balanceDue > 0 && (
          <div className="flex gap-2 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onRecordPayment(customer); }}
              className="px-4 py-1.5 rounded-xl bg-gradient-warm text-dhaba-bg text-xs font-bold hover:shadow-glow transition-all"
            >
              Pay
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onSettle(customer); }}
              className="px-3 py-1.5 rounded-xl bg-dhaba-accent/10 text-dhaba-accent border border-dhaba-accent/20 text-xs font-bold hover:bg-dhaba-accent/20 transition-all"
            >
              Settle Orders
            </button>
          </div>
        )}

        {/* Edit / Delete */}
        <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onEdit(customer)}
            className="p-2 rounded-lg hover:bg-dhaba-accent/10 text-dhaba-muted hover:text-dhaba-accent transition-colors"
            title="Edit"
          >
            <FaEdit size={12} />
          </button>
          <button
            onClick={() => onDelete(customer)}
            className="p-2 rounded-lg hover:bg-dhaba-danger/10 text-dhaba-muted hover:text-dhaba-danger transition-colors"
            title="Delete"
          >
            <FaTrash size={12} />
          </button>
        </div>

        {/* Expand chevron */}
        <span className="text-dhaba-muted shrink-0">
          {isExpanded ? <FaChevronUp size={12} /> : <FaChevronDown size={12} />}
        </span>
      </div>

      {/* Expanded transactions */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="border-t border-dhaba-border/20 overflow-hidden"
          >
            <div className="p-4 space-y-2">
              <p className="text-xs font-bold text-dhaba-muted uppercase tracking-wider mb-3">
                Transaction History
              </p>

              {txsWithBal.length === 0 ? (
                <p className="text-sm text-dhaba-muted text-center py-4">No transactions in this period.</p>
              ) : (
                <>
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-3 py-1.5 text-[10px] font-bold text-dhaba-muted uppercase tracking-wider">
                    <span>Type</span>
                    <span className="text-right">Amount</span>
                    <span className="text-right">Balance After</span>
                    <span className="text-right">Date</span>
                  </div>
                  <div className="space-y-1">
                    {txsWithBal.map((tx, idx) => {
                      const isCredit =
                        tx.transactionType === "balance_decreased" ||
                        tx.transactionType === "payment_received";
                      return (
                        <div
                          key={idx}
                          className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-3 py-2.5 rounded-xl bg-dhaba-surface/40 hover:bg-dhaba-surface-hover transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-dhaba-text truncate">
                              {formatTxType(tx.transactionType)}
                            </p>
                            {tx.notes && (
                              <p className="text-[10px] text-dhaba-muted truncate">{tx.notes}</p>
                            )}
                            {tx.orderId && (
                              <p className="text-[10px] text-dhaba-muted">Order #{tx.orderId.slice(-6)}</p>
                            )}
                          </div>
                          <span className={`text-sm font-bold tabular-nums ${isCredit ? "text-dhaba-success" : "text-dhaba-danger"}`}>
                            {isCredit ? "−" : "+"}₹{tx.amount.toFixed(2)}
                          </span>
                          <span className="text-xs font-semibold text-dhaba-text tabular-nums text-right">
                            ₹{tx.runningBalance.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-dhaba-muted text-right whitespace-nowrap">
                            {new Date(tx.timestamp).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                            <br />
                            {new Date(tx.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LedgerCustomerCard;
