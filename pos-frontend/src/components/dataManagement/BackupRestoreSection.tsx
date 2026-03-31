import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaCheckCircle, FaExclamationTriangle, FaFolderOpen,
  FaSave, FaSync, FaUpload,
} from "react-icons/fa";
import { MdRestore } from "react-icons/md";
import axios from "axios";

interface BackupRestoreSectionProps {
  selectedModules: string[];
  startDate: string;
  endDate: string;
  onStorageStatsRefresh: () => void;
}

type ActionResult = { type: "success" | "error"; message: string };

const isFileSystemAPIAvailable = "showDirectoryPicker" in window;

const BackupRestoreSection: React.FC<BackupRestoreSectionProps> = ({
  selectedModules,
  startDate,
  endDate,
  onStorageStatsRefresh,
}) => {
  const [dirHandle, setDirHandle]               = useState<FileSystemDirectoryHandle | null>(null);
  const [backupProcessing, setBackupProcessing] = useState(false);
  const [restoreFile, setRestoreFile]           = useState<File | null>(null);
  const [restoreProcessing, setRestoreProcessing] = useState(false);
  const [recalcProcessing, setRecalcProcessing] = useState(false);
  const [result, setResult]                     = useState<ActionResult | null>(null);

  const handleChooseFolder = async () => {
    try {
      const handle = await (window as unknown as { showDirectoryPicker: (opts?: object) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker({ mode: "readwrite" });
      setDirHandle(handle);
      setResult(null);
    } catch {
      // User cancelled — do nothing
    }
  };

  const handleBackup = async () => {
    if (!dirHandle) {
      setResult({ type: "error", message: "Please choose a folder first." });
      return;
    }
    const modules = selectedModules.length ? selectedModules : ["orders", "staff", "consumables", "tables", "dishes", "ledger"];
    setBackupProcessing(true);
    setResult(null);
    try {
      const params = new URLSearchParams({ modules: modules.join(","), startDate, endDate, format: "json" });
      const res = await axios.get<Blob>(`/api/data/export?${params.toString()}`, { responseType: "blob" });
      const date = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const filename = `dhaba_backup_${date}.json`;
      const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(res.data);
      await writable.close();
      setResult({ type: "success", message: `Saved "${filename}" to "${dirHandle.name}"` });
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.message : null;
      setResult({ type: "error", message: msg ?? "Backup failed." });
    } finally {
      setBackupProcessing(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreFile) return;
    setRestoreProcessing(true);
    setResult(null);
    try {
      const text = await restoreFile.text();
      const data = JSON.parse(text) as unknown;
      await axios.post("/api/data/import", data);
      setResult({ type: "success", message: "Data restored successfully from backup." });
      setRestoreFile(null);
      onStorageStatsRefresh();
    } catch {
      setResult({ type: "error", message: "Restore failed. Ensure the file is a valid backup." });
    } finally {
      setRestoreProcessing(false);
    }
  };

  const handleRecalcEarnings = async () => {
    setRecalcProcessing(true);
    setResult(null);
    try {
      const res = await axios.post<{ success: boolean; message: string }>("/api/data/recalc-earnings");
      setResult({ type: "success", message: res.data.message });
    } catch {
      setResult({ type: "error", message: "Recalculation failed." });
    } finally {
      setRecalcProcessing(false);
    }
  };

  const handleRestoreFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRestoreFile(e.target.files?.[0] ?? null);
    setResult(null);
  };

  return (
    <div className="space-y-4">
      {/* Save backup */}
      <div className="glass rounded-xl p-4 space-y-3">
        <p className="text-dhaba-text font-semibold text-xs uppercase tracking-wider">Save Backup</p>
        {!isFileSystemAPIAvailable ? (
          <p className="text-dhaba-muted text-xs">
            Your browser does not support folder picking. Use{" "}
            <span className="font-semibold">Download</span> tab instead.
          </p>
        ) : (
          <>
            <button
              onClick={handleChooseFolder}
              className="w-full flex items-center gap-2 py-2.5 px-4 rounded-xl glass-card text-dhaba-accent text-sm font-semibold hover:bg-dhaba-surface-hover transition-all"
            >
              <FaFolderOpen />
              {dirHandle ? dirHandle.name : "Choose Folder…"}
            </button>
            {dirHandle && (
              <p className="text-dhaba-muted text-[10px] text-center">
                Modules: {selectedModules.length ? selectedModules.join(", ") : "all"} · JSON
              </p>
            )}
            <button
              onClick={handleBackup}
              disabled={!dirHandle || backupProcessing}
              className="w-full py-2.5 rounded-xl font-bold text-sm transition-all bg-gradient-warm text-dhaba-bg hover:shadow-glow disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {backupProcessing ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full" />
                  Creating backup…
                </span>
              ) : (
                <><FaSave className="inline mr-2" />Create Backup</>
              )}
            </button>
          </>
        )}
      </div>

      {/* Restore */}
      <div className="glass rounded-xl p-4 space-y-3">
        <p className="text-dhaba-text font-semibold text-xs uppercase tracking-wider">Restore from Backup</p>
        <label className="w-full flex items-center gap-2 py-2.5 px-4 rounded-xl glass-card text-dhaba-muted text-sm font-semibold hover:bg-dhaba-surface-hover transition-all cursor-pointer">
          <FaUpload className="text-dhaba-accent" />
          {restoreFile ? restoreFile.name : "Choose backup file…"}
          <input
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleRestoreFileChange}
          />
        </label>
        <button
          onClick={handleRestore}
          disabled={!restoreFile || restoreProcessing}
          className="w-full py-2.5 rounded-xl font-bold text-sm bg-dhaba-info/15 text-blue-300 hover:bg-dhaba-info/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {restoreProcessing ? (
            <><span className="animate-spin h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full" />Restoring…</>
          ) : (
            <><MdRestore className="text-lg" />Restore Data</>
          )}
        </button>
      </div>

      {/* Recalculate earnings */}
      <div className="glass rounded-xl p-4 space-y-3">
        <p className="text-dhaba-text font-semibold text-xs uppercase tracking-wider">Fix Earnings</p>
        <p className="text-dhaba-muted text-xs">
          Recomputes daily earnings from actual orders & consumables. Use this if earnings show incorrect values after a restore.
        </p>
        <button
          onClick={handleRecalcEarnings}
          disabled={recalcProcessing}
          className="w-full py-2.5 rounded-xl font-bold text-sm bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {recalcProcessing ? (
            <><span className="animate-spin h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full" />Recalculating…</>
          ) : (
            <><FaSync />Recalculate Earnings</>
          )}
        </button>
      </div>

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
              result.type === "success"
                ? "bg-green-500/10 text-green-400 border border-green-500/20"
                : "bg-dhaba-danger/10 text-red-400 border border-dhaba-danger/20"
            }`}
          >
            {result.type === "success" ? <FaCheckCircle /> : <FaExclamationTriangle />}
            {result.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BackupRestoreSection;
