import React, { useState, useEffect, useCallback } from "react";
import {
  FaServer, FaWifi, FaNetworkWired, FaRedo, FaCopy, FaCheck,
  FaExclamationTriangle, FaCheckCircle, FaTimesCircle, FaCog,
} from "react-icons/fa";
import { MdRouter } from "react-icons/md";
import BackButton from "../components/shared/BackButton";

const bridge = typeof window !== "undefined" ? (window as any).appBridge : null;
const isElectron = !!bridge?.getServerInfo;

// ── Types ─────────────────────────────────────────────────────────────────────

interface ServerInfo {
  resolvedPort: number;
  preferredPort: number;
  tunnelUrl: string | null;
  tunnelRunning: boolean;
}

type HealthStatus = "checking" | "online" | "offline";

interface StatusSnapshot {
  info: ServerInfo | null;
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
    info: null, health: "checking", healthMs: null, fetchedAt: null, error: null,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tunnelRestarting, setTunnelRestarting] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [infoResult, healthResult] = await Promise.all([
        isElectron ? bridge.getServerInfo() : Promise.resolve(null),
        checkHealth(),
      ]);
      setSnap({
        info: infoResult,
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

  // Listen for tunnel URL updates pushed from main process
  useEffect(() => {
    if (!isElectron) return;
    const unsub = bridge.onTunnelUrl((url: string | null) => {
      setSnap(prev => ({
        ...prev,
        info: prev.info ? { ...prev.info, tunnelUrl: url, tunnelRunning: !!url } : prev.info,
      }));
      setTunnelRestarting(false);
    });
    return unsub;
  }, []);

  const copyTunnelUrl = () => {
    if (!snap.info?.tunnelUrl) return;
    navigator.clipboard.writeText(snap.info.tunnelUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTunnelRestart = () => {
    if (!isElectron) return;
    setTunnelRestarting(true);
    setSnap(prev => ({ ...prev, info: prev.info ? { ...prev.info, tunnelRunning: false, tunnelUrl: null } : prev.info }));
    bridge.restartTunnel();
  };

  // ── Derived states ──────────────────────────────────────────────────────────
  const portOk     = !snap.info || snap.info.resolvedPort === snap.info.preferredPort;
  const backendOk  = snap.health === "online";
  const tunnelOk   = snap.info?.tunnelRunning ?? false;

  const backendDotStatus: "ok" | "warn" | "error" | "checking" =
    snap.health === "checking" ? "checking" :
    backendOk                  ? "ok"       : "error";

  const tunnelDotStatus: "ok" | "warn" | "error" | "checking" =
    tunnelRestarting                         ? "checking" :
    tunnelOk                                 ? "ok"       : "warn";

  const portDotStatus: "ok" | "warn" | "error" | "checking" =
    !snap.info ? "checking" :
    portOk     ? "ok"       : "warn";

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

        {/* Non-Electron notice */}
        {!isElectron && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-dhaba-warning/10 border border-dhaba-warning/30 text-dhaba-warning text-sm font-medium flex items-center gap-2">
            <FaExclamationTriangle />
            Electron info (port, tunnel) is only available in the desktop app. Backend health check still works.
          </div>
        )}

        {/* Summary bar */}
        <div className="glass-card rounded-2xl p-4 mb-6 flex items-center gap-6 flex-wrap">
          {[
            { label: "Backend",  dot: backendDotStatus,  text: snap.health === "checking" ? "Checking…" : backendOk ? "Online" : "Offline" },
            { label: "Tunnel",   dot: tunnelDotStatus,   text: tunnelRestarting ? "Restarting…" : tunnelOk ? "Connected" : "Disconnected" },
            { label: "Port",     dot: portDotStatus,     text: !snap.info ? "…" : portOk ? "OK" : "Conflict" },
          ].map(({ label, dot, text }) => (
            <div key={label} className="flex items-center gap-2">
              <StatusDot status={dot} />
              <span className="text-xs text-dhaba-muted font-medium uppercase tracking-wide">{label}</span>
              <span className="text-sm font-bold text-dhaba-text">{text}</span>
            </div>
          ))}
          <div className="ml-auto text-xs text-dhaba-muted">Auto-refreshes every 10 s</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

          {/* ── Backend Card ─────────────────────────────────────────────── */}
          <div className="glass-card rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-3 mb-1">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${backendOk ? "bg-dhaba-success/10" : "bg-dhaba-danger/10"}`}>
                <FaServer className={`text-lg ${backendOk ? "text-dhaba-success" : "text-dhaba-danger"}`} />
              </div>
              <div>
                <p className="font-display text-sm font-bold text-dhaba-text">Backend Server</p>
                <p className="text-xs text-dhaba-muted">Express + SQLite</p>
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
                The backend process is not responding. Make sure the Dhaba POS app is open and check the splash screen for startup errors.
              </p>
            )}
          </div>

          {/* ── Port Card ────────────────────────────────────────────────── */}
          <div className="glass-card rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-3 mb-1">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${portOk ? "bg-dhaba-accent/10" : "bg-dhaba-warning/10"}`}>
                <FaNetworkWired className={`text-lg ${portOk ? "text-dhaba-accent" : "text-dhaba-warning"}`} />
              </div>
              <div>
                <p className="font-display text-sm font-bold text-dhaba-text">Port</p>
                <p className="text-xs text-dhaba-muted">Network binding</p>
              </div>
              <StatusDot status={portDotStatus} />
            </div>

            <InfoRow
              label="Preferred (from .env)"
              value={snap.info ? String(snap.info.preferredPort) : "…"}
              mono
            />
            <InfoRow
              label="Actual (running on)"
              value={
                snap.info
                  ? <span className={portOk ? "text-dhaba-success" : "text-dhaba-warning"}>
                      {snap.info.resolvedPort}
                    </span>
                  : "…"
              }
              mono
            />

            {snap.info && !portOk && (
              <div className="mt-1 text-xs bg-dhaba-warning/10 text-dhaba-warning rounded-lg px-3 py-2 leading-relaxed flex items-start gap-2">
                <FaExclamationTriangle className="flex-shrink-0 mt-0.5" />
                <span>
                  Port {snap.info.preferredPort} was occupied so the server started on {snap.info.resolvedPort}.
                  The Cloudflare tunnel is configured to forward to {snap.info.preferredPort} — restart the app to reclaim the correct port.
                </span>
              </div>
            )}

            {snap.info && portOk && (
              <p className="text-xs text-dhaba-success bg-dhaba-success/10 rounded-lg px-3 py-2">
                Running on the expected port — tunnel routing is correct.
              </p>
            )}
          </div>

          {/* ── Tunnel Card ──────────────────────────────────────────────── */}
          <div className="glass-card rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-3 mb-1">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${tunnelOk ? "bg-dhaba-success/10" : "bg-dhaba-warning/10"}`}>
                <MdRouter className={`text-lg ${tunnelOk ? "text-dhaba-success" : "text-dhaba-warning"}`} />
              </div>
              <div>
                <p className="font-display text-sm font-bold text-dhaba-text">Cloudflare Tunnel</p>
                <p className="text-xs text-dhaba-muted">Remote access</p>
              </div>
              <StatusDot status={tunnelDotStatus} />
            </div>

            <InfoRow label="Status" value={
              tunnelRestarting
                ? <span className="flex items-center gap-1 text-dhaba-muted"><FaCog className="animate-spin text-xs" /> Restarting…</span>
                : tunnelOk
                  ? <span className="flex items-center gap-1 text-dhaba-success"><FaCheckCircle /> Connected</span>
                  : <span className="flex items-center gap-1 text-dhaba-warning"><FaExclamationTriangle /> Disconnected</span>
            } />

            {snap.info?.tunnelUrl ? (
              <div>
                <p className="text-[10px] text-dhaba-muted font-bold uppercase tracking-wide mb-1">Public URL</p>
                <div className="flex items-center gap-2 glass-input rounded-xl px-3 py-2">
                  <span className="text-xs font-mono text-dhaba-text truncate flex-1">{snap.info.tunnelUrl}</span>
                  <button
                    onClick={copyTunnelUrl}
                    className="flex-shrink-0 text-dhaba-muted hover:text-dhaba-accent transition-colors"
                    title="Copy URL"
                  >
                    {copied ? <FaCheck className="text-dhaba-success" /> : <FaCopy />}
                  </button>
                </div>
              </div>
            ) : (
              <InfoRow label="Public URL" value="—" />
            )}

            {isElectron && (
              <button
                onClick={handleTunnelRestart}
                disabled={tunnelRestarting}
                className="w-full mt-2 flex items-center justify-center gap-2 bg-dhaba-accent/10 hover:bg-dhaba-accent/20 text-dhaba-accent text-xs font-bold py-2.5 rounded-xl transition-colors disabled:opacity-50"
              >
                <FaRedo className={tunnelRestarting ? "animate-spin" : ""} />
                {tunnelRestarting ? "Restarting…" : "Restart Tunnel"}
              </button>
            )}

            {!tunnelOk && !tunnelRestarting && (
              <p className="text-xs text-dhaba-muted bg-dhaba-border/10 rounded-lg px-3 py-2 leading-relaxed">
                The customer app and remote access won't work. Click "Restart Tunnel" or restart the Dhaba POS app.
              </p>
            )}
          </div>

        </div>

        {/* Debug info — raw values for troubleshooting */}
        {snap.info && (
          <details className="mt-6">
            <summary className="text-xs text-dhaba-muted cursor-pointer select-none hover:text-dhaba-text transition-colors">
              Raw debug info
            </summary>
            <pre className="mt-2 text-xs font-mono bg-dhaba-border/10 rounded-xl p-4 text-dhaba-muted overflow-x-auto">
              {JSON.stringify({ ...snap.info, health: snap.health, healthMs: snap.healthMs }, null, 2)}
            </pre>
          </details>
        )}

      </div>
    </div>
  );
};

export default ServerStatus;
