import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { FaTimes, FaCheckCircle } from "react-icons/fa";

// ── Merchant config ────────────────────────────────────────────────────────────
// Verify UPI ID in PhonePe Business app → Settings → Business Profile → UPI ID
const MERCHANT_UPI_ID = "Q69742875@ybl";
const MERCHANT_NAME = "Sahu Dhaba";
// ──────────────────────────────────────────────────────────────────────────────

interface UpiQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  amount: number;
  orderRef: string;
  isConfirming: boolean;
}

const UpiQrModal: React.FC<UpiQrModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  amount,
  orderRef,
  isConfirming,
}) => {
  const upiLink =
    `upi://pay?pa=${MERCHANT_UPI_ID}` +
    `&pn=${encodeURIComponent(MERCHANT_NAME)}` +
    `&am=${amount.toFixed(2)}` +
    `&cu=INR` +
    `&tn=${encodeURIComponent(`Order ${orderRef}`)}`;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-dhaba-bg/80 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="glass-card w-full max-w-xs rounded-3xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-dhaba-border/20">
              <div>
                <h2 className="font-display text-base font-bold text-dhaba-text">Pay via UPI</h2>
                <p className="text-xs text-dhaba-muted">Scan with any UPI app</p>
              </div>
              <button
                onClick={onClose}
                disabled={isConfirming}
                className="p-2 hover:bg-dhaba-danger/10 rounded-xl transition-colors group disabled:opacity-40"
              >
                <FaTimes className="text-dhaba-muted group-hover:text-dhaba-danger" />
              </button>
            </div>

            {/* QR + amount */}
            <div className="flex flex-col items-center gap-4 px-6 py-6">
              {/* Amount badge */}
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-xs text-dhaba-muted font-semibold uppercase tracking-wider">Amount Due</span>
                <span className="font-display text-3xl font-bold text-dhaba-accent">₹{amount.toFixed(0)}</span>
              </div>

              {/* QR code */}
              <div className="p-3 bg-white rounded-2xl shadow-md">
                <QRCodeSVG
                  value={upiLink}
                  size={180}
                  level="M"
                  includeMargin={false}
                />
              </div>

              {/* UPI ID */}
              <div className="text-center">
                <p className="text-[10px] text-dhaba-muted uppercase tracking-wider font-bold mb-0.5">UPI ID</p>
                <p className="text-sm font-mono font-semibold text-dhaba-text">{MERCHANT_UPI_ID}</p>
              </div>

              {/* Supported apps hint */}
              <p className="text-[10px] text-dhaba-muted text-center leading-relaxed">
                Works with PhonePe · Google Pay · Paytm · BHIM · any UPI app
              </p>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-dhaba-border/20 space-y-2">
              <p className="text-[10px] text-dhaba-muted text-center">
                After the customer pays, verify in <span className="font-bold text-dhaba-text">PhonePe Business</span> app and tap below.
              </p>
              <button
                onClick={onConfirm}
                disabled={isConfirming}
                className="w-full flex items-center justify-center gap-2 bg-gradient-warm text-dhaba-bg py-3 rounded-xl font-bold text-sm hover:shadow-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConfirming ? (
                  <>
                    <span className="w-4 h-4 border-2 border-dhaba-bg border-t-transparent rounded-full animate-spin" />
                    Processing…
                  </>
                ) : (
                  <>
                    <FaCheckCircle />
                    Mark as Paid
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default UpiQrModal;
