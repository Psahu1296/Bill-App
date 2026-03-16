import React, { useState, useEffect, useCallback } from "react";
import { FaDownload, FaCheckCircle, FaRedo, FaInfoCircle, FaDesktop, FaCog } from "react-icons/fa";
import { MdSystemUpdateAlt, MdNewReleases } from "react-icons/md";
import { IoRocket } from "react-icons/io5";
import BackButton from "../components/shared/BackButton";

// ── Types ──────────────────────────────────────────────────────────────────────
type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "downloaded"   // download complete, ready to install
  | "up-to-date"
  | "error";

interface ReleaseNote {
  version: string;
  date: string;
  changes: string[];
  tag: "latest" | "stable" | "beta";
}

// ── Electron bridge detection ──────────────────────────────────────────────────
// preload.ts exposes window.appBridge (not window.electron)
const bridge = typeof window !== "undefined" ? (window as any).appBridge : null;
const isElectron = !!bridge?.checkForUpdates;

// ── App version ────────────────────────────────────────────────────────────────
// In Electron the version comes from package.json (injected at build time).
// Fall back to the last known version for web browser preview.
const CURRENT_VERSION: string =
  (typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : null) ?? "1.0.0";

// ── Component ──────────────────────────────────────────────────────────────────
const AppUpdate: React.FC = () => {
  useEffect(() => { document.title = "Dhaba POS | App Update"; }, []);

  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [availableVersion, setAvailableVersion] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const [downloadSpeed, setDownloadSpeed] = useState("0");
  const [downloadedMB, setDownloadedMB] = useState("0");
  const [totalMB, setTotalMB] = useState("0");
  const [lastChecked, setLastChecked] = useState<string>("Never");
  const [releaseNotes, setReleaseNotes] = useState<ReleaseNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);

  // ── Fetch Release Notes from GitHub ─────────────────────────────────────────
  useEffect(() => {
    const fetchReleases = async () => {
      try {
        const response = await fetch("https://api.github.com/repos/Psahu1296/Bill-App/releases");
        if (!response.ok) throw new Error("Failed to fetch releases");
        
        const data = await response.json();
        
        const mappedNotes: ReleaseNote[] = data.map((release: any, index: number) => {
          // Parse markdown list from body into an array of strings
          const changes = release.body
            ? release.body
                .split('\n')
                .filter((line: string) => line.trim().startsWith('-') || line.trim().startsWith('*'))
                .map((line: string) => line.replace(/^[-*]\s*/, '').trim())
            : ["No release notes provided."];

          // If body doesn't contain a list, just use the whole body as a single note
          if (changes.length === 0 && release.body) {
             changes.push(release.body.trim());
          }

          return {
            version: release.tag_name.replace(/^v/, ""), // strip leading 'v'
            date: new Date(release.published_at).toISOString().split('T')[0],
            changes: changes.length > 0 ? changes : ["Minor updates and bug fixes."],
            tag: index === 0 ? "latest" : (release.prerelease ? "beta" : "stable")
          };
        });

        setReleaseNotes(mappedNotes);
      } catch (err) {
        console.error("Error fetching release notes:", err);
        // Fallback or empty state if GitHub API fails/rate-limits
        setReleaseNotes([]);
      } finally {
        setLoadingNotes(false);
      }
    };

    fetchReleases();
  }, []);

  // ── Subscribe to real updater events from main process ──────────────────────
  useEffect(() => {
    if (!isElectron) return;

    const unsubscribe = bridge.onUpdateStatus(
      (s: {
        event: string;
        version?: string;
        percent?: number;
        transferred?: number;
        total?: number;
        bytesPerSecond?: number;
        message?: string;
      }) => {
        switch (s.event) {
          case "checking":
            setStatus("checking");
            setLastChecked(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
            break;

          case "available":
            setStatus("available");
            setAvailableVersion(s.version ?? "");
            break;

          case "not-available":
            setStatus("up-to-date");
            break;

          case "progress": {
            setStatus("downloading");
            setProgress(s.percent ?? 0);
            const totalBytes = s.total ?? 0;
            const xferBytes = s.transferred ?? 0;
            const bps = s.bytesPerSecond ?? 0;
            setTotalMB((totalBytes / 1_048_576).toFixed(1));
            setDownloadedMB((xferBytes / 1_048_576).toFixed(1));
            setDownloadSpeed((bps / 1_048_576).toFixed(1));
            break;
          }

          case "downloaded":
            setStatus("downloaded");
            setAvailableVersion(s.version ?? availableVersion);
            setProgress(100);
            break;

          case "error":
            setStatus("error");
            setErrorMsg(s.message ?? "Unknown error");
            break;
        }
      }
    );

    return unsubscribe;
  }, [availableVersion]);

  // ── Controls ─────────────────────────────────────────────────────────────────
  const checkForUpdates = useCallback(() => {
    setStatus("checking");
    setErrorMsg("");
    setProgress(0);

    if (isElectron) {
      bridge.checkForUpdates();
    } else {
      // Web-browser simulation (dev / non-Electron preview only)
      setTimeout(() => setStatus("up-to-date"), 2000);
    }
  }, []);

  const startDownload = useCallback(() => {
    if (isElectron) {
      setStatus("downloading");
      bridge.downloadUpdate();
    }
  }, []);

  const installUpdate = useCallback(() => {
    if (isElectron) {
      bridge.installUpdate();
    } else {
      window.location.reload();
    }
  }, []);

  // ── Status render ─────────────────────────────────────────────────────────────
  const renderStatusContent = () => {
    switch (status) {
      case "idle":
        return (
          <div className="text-center space-y-4">
            <div className="h-20 w-20 mx-auto rounded-2xl bg-dhaba-accent/10 flex items-center justify-center">
              <MdSystemUpdateAlt className="text-4xl text-dhaba-accent" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-dhaba-text">Check for Updates</h2>
              <p className="text-sm text-dhaba-muted mt-1">See if a newer version is available</p>
            </div>
            <button
              onClick={checkForUpdates}
              className="bg-gradient-warm text-dhaba-bg px-8 py-3 rounded-xl font-bold text-sm hover:shadow-glow transition-all"
            >
              Check Now
            </button>
          </div>
        );

      case "checking":
        return (
          <div className="text-center space-y-5">
            <div className="h-20 w-20 mx-auto rounded-2xl bg-dhaba-accent/10 flex items-center justify-center">
              <FaCog className="text-3xl text-dhaba-accent animate-spin" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-dhaba-text">Checking for Updates…</h2>
              <p className="text-sm text-dhaba-muted mt-1">Connecting to update server</p>
            </div>
            <div className="w-64 mx-auto">
              <div className="h-1.5 rounded-full bg-dhaba-border/20 overflow-hidden">
                <div className="h-full rounded-full bg-dhaba-accent animate-pulse w-2/3" />
              </div>
            </div>
          </div>
        );

      case "available":
        return (
          <div className="text-center space-y-5">
            <div className="h-20 w-20 mx-auto rounded-2xl bg-dhaba-success/10 flex items-center justify-center">
              <MdNewReleases className="text-4xl text-dhaba-success" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-dhaba-text">Update Available!</h2>
              <p className="text-sm text-dhaba-muted mt-1">
                Version <span className="text-dhaba-accent font-bold">{availableVersion}</span> is ready to download
              </p>
              <p className="text-xs text-dhaba-muted mt-0.5">Current: v{CURRENT_VERSION}</p>
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setStatus("idle")}
                className="glass-input px-6 py-2.5 rounded-xl text-dhaba-muted font-semibold text-sm hover:text-dhaba-text transition-colors"
              >
                Later
              </button>
              <button
                onClick={startDownload}
                disabled={!isElectron}
                className="bg-gradient-warm text-dhaba-bg px-8 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:shadow-glow transition-all disabled:opacity-60"
              >
                <FaDownload /> Download &amp; Install
              </button>
            </div>
          </div>
        );

      case "downloading":
        return (
          <div className="text-center space-y-5">
            <div className="h-20 w-20 mx-auto rounded-2xl bg-dhaba-accent/10 flex items-center justify-center relative">
              <FaDownload className="text-3xl text-dhaba-accent" />
              {/* Circular progress */}
              <svg className="absolute inset-0 h-20 w-20 -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="36" fill="none" stroke="hsl(var(--dhaba-border))" strokeWidth="3" opacity="0.2" />
                <circle
                  cx="40" cy="40" r="36" fill="none"
                  stroke="hsl(var(--dhaba-accent))"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 36}`}
                  strokeDashoffset={`${2 * Math.PI * 36 * (1 - progress / 100)}`}
                  className="transition-all duration-300"
                />
              </svg>
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-dhaba-text">Downloading Update…</h2>
              <p className="text-sm text-dhaba-muted mt-1">v{availableVersion} · {downloadSpeed} MB/s</p>
            </div>
            <div className="w-80 mx-auto space-y-2">
              <div className="h-2.5 rounded-full bg-dhaba-border/20 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-warm transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-dhaba-muted">
                <span>{downloadedMB} / {totalMB} MB</span>
                <span className="font-bold text-dhaba-accent">{progress}%</span>
              </div>
            </div>
          </div>
        );

      case "downloaded":
        return (
          <div className="text-center space-y-5">
            <div className="h-20 w-20 mx-auto rounded-2xl bg-dhaba-success/10 flex items-center justify-center">
              <FaCheckCircle className="text-4xl text-dhaba-success" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-dhaba-text">Ready to Install!</h2>
              <p className="text-sm text-dhaba-muted mt-1">
                v{availableVersion} has been downloaded. Restart to apply.
              </p>
            </div>
            <button
              onClick={installUpdate}
              className="bg-gradient-warm text-dhaba-bg px-8 py-3 rounded-xl font-bold text-sm flex items-center gap-2 mx-auto hover:shadow-glow transition-all"
            >
              <FaRedo /> Restart &amp; Install
            </button>
          </div>
        );

      case "up-to-date":
        return (
          <div className="text-center space-y-5">
            <div className="h-20 w-20 mx-auto rounded-2xl bg-dhaba-success/10 flex items-center justify-center">
              <FaCheckCircle className="text-4xl text-dhaba-success" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-dhaba-text">You're Up to Date!</h2>
              <p className="text-sm text-dhaba-muted mt-1">v{CURRENT_VERSION} is the latest version</p>
            </div>
            <button
              onClick={checkForUpdates}
              className="glass-input px-6 py-2.5 rounded-xl text-dhaba-muted font-semibold text-sm hover:text-dhaba-text transition-colors"
            >
              Check Again
            </button>
          </div>
        );

      case "error":
        return (
          <div className="text-center space-y-5">
            <div className="h-20 w-20 mx-auto rounded-2xl bg-dhaba-danger/10 flex items-center justify-center">
              <FaInfoCircle className="text-4xl text-dhaba-danger" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-dhaba-text">Update Failed</h2>
              <p className="text-sm text-dhaba-muted mt-1">
                {errorMsg || "Could not connect to update server"}
              </p>
            </div>
            <button
              onClick={checkForUpdates}
              className="bg-gradient-warm text-dhaba-bg px-8 py-3 rounded-xl font-bold text-sm hover:shadow-glow transition-all"
            >
              Retry
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-dhaba-bg min-h-[calc(100vh-4rem)] pb-8">
      <div className="container mx-auto px-6 py-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <BackButton />
          <div>
            <h1 className="font-display text-2xl font-bold text-dhaba-text">App Update</h1>
            <p className="text-sm text-dhaba-muted">Manage application updates &amp; versions</p>
          </div>
        </div>

        {/* Non-Electron notice */}
        {!isElectron && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-dhaba-warning/10 border border-dhaba-warning/30 text-dhaba-warning text-sm font-medium flex items-center gap-2">
            <FaInfoCircle />
            Running in web browser — update controls are only available in the desktop app.
          </div>
        )}

        <div className="grid grid-cols-3 gap-6">
          {/* Left: Update Panel */}
          <div className="col-span-2 space-y-6">
            {/* Status Card */}
            <div className="glass-card rounded-2xl p-8">
              {renderStatusContent()}
            </div>

            {/* System Info Card */}
            <div className="glass-card rounded-2xl p-5">
              <h3 className="font-display text-base font-bold text-dhaba-text mb-4 flex items-center gap-2">
                <FaDesktop className="text-dhaba-accent" /> System Info
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Current Version", value: `v${CURRENT_VERSION}` },
                  { label: "Platform", value: isElectron ? `Desktop (${bridge?.platform ?? "unknown"})` : "Web Browser" },
                  { label: "Build", value: "Production" },
                  { label: "Last Checked", value: lastChecked },
                ].map((item) => (
                  <div key={item.label} className="glass-input rounded-xl px-4 py-3">
                    <p className="text-[10px] text-dhaba-muted font-bold tracking-wider uppercase">{item.label}</p>
                    <p className="text-sm font-semibold text-dhaba-text mt-0.5">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Release Notes */}
          <div className="space-y-4">
            <h3 className="font-display text-base font-bold text-dhaba-text flex items-center gap-2">
              <IoRocket className="text-dhaba-accent" /> Release Notes
            </h3>
            <div className="space-y-3 max-h-[calc(100vh-14rem)] overflow-y-auto pr-1">
              {loadingNotes ? (
                <div className="flex flex-col items-center justify-center p-8 space-y-3 opacity-60">
                  <FaCog className="text-2xl text-dhaba-accent animate-spin" />
                  <p className="text-xs text-dhaba-muted uppercase tracking-wider font-bold">Fetching Changelogs...</p>
                </div>
              ) : releaseNotes.length === 0 ? (
                 <div className="glass-input rounded-xl p-6 text-center text-sm text-dhaba-muted">
                    No release notes found.
                 </div>
              ) : (
                releaseNotes.map((release) => (
                  <div
                    key={release.version}
                    className={`glass-card rounded-xl p-4 space-y-2 ${
                      release.version === CURRENT_VERSION ? "ring-1 ring-dhaba-accent/30" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display text-sm font-bold text-dhaba-text">v{release.version}</span>
                      <span
                        className={`text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md ${
                          release.tag === "latest"
                            ? "bg-dhaba-success/15 text-dhaba-success"
                            : release.tag === "beta"
                            ? "bg-dhaba-warning/15 text-dhaba-warning"
                            : "bg-dhaba-muted/15 text-dhaba-muted"
                        }`}
                      >
                        {release.tag}
                      </span>
                    </div>
                    <p className="text-[10px] text-dhaba-muted">{release.date}</p>
                    <ul className="space-y-1">
                      {release.changes.map((change, i) => (
                        <li key={i} className="text-xs text-dhaba-muted flex items-start gap-1.5">
                          <span className="text-dhaba-accent mt-0.5 flex-shrink-0">•</span>
                          {/* Render newlines correctly if markdown didn't map to list items perfectly */}
                          <span className="whitespace-pre-wrap">{change}</span>
                        </li>
                      ))}
                    </ul>
                    {release.version === CURRENT_VERSION && (
                      <p className="text-[10px] text-dhaba-accent font-bold tracking-wider mt-2">INSTALLED</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppUpdate;
