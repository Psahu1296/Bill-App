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
} from "react-icons/fa";
import { MdStorage, MdDeleteSweep } from "react-icons/md";
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

type ActionTab = "download" | "sync" | "delete";

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
              onClick={() => { setActiveTab(tab.id); setResult(null); setConfirmDelete(false); }}
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
              activeTab === "delete" ? "border-dhaba-danger/30" : "border-dhaba-border/30"
            }`}>
              <div className="text-center mb-6">
                <div className={`h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-3 ${
                  activeTab === "delete"
                    ? "bg-dhaba-danger/15"
                    : activeTab === "sync"
                    ? "bg-dhaba-info/15"
                    : "bg-dhaba-accent/15"
                }`}>
                  {activeTab === "download" && <FaCloudDownloadAlt className="text-dhaba-accent text-2xl" />}
                  {activeTab === "sync" && <FaSync className="text-blue-400 text-2xl" />}
                  {activeTab === "delete" && <MdDeleteSweep className="text-red-400 text-3xl" />}
                </div>
                <h3 className="font-display text-lg font-bold text-dhaba-text">
                  {activeTab === "download" && "Download Data"}
                  {activeTab === "sync" && "Sync to Cloud"}
                  {activeTab === "delete" && "Delete Data"}
                </h3>
                <p className="text-dhaba-muted text-xs mt-1">
                  {activeTab === "download" && "Export selected data as a file"}
                  {activeTab === "sync" && "Push local data to cloud backup"}
                  {activeTab === "delete" && "Permanently remove selected data"}
                </p>
              </div>

              {/* Summary */}
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
    </section>
  );
};

export default DataManagement;
