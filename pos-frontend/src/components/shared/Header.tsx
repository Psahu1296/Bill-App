import React, { useState, useEffect } from "react";
import { FaCoffee, FaUsers, FaDatabase, FaSyncAlt, FaServer } from "react-icons/fa";
import { MdSystemUpdateAlt, MdDashboard, MdWifi, MdWifiOff } from "react-icons/md";
import { MdContentCopy, MdCheck, MdSignalWifiStatusbarConnectedNoInternet4 } from "react-icons/md";
import logo from "../../assets/images/logo.png";
import { useSelector } from "react-redux";
import { IoLogOut } from "react-icons/io5";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { logout, getOnlineOrdersStatus, setOnlineOrdersStatus } from "../../https";
import { removeUser } from "../../redux/slices/userSlice";
import { useNavigate } from "react-router-dom";
import { useAppDispatch } from "../../redux/hooks";
import type { RootState } from "../../redux/store";

const Header: React.FC = () => {
  const userData = useSelector((state: RootState) => state.user);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [tunnelUrl, setTunnelUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const bridge = (window as any).appBridge;
    if (!bridge) return;
    // Get current URL (may already be ready)
    bridge.getTunnelUrl().then((url: string | null) => setTunnelUrl(url));
    // Listen for URL once tunnel starts
    const unsub = bridge.onTunnelUrl((url: string | null) => setTunnelUrl(url));
    return unsub;
  }, []);

  const handleCopyTunnel = () => {
    if (!tunnelUrl) return;
    const customerBase = import.meta.env.VITE_CUSTOMER_APP_URL as string | undefined;
    const textToCopy = customerBase
      ? `${customerBase}/?api=${tunnelUrl}`
      : tunnelUrl;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => window.location.reload(), 400);
  };

  // Fetch current online-orders status
  const { data: settingsData } = useQuery({
    queryKey: ["settings", "online-orders"],
    queryFn: () => getOnlineOrdersStatus().then(r => r.data.data),
    staleTime: 30 * 1000,
  });
  const isOnline: boolean = settingsData?.isOnline ?? true;

  // Toggle mutation
  const toggleMutation = useMutation({
    mutationFn: (next: boolean) => setOnlineOrdersStatus(next).then(r => r.data.data),
    onSuccess: (data) => {
      queryClient.setQueryData(["settings", "online-orders"], data);
      setShowConfirm(false);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => logout(),
    onSuccess: () => {
      dispatch(removeUser());
      navigate("/auth");
    },
    onError: (error: unknown) => {
      console.log(error);
    },
  });

  return (
    <>
      <header className="glass sticky top-0 z-40 flex justify-between items-center py-3 px-8 border-b border-dhaba-border/30">
        <div
          onClick={() => navigate("/")}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="relative">
            <img src={logo} className="h-10 w-10 rounded-xl" alt="dhaba logo" />
            <div className="absolute -inset-1 bg-dhaba-accent/20 rounded-xl blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-dhaba-text tracking-wide">
              Dhaba<span className="text-dhaba-accent">POS</span>
            </h1>
            <p className="text-[10px] text-dhaba-muted font-medium tracking-widest uppercase">
              Point of Sale
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/app-update")}
            className="glass-card rounded-xl p-2.5 hover:bg-dhaba-surface-hover transition-all duration-200 group relative"
            title="App Update"
          >
            <MdSystemUpdateAlt className="text-dhaba-muted text-xl group-hover:text-dhaba-accent transition-colors" />
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-dhaba-success border-2 border-dhaba-surface" />
          </button>

          <button
            onClick={() => navigate("/consumables")}
            className="glass-card rounded-xl p-2.5 hover:bg-dhaba-surface-hover transition-all duration-200 group"
            title="Tea / Gutka / Cigarette Tracker"
          >
            <FaCoffee className="text-dhaba-muted text-xl group-hover:text-dhaba-accent transition-colors" />
          </button>

          {userData.role === "Admin" && (
            <button
              onClick={() => navigate("/dashboard")}
              className="glass-card rounded-xl p-2.5 hover:bg-dhaba-surface-hover transition-all duration-200 group"
              title="Dashboard"
            >
              <MdDashboard className="text-dhaba-muted text-xl group-hover:text-dhaba-accent transition-colors" />
            </button>
          )}

          {userData.role === "Admin" && (
            <button
              onClick={() => navigate("/data-management")}
              className="glass-card rounded-xl p-2.5 hover:bg-dhaba-surface-hover transition-all duration-200 group"
              title="Data Management"
            >
              <FaDatabase className="text-dhaba-muted text-xl group-hover:text-dhaba-accent transition-colors" />
            </button>
          )}

          {userData.role === "Admin" && (
            <button
              onClick={() => navigate("/server-status")}
              className="glass-card rounded-xl p-2.5 hover:bg-dhaba-surface-hover transition-all duration-200 group relative"
              title="Server Status"
            >
              <FaServer className="text-dhaba-muted text-xl group-hover:text-dhaba-accent transition-colors" />
            </button>
          )}

          <button
            onClick={() => navigate("/staff")}
            className="glass-card rounded-xl p-2.5 hover:bg-dhaba-surface-hover transition-all relative group"
            title="Staff Management"
          >
            <FaUsers className="text-dhaba-muted text-xl group-hover:text-dhaba-accent transition-colors" />
          </button>

          {/* Online Orders Toggle — Admin only */}
          {userData.role === "Admin" && (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={toggleMutation.isPending}
              title={isOnline ? "Online orders ON — click to turn off" : "Online orders OFF — click to turn on"}
              className={`glass-card rounded-xl px-3 py-2 flex items-center gap-2 transition-all duration-200 border ${
                isOnline
                  ? "border-dhaba-success/40 hover:bg-dhaba-success/10"
                  : "border-dhaba-danger/40 hover:bg-dhaba-danger/10"
              }`}
            >
              {isOnline
                ? <MdWifi className="text-dhaba-success text-xl" />
                : <MdWifiOff className="text-dhaba-danger text-xl" />
              }
              <span className={`text-xs font-semibold tracking-wide ${isOnline ? "text-dhaba-success" : "text-dhaba-danger"}`}>
                {isOnline ? "Online" : "Offline"}
              </span>
            </button>
          )}

          {/* Cloudflare Tunnel URL — Admin only */}
          {userData.role === "Admin" && (
            <div className="glass-card rounded-xl px-3 py-2 flex items-center gap-2 max-w-[200px]" title={tunnelUrl ? `Tunnel active: ${tunnelUrl} — click copy to get the full customer link` : "Tunnel not active"}>
              {tunnelUrl ? (
                <>
                  <MdSignalWifiStatusbarConnectedNoInternet4 className="text-dhaba-accent text-lg flex-shrink-0" />
                  <span className="text-[10px] text-dhaba-muted font-mono truncate flex-1">
                    {tunnelUrl.replace("https://", "")}
                  </span>
                  <button
                    onClick={handleCopyTunnel}
                    className="flex-shrink-0 hover:text-dhaba-accent transition-colors"
                    title="Copy tunnel URL"
                  >
                    {copied
                      ? <MdCheck className="text-dhaba-success text-base" />
                      : <MdContentCopy className="text-dhaba-muted text-base" />
                    }
                  </button>
                </>
              ) : (
                <>
                  <MdSignalWifiStatusbarConnectedNoInternet4 className="text-dhaba-muted/40 text-lg" />
                  <span className="text-[10px] text-dhaba-muted/40 font-medium">No tunnel</span>
                </>
              )}
            </div>
          )}

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="glass-card rounded-xl p-2.5 hover:bg-dhaba-surface-hover transition-all duration-200 group"
            title="Refresh page"
          >
            <FaSyncAlt className={`text-dhaba-muted text-xl group-hover:text-dhaba-accent transition-colors ${refreshing ? "animate-spin text-dhaba-accent" : ""}`} />
          </button>

          <div className="h-8 w-px bg-dhaba-border/40 mx-1" />

          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-warm flex items-center justify-center text-sm font-bold text-dhaba-bg">
              {userData.name?.charAt(0) || "U"}
            </div>
            <div className="flex flex-col items-start">
              <h1 className="text-sm text-dhaba-text font-semibold tracking-wide">
                {userData.name || "TEST USER"}
              </h1>
              <p className="text-[10px] text-dhaba-accent font-bold tracking-wider uppercase">
                {userData.role || "Role"}
              </p>
            </div>
            <button
              onClick={() => logoutMutation.mutate()}
              className="ml-2 p-2 rounded-xl hover:bg-dhaba-danger/10 transition-colors group"
            >
              <IoLogOut className="text-dhaba-muted text-xl group-hover:text-dhaba-danger transition-colors" />
            </button>
          </div>
        </div>
      </header>

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="glass-card rounded-2xl p-6 w-full max-w-sm shadow-glow">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 mx-auto ${isOnline ? "bg-dhaba-danger/15" : "bg-dhaba-success/15"}`}>
              {isOnline
                ? <MdWifiOff className="text-dhaba-danger text-2xl" />
                : <MdWifi className="text-dhaba-success text-2xl" />
              }
            </div>

            <h2 className="font-display text-lg font-bold text-dhaba-text text-center mb-1">
              {isOnline ? "Turn Off Online Orders?" : "Turn On Online Orders?"}
            </h2>
            <p className="text-dhaba-muted text-sm text-center mb-6">
              {isOnline
                ? "Customers will see an offline page and won't be able to place new orders until you turn this back on."
                : "Customers will be able to browse the menu and place orders online again."
              }
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 glass-card rounded-xl py-2.5 text-sm text-dhaba-muted hover:bg-dhaba-surface-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => toggleMutation.mutate(!isOnline)}
                disabled={toggleMutation.isPending}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                  isOnline
                    ? "bg-dhaba-danger/90 hover:bg-dhaba-danger text-white"
                    : "bg-dhaba-success/90 hover:bg-dhaba-success text-white"
                }`}
              >
                {toggleMutation.isPending
                  ? "Saving…"
                  : isOnline ? "Yes, Turn Off" : "Yes, Turn On"
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;
