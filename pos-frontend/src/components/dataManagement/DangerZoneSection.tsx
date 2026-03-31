import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaBomb, FaCheckCircle, FaExclamationTriangle, FaTrashAlt,
} from "react-icons/fa";
import axios from "axios";

interface DangerZoneSectionProps {
  onStorageStatsRefresh: () => void;
}

type ResetStep = 0 | 1 | 2;
type ActionResult = { type: "success" | "error"; message: string };

const DangerZoneSection: React.FC<DangerZoneSectionProps> = ({ onStorageStatsRefresh }) => {
  const [resetStep, setResetStep]       = useState<ResetStep>(0);
  const [resetPhrase, setResetPhrase]   = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetProcessing, setResetProcessing] = useState(false);
  const [resetResult, setResetResult]   = useState<ActionResult | null>(null);

  const handleReset = async () => {
    if (resetPhrase !== "RESET" || !resetPassword) return;
    setResetProcessing(true);
    setResetResult(null);
    try {
      await axios.post<{ success: boolean; message: string }>("/api/data/reset", {
        confirmPhrase: resetPhrase,
        password: resetPassword,
      });
      setResetResult({ type: "success", message: "Database reset complete. All operational data cleared." });
      setResetStep(0);
      setResetPhrase("");
      setResetPassword("");
      onStorageStatsRefresh();
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.message : "Reset failed.";
      setResetResult({ type: "error", message: msg ?? "Reset failed." });
    } finally {
      setResetProcessing(false);
    }
  };

  const handleCancelReset = () => {
    setResetStep(0);
    setResetPhrase("");
    setResetPassword("");
  };

  return (
    <div className="container mx-auto px-6 mt-8">
      <div className="rounded-3xl border-2 border-red-500/30 bg-red-500/5 p-6">
        <div className="flex items-center gap-3 mb-1">
          <FaBomb className="text-red-400 text-xl" />
          <h3 className="font-display text-lg font-bold text-red-400">Danger Zone</h3>
        </div>
        <p className="text-dhaba-muted text-sm mb-5">
          Irreversible actions that affect the entire database.
        </p>

        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <p className="text-dhaba-text font-semibold text-sm">Clear Complete Database</p>
            <p className="text-dhaba-muted text-xs mt-0.5 max-w-md">
              Permanently deletes all orders, consumables, ledger entries, earnings, expenses and staff payments.
              Keeps users, menu, tables layout and staff profiles.
            </p>
          </div>
          {resetStep === 0 && (
            <button
              onClick={() => { setResetStep(1); setResetResult(null); }}
              className="shrink-0 px-5 py-2.5 rounded-xl border border-red-500/40 text-red-400 text-sm font-bold hover:bg-red-500/15 transition-all"
            >
              <FaTrashAlt className="inline mr-2" />
              Clear DB
            </button>
          )}
        </div>

        <AnimatePresence>
          {/* Step 1: Warning */}
          {resetStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-5 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 space-y-4"
            >
              <div className="flex gap-3">
                <FaExclamationTriangle className="text-red-400 text-xl shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-red-300 font-semibold text-sm">This will permanently delete:</p>
                  <ul className="text-red-300/80 text-xs space-y-0.5 list-disc list-inside">
                    <li>All orders and their billing history</li>
                    <li>All consumable entries (tea, gutka, cigarettes)</li>
                    <li>All customer ledger balances and transactions</li>
                    <li>All daily earnings records</li>
                    <li>All expenses and payments</li>
                    <li>All staff payment history</li>
                    <li>Tables reset to Available, dish order counts reset to 0</li>
                  </ul>
                  <p className="text-red-300/80 text-xs pt-1">
                    <span className="font-semibold">Kept:</span> Admin / staff accounts, menu dishes, table layout, staff profiles.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setResetStep(0)}
                  className="flex-1 py-2.5 rounded-xl glass-card text-dhaba-muted font-semibold text-sm hover:bg-dhaba-surface-hover transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setResetStep(2)}
                  className="flex-1 py-2.5 rounded-xl bg-red-500/20 text-red-300 font-bold text-sm hover:bg-red-500/30 border border-red-500/40 transition-all"
                >
                  I understand, continue
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 2: Password + confirmation phrase */}
          {resetStep === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-5 p-4 rounded-2xl bg-red-500/10 border border-red-500/40 space-y-4"
            >
              <div className="space-y-1">
                <p className="text-red-300 text-sm font-semibold">Admin password:</p>
                <input
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full glass-input rounded-xl px-4 py-2.5 text-dhaba-text text-sm focus:outline-none placeholder:text-dhaba-muted/50"
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <p className="text-red-300 text-sm font-semibold">
                  Type <span className="font-mono bg-red-500/20 px-1.5 py-0.5 rounded text-red-200">RESET</span> to confirm:
                </p>
                <input
                  type="text"
                  value={resetPhrase}
                  onChange={(e) => setResetPhrase(e.target.value.toUpperCase())}
                  placeholder="RESET"
                  className="w-full glass-input rounded-xl px-4 py-2.5 text-red-200 font-mono text-sm font-bold tracking-widest focus:outline-none placeholder:text-red-400/30"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCancelReset}
                  className="flex-1 py-2.5 rounded-xl glass-card text-dhaba-muted font-semibold text-sm hover:bg-dhaba-surface-hover transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReset}
                  disabled={resetPhrase !== "RESET" || !resetPassword || resetProcessing}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {resetProcessing ? "Resetting..." : "Confirm Reset"}
                </button>
              </div>
            </motion.div>
          )}

          {/* Result */}
          {resetResult && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`mt-4 p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                resetResult.type === "success"
                  ? "bg-green-500/10 text-green-400 border border-green-500/20"
                  : "bg-dhaba-danger/10 text-red-400 border border-dhaba-danger/20"
              }`}
            >
              {resetResult.type === "success" ? <FaCheckCircle /> : <FaExclamationTriangle />}
              {resetResult.message}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default DangerZoneSection;
