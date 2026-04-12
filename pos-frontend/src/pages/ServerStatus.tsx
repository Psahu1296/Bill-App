import React, { useState, useEffect, useCallback } from "react";
import {
  FaServer, FaRedo, FaCheckCircle, FaTimesCircle
} from "react-icons/fa";
import BackButton from "../components/shared/BackButton";

// ── Types ─────────────────────────────────────────────────────────────────────

type HealthStatus = "checking" | "online" | "offline";

interface StatusSnapshot {
  health: HealthStatus;
  healthMs: number | null;
  fetchedAt: Date | null;
  error: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function checkHealth(): Promise<{ ok: boolean; ms: number }> {
  const t = Date.now();
  try {
    const res = await fetch("/health", { cache: "no-store" });
    const json = await res.json().catch(() => null);
    return { ok: json?.app === "dhaba-pos", ms: Date.now() - t };
  } catch {
    return { ok: false, ms: Date.now() - t };
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: "ok" | "warn" | "error" | "checking" }) {
  const cls =
    status === "ok"       ? "bg-dhaba-success" :
    status === "warn"     ? "bg-dhaba-warning" :
    status === "error"    ? "bg-dhaba-danger"  :
                            "bg-dhaba-muted animate-pulse";
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${cls}`} />;
}

function InfoRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-dhaba-border/10 last:border-0">
      <span className="text-xs text-dhaba-muted font-medium uppercase tracking-wide">{label}</span>
      <span className={`text-sm font-semibold text-dhaba-text ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const ServerStatus: React.FC = () => {
  useEffect(() => { document.title = "Dhaba POS | Server Status"; }, []);

  const [snap, setSnap] = useState<StatusSnapshot>({
    health: "checking", healthMs: null, fetchedAt: null, error: null,
  });
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const healthResult = await checkHealth();
      setSnap({
        health: healthResult.ok ? "online" : "offline",
        healthMs: healthResult.ms,
        fetchedAt: new Date(),
        error: null,
      });
    } catch (err: any) {
      setSnap(prev => ({ ...prev, health: "offline", error: err?.message ?? "Unknown error", fetchedAt: new Date() }));
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Initial load + auto-refresh every 10 s
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 10_000);
    return () => clearInterval(id);
  }, [refresh]);

  // ── Derived states ──────────────────────────────────────────────────────────
  const backendOk  = snap.health === "online";
  const backendDotStatus: "ok" | "warn" | "error" | "checking" =
    snap.health === "checking" ? "checking" :
    backendOk                  ? "ok"       : "error";

  return (
    <div className="bg-dhaba-bg min-h-[calc(100vh-4rem)] pb-8">
      <div className="container mx-auto px-6 py-6 max-w-4xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <BackButton />
            <div>
              <h1 className="font-display text-2xl font-bold text-dhaba-text">Server Status</h1>
              <p className="text-sm text-dhaba-muted">
                {snap.fetchedAt
                  ? `Last refreshed at ${snap.fetchedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
                  : "Checking…"}
              </p>
            </div>
          </div>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="flex items-center gap-2 glass-input px-4 py-2 rounded-xl text-sm font-semibold text-dhaba-muted hover:text-dhaba-text transition-colors disabled:opacity-50"
          >
            <FaRedo className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* Summary bar */}
        <div className="glass-card rounded-2xl p-4 mb-6 flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <StatusDot status={backendDotStatus} />
            <span className="text-xs text-dhaba-muted font-medium uppercase tracking-wide">Backend</span>
            <span className="text-sm font-bold text-dhaba-text">{snap.health === "checking" ? "Checking…" : backendOk ? "Online" : "Offline"}</span>
          </div>
          <div className="ml-auto text-xs text-dhaba-muted">Auto-refreshes every 10 s</div>
        </div>

        <div className="grid grid-cols-1 gap-5">
          {/* ── Backend Card ─────────────────────────────────────────────── */}
          <div className="glass-card rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-3 mb-1">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${backendOk ? "bg-dhaba-success/10" : "bg-dhaba-danger/10"}`}>
                <FaServer className={`text-lg ${backendOk ? "text-dhaba-success" : "text-dhaba-danger"}`} />
              </div>
              <div>
                <p className="font-display text-sm font-bold text-dhaba-text">Backend Server</p>
                <p className="text-xs text-dhaba-muted">Express / Railway / MongoDB</p>
              </div>
              <StatusDot status={backendDotStatus} />
            </div>

            <InfoRow label="Status" value={
              snap.health === "checking"
                ? <span className="text-dhaba-muted">Checking…</span>
                : backendOk
                  ? <span className="flex items-center gap-1 text-dhaba-success"><FaCheckCircle /> Online</span>
                  : <span className="flex items-center gap-1 text-dhaba-danger"><FaTimesCircle /> Offline</span>
            } />
            <InfoRow label="Health Endpoint" value="/health" mono />
            {snap.healthMs !== null && (
              <InfoRow label="Response Time" value={`${snap.healthMs} ms`} mono />
            )}
            {snap.error && (
              <div className="mt-2 text-xs text-dhaba-danger bg-dhaba-danger/10 rounded-lg px-3 py-2 font-mono break-all">
                {snap.error}
              </div>
            )}
            {!backendOk && snap.health !== "checking" && (
              <p className="text-xs text-dhaba-muted bg-dhaba-border/10 rounded-lg px-3 py-2 leading-relaxed">
                The backend Railway server is not responding. Please check your Railway deployment dashboard or internet connection.
              </p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ServerStatus;
