import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaDownload,
  FaSync,
  FaTrashAlt,
  FaDatabase,
  FaCalendarAlt,
  FaCheckCircle,
  FaExclamationTriangle,
  FaFileExport,
  FaCloudDownloadAlt,
  FaShieldAlt,
  FaBomb,
  FaFolderOpen,
  FaUpload,
  FaSave,
} from "react-icons/fa";
import { MdStorage, MdDeleteSweep, MdRestore } from "react-icons/md";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import BackButton from "../components/shared/BackButton";
import type { RootState } from "../redux/store";

interface DataModule {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  color: string;
}

const dataModules: DataModule[] = [
  { id: "orders", label: "Orders", icon: <FaFileExport />, description: "All order records with items & billing", color: "text-blue-400" },
  { id: "staff", label: "Staff", icon: <FaDatabase />, description: "Staff profiles & payment history", color: "text-emerald-400" },
  { id: "consumables", label: "Consumables", icon: <MdStorage />, description: "Tea, gutka, cigarette tracking entries", color: "text-amber-400" },
  { id: "tables", label: "Tables", icon: <FaDatabase />, description: "Table configurations & status", color: "text-purple-400" },
  { id: "dishes", label: "Dishes / Menu", icon: <FaDatabase />, description: "Menu items, variants & categories", color: "text-rose-400" },
  { id: "ledger", label: "Customer Ledger", icon: <FaDatabase />, description: "Customer balances & transactions", color: "text-cyan-400" },
];

type ActionTab = "download" | "backup" | "sync" | "delete";

interface StorageStats {
  totalRecords: number;
  dbSize: string;
}

const DataManagement: React.FC = () => {
  const { role } = useSelector((state: RootState) => state.user);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ActionTab>("download");
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [format, setFormat] = useState<"json" | "csv" | "xlsx">("json");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [storageStats, setStorageStats] = useState<StorageStats>({ totalRecords: 0, dbSize: "—" });

  // Backup state
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [backupProcessing, setBackupProcessing] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreProcessing, setRestoreProcessing] = useState(false);
  const [backupResult, setBackupResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Full DB reset state
  const [resetStep, setResetStep] = useState<0 | 1 | 2>(0); // 0=idle, 1=warn, 2=confirm-phrase+password
  const [resetPhrase, setResetPhrase] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetProcessing, setResetProcessing] = useState(false);
  const [resetResult, setResetResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const isAdmin = role === "Admin";

  useEffect(() => {
    document.title = "Dhaba POS | Data Management";
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    axios
      .get<{ success: boolean; data: StorageStats }>("/api/data/stats")
      .then((res) => setStorageStats(res.data.data))
      .catch(() => {/* silently ignore — stats are cosmetic */});
  }, [isAdmin]);

  const toggleModule = (id: string) => {
    setSelectedModules((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedModules.length === dataModules.length) {
      setSelectedModules([]);
    } else {
      setSelectedModules(dataModules.map((m) => m.id));
    }
  };

  const isFileSystemAPIAvailable = "showDirectoryPicker" in window;

  const handleChooseFolder = async () => {
    try {
      const handle = await (window as unknown as { showDirectoryPicker: (opts?: object) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker({ mode: "readwrite" });
      setDirHandle(handle);
      setBackupResult(null);
    } catch {
      // User cancelled picker — do nothing
    }
  };

  const handleBackup = async () => {
    if (!dirHandle) {
      setBackupResult({ type: "error", message: "Please choose a folder first." });
      return;
    }
    const modules = selectedModules.length ? selectedModules : dataModules.map((m) => m.id);
    setBackupProcessing(true);
    setBackupResult(null);
    try {
      const params = new URLSearchParams({ modules: modules.join(","), startDate, endDate, format: "json" });
      const res = await axios.get<Blob>(`/api/data/export?${params.toString()}`, { responseType: "blob" });
      const date = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const filename = `dhaba_backup_${date}.json`;
      const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(res.data);
      await writable.close();
      setBackupResult({ type: "success", message: `Saved "${filename}" to "${dirHandle.name}"` });
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.message : null;
      setBackupResult({ type: "error", message: msg ?? "Backup failed." });
    } finally {
      setBackupProcessing(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreFile) return;
    setRestoreProcessing(true);
    setBackupResult(null);
    try {
      const text = await restoreFile.text();
      const data = JSON.parse(text) as unknown;
      await axios.post("/api/data/import", data);
      setBackupResult({ type: "success", message: "Data restored successfully from backup." });
      setRestoreFile(null);
      axios.get<{ success: boolean; data: StorageStats }>("/api/data/stats")
        .then((r) => setStorageStats(r.data.data))
        .catch(() => {});
    } catch {
      setBackupResult({ type: "error", message: "Restore failed. Ensure the file is a valid backup." });
    } finally {
      setRestoreProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!selectedModules.length) {
      setResult({ type: "error", message: "Please select at least one data module." });
      return;
    }
    const params = new URLSearchParams({
      modules: selectedModules.join(","),
      startDate,
      endDate,
      format,
    });
    const a = document.createElement("a");
    a.href = `/api/data/export?${params.toString()}`;
    a.click();
    setResult({ type: "success", message: `Export started — check your Downloads folder.` });
  };

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
      axios.get<{ success: boolean; data: StorageStats }>("/api/data/stats")
        .then((r) => setStorageStats(r.data.data))
        .catch(() => {});
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.message : "Reset failed.";
      setResetResult({ type: "error", message: msg ?? "Reset failed." });
    } finally {
      setResetProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedModules.length) {
      setResult({ type: "error", message: "Please select at least one data module." });
      return;
    }
    setProcessing(true);
    setResult(null);
    setConfirmDelete(false);
    try {
      const res = await axios.delete<{ success: boolean; message: string; data: Record<string, number> }>(
        "/api/data/delete",
        { data: { modules: selectedModules, startDate, endDate } }
      );
      const counts = res.data.data;
      const summary = Object.entries(counts)
        .map(([mod, n]) => `${mod}: ${n}`)
        .join(", ");
      setResult({ type: "success", message: `Deleted — ${summary}` });
      // Refresh stats after delete
      axios.get<{ success: boolean; data: StorageStats }>("/api/data/stats")
        .then((r) => setStorageStats(r.data.data))
        .catch(() => {});
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.message : "Delete failed.";
      setResult({ type: "error", message: msg ?? "Delete failed." });
    } finally {
      setProcessing(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="bg-dhaba-bg min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card rounded-3xl p-12 text-center max-w-md"
        >
          <FaShieldAlt className="text-dhaba-danger text-5xl mx-auto mb-4" />
          <h2 className="font-display text-2xl font-bold text-dhaba-text mb-2">Access Restricted</h2>
          <p className="text-dhaba-muted mb-6">Only administrators can manage application data.</p>
          <button
            onClick={() => navigate("/")}
            className="bg-gradient-warm text-dhaba-bg font-bold px-8 py-3 rounded-2xl"
          >
            Go Home
          </button>
        </motion.div>
      </div>
    );
  }

  const tabs: { id: ActionTab; label: string; icon: React.ReactNode }[] = [
    { id: "download", label: "Download", icon: <FaDownload /> },
    { id: "backup", label: "Backup", icon: <FaSave /> },
    { id: "sync", label: "Sync", icon: <FaSync /> },
    { id: "delete", label: "Delete", icon: <FaTrashAlt /> },
  ];

  return (
    <section className="bg-dhaba-bg min-h-[calc(100vh-4rem)] pb-8">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h1 className="font-display text-2xl font-bold text-dhaba-text">Data Management</h1>
            <p className="text-dhaba-muted text-sm">Download, sync & manage your application data</p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-3">
          {[
            { label: "Records", value: storageStats.totalRecords.toLocaleString() },
            { label: "DB Size", value: storageStats.dbSize },
          ].map((s) => (
            <div key={s.label} className="glass-card rounded-2xl px-4 py-2.5 text-center">
              <p className="text-dhaba-accent font-bold text-sm">{s.value}</p>
              <p className="text-dhaba-muted text-[10px] font-medium uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="container mx-auto px-6">
        {/* Tabs */}
        <div className="glass-card rounded-2xl p-1 flex gap-1 w-fit mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setResult(null); setBackupResult(null); setConfirmDelete(false); }}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                activeTab === tab.id
                  ? tab.id === "delete"
                    ? "bg-dhaba-danger/15 text-red-400 shadow-glow"
                    : "bg-dhaba-accent/15 text-dhaba-accent shadow-glow"
                  : "text-dhaba-muted hover:text-dhaba-text hover:bg-dhaba-surface-hover"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Left: Module Selection */}
          <div className="col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-dhaba-text font-semibold">Select Data Modules</h3>
              <button
                onClick={selectAll}
                className="text-dhaba-accent text-sm font-semibold hover:underline"
              >
                {selectedModules.length === dataModules.length ? "Deselect All" : "Select All"}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {dataModules.map((mod) => {
                const selected = selectedModules.includes(mod.id);
                return (
                  <motion.button
                    key={mod.id}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => toggleModule(mod.id)}
                    className={`glass-card rounded-2xl p-4 text-left transition-all duration-200 border-2 ${
                      selected
                        ? "border-dhaba-accent/50 bg-dhaba-accent/5"
                        : "border-transparent hover:bg-dhaba-surface-hover"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`text-xl ${mod.color}`}>{mod.icon}</span>
                      <span className="text-dhaba-text font-semibold text-sm">{mod.label}</span>
                      {selected && <FaCheckCircle className="text-dhaba-accent ml-auto text-sm" />}
                    </div>
                    <p className="text-dhaba-muted text-xs">{mod.description}</p>
                  </motion.button>
                );
              })}
            </div>

            {/* Date Range */}
            {(activeTab === "download" || activeTab === "delete") && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card rounded-2xl p-5"
              >
                <div className="flex items-center gap-2 mb-4">
                  <FaCalendarAlt className="text-dhaba-accent" />
                  <h3 className="text-dhaba-text font-semibold">Date Range</h3>
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-dhaba-muted text-xs font-medium uppercase tracking-wider block mb-2">From</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="glass-input rounded-xl px-4 py-2.5 text-dhaba-text text-sm font-medium w-full focus:outline-none"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-dhaba-muted text-xs font-medium uppercase tracking-wider block mb-2">To</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="glass-input rounded-xl px-4 py-2.5 text-dhaba-text text-sm font-medium w-full focus:outline-none"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Download format */}
            {activeTab === "download" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card rounded-2xl p-5"
              >
                <h3 className="text-dhaba-text font-semibold mb-3">Export Format</h3>
                <div className="flex gap-3">
                  {(["json", "csv", "xlsx"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFormat(f)}
                      className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        format === f
                          ? "bg-dhaba-accent/15 text-dhaba-accent border border-dhaba-accent/30"
                          : "glass-card text-dhaba-muted hover:text-dhaba-text"
                      }`}
                    >
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          {/* Right: Action Panel */}
          <div className="space-y-4">
            <div className={`glass-card rounded-3xl p-6 border ${
              activeTab === "delete" ? "border-dhaba-danger/30" : activeTab === "backup" ? "border-emerald-500/30" : "border-dhaba-border/30"
            }`}>
              <div className="text-center mb-6">
                <div className={`h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-3 ${
                  activeTab === "delete"
                    ? "bg-dhaba-danger/15"
                    : activeTab === "sync"
                    ? "bg-dhaba-info/15"
                    : activeTab === "backup"
                    ? "bg-emerald-500/15"
                    : "bg-dhaba-accent/15"
                }`}>
                  {activeTab === "download" && <FaCloudDownloadAlt className="text-dhaba-accent text-2xl" />}
                  {activeTab === "backup" && <FaSave className="text-emerald-400 text-2xl" />}
                  {activeTab === "sync" && <FaSync className="text-blue-400 text-2xl" />}
                  {activeTab === "delete" && <MdDeleteSweep className="text-red-400 text-3xl" />}
                </div>
                <h3 className="font-display text-lg font-bold text-dhaba-text">
                  {activeTab === "download" && "Download Data"}
                  {activeTab === "backup" && "Device Backup"}
                  {activeTab === "sync" && "Sync to Cloud"}
                  {activeTab === "delete" && "Delete Data"}
                </h3>
                <p className="text-dhaba-muted text-xs mt-1">
                  {activeTab === "download" && "Export selected data as a file"}
                  {activeTab === "backup" && "Save & restore backups on your device"}
                  {activeTab === "sync" && "Push local data to cloud backup"}
                  {activeTab === "delete" && "Permanently remove selected data"}
                </p>
              </div>

              {/* Summary (hidden on backup tab) */}
              {activeTab !== "backup" && (
                <div className="glass rounded-xl p-4 mb-5 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-dhaba-muted">Selected</span>
                    <span className="text-dhaba-text font-semibold">
                      {selectedModules.length} module{selectedModules.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {(activeTab === "download" || activeTab === "delete") && (
                    <div className="flex justify-between text-sm">
                      <span className="text-dhaba-muted">Date Range</span>
                      <span className="text-dhaba-text font-semibold text-xs">
                        {startDate} → {endDate}
                      </span>
                    </div>
                  )}
                  {activeTab === "download" && (
                    <div className="flex justify-between text-sm">
                      <span className="text-dhaba-muted">Format</span>
                      <span className="text-dhaba-text font-semibold">{format === "xlsx" ? "Excel (XLSX)" : format.toUpperCase()}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Backup: save to folder + restore from file */}
              {activeTab === "backup" && (
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
                        onChange={(e) => { setRestoreFile(e.target.files?.[0] ?? null); setBackupResult(null); }}
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

                  {/* Backup result */}
                  <AnimatePresence>
                    {backupResult && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                          backupResult.type === "success"
                            ? "bg-green-500/10 text-green-400 border border-green-500/20"
                            : "bg-dhaba-danger/10 text-red-400 border border-dhaba-danger/20"
                        }`}
                      >
                        {backupResult.type === "success" ? <FaCheckCircle /> : <FaExclamationTriangle />}
                        {backupResult.message}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Sync: not available */}
              {activeTab === "sync" && (
                <div className="p-4 rounded-xl bg-dhaba-info/10 border border-dhaba-info/20 text-blue-300 text-sm text-center leading-relaxed">
                  Cloud sync is not configured.
                  <br />
                  Use <span className="font-semibold">Download</span> to create a local backup.
                </div>
              )}

              {/* Delete confirmation */}
              {activeTab === "delete" && !confirmDelete && (
                <button
                  onClick={() => {
                    if (!selectedModules.length) {
                      setResult({ type: "error", message: "Please select at least one data module." });
                      return;
                    }
                    setConfirmDelete(true);
                  }}
                  className="w-full py-3 rounded-2xl bg-dhaba-danger/15 text-red-400 font-bold text-sm hover:bg-dhaba-danger/25 transition-all"
                >
                  <FaTrashAlt className="inline mr-2" />
                  Delete Selected Data
                </button>
              )}

              {activeTab === "delete" && confirmDelete && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-dhaba-danger/10 border border-dhaba-danger/30">
                    <FaExclamationTriangle className="text-red-400 flex-shrink-0" />
                    <p className="text-red-300 text-xs font-medium">
                      This action is irreversible. All selected data within the date range will be permanently deleted.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="flex-1 py-2.5 rounded-xl glass-card text-dhaba-muted font-semibold text-sm hover:bg-dhaba-surface-hover transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={processing}
                      className="flex-1 py-2.5 rounded-xl bg-dhaba-danger text-white font-bold text-sm hover:bg-red-600 transition-all disabled:opacity-50"
                    >
                      {processing ? "Deleting..." : "Confirm Delete"}
                    </button>
                  </div>
                </motion.div>
              )}

              {activeTab === "download" && (
                <button
                  onClick={handleDownload}
                  className="w-full py-3 rounded-2xl font-bold text-sm transition-all bg-gradient-warm text-dhaba-bg hover:shadow-glow"
                >
                  <FaDownload className="inline mr-2" />
                  Download Now
                </button>
              )}

              {/* Result */}
              <AnimatePresence>
                {result && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={`mt-4 p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
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

            {/* Quick Actions */}
            <div className="glass-card rounded-2xl p-5">
              <h4 className="text-dhaba-text font-semibold text-sm mb-3">Quick Actions</h4>
              <div className="space-y-2">
                {[
                  { label: "Full Backup (All Data)", action: () => { setSelectedModules(dataModules.map(m => m.id)); setActiveTab("download"); } },
                  { label: "Clear Old Orders (30d+)", action: () => { setSelectedModules(["orders"]); setActiveTab("delete"); setStartDate("2020-01-01"); setEndDate(new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0]); } },
                  { label: "Sync Everything", action: () => { setSelectedModules(dataModules.map(m => m.id)); setActiveTab("sync"); } },
                ].map((qa) => (
                  <button
                    key={qa.label}
                    onClick={qa.action}
                    className="w-full text-left px-4 py-2.5 rounded-xl text-dhaba-muted text-xs font-medium hover:bg-dhaba-surface-hover hover:text-dhaba-text transition-all"
                  >
                    {qa.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Danger Zone ─────────────────────────────────────────────── */}
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
            {/* Step 1: First warning */}
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

            {/* Step 2: Admin password + type RESET */}
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
                    onClick={() => { setResetStep(0); setResetPhrase(""); setResetPassword(""); }}
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
    </section>
  );
};

export default DataManagement;
