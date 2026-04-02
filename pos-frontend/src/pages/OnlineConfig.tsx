import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MdWifi, MdWifiOff, MdDeliveryDining, MdAccessTime, MdAdd, MdEdit, MdCheck, MdClose } from "react-icons/md";
import { FiTrash2 } from "react-icons/fi";
import BackButton from "../components/shared/BackButton";
import {
  getOnlineConfigFlags,
  updateOnlineConfigFlags,
  getDeliveryAreas,
  addDeliveryArea,
  deleteDeliveryArea,
  toggleDeliveryArea,
} from "../https";
import type { OnlineConfigFlags, DeliveryArea } from "../types";

interface AreaEditState {
  deliveryFee: string;
  minOrderAmount: string;
}

const OnlineConfig: React.FC = () => {
  useEffect(() => { document.title = "Dhaba POS | Online Config"; }, []);

  const queryClient = useQueryClient();

  // ── Flags ────────────────────────────────────────────────────────────────────
  const { data: flagsData, isLoading: flagsLoading } = useQuery<OnlineConfigFlags>({
    queryKey: ["online-config", "flags"],
    queryFn: () => getOnlineConfigFlags().then(r => r.data.data),
    staleTime: 30 * 1000,
  });

  const [timeStart, setTimeStart] = useState("");
  const [timeEnd, setTimeEnd] = useState("");
  const [confirmToggle, setConfirmToggle] = useState<{ field: "isOnline" | "deliveryEnabled"; next: boolean } | null>(null);

  useEffect(() => {
    if (flagsData) {
      setTimeStart(flagsData.availableTimeStart);
      setTimeEnd(flagsData.availableTimeEnd);
    }
  }, [flagsData]);

  const flagsMutation = useMutation({
    mutationFn: (data: Partial<OnlineConfigFlags>) => updateOnlineConfigFlags(data).then(r => r.data.data),
    onSuccess: (data) => {
      queryClient.setQueryData(["online-config", "flags"], data);
      setConfirmToggle(null);
    },
  });

  const handleToggle = (field: "isOnline" | "deliveryEnabled") => {
    const current = flagsData?.[field] ?? true;
    setConfirmToggle({ field, next: !current });
  };

  const handleSaveHours = () => {
    flagsMutation.mutate({ availableTimeStart: timeStart, availableTimeEnd: timeEnd });
  };

  const hoursChanged = flagsData
    ? timeStart !== flagsData.availableTimeStart || timeEnd !== flagsData.availableTimeEnd
    : false;

  // ── Delivery Areas ────────────────────────────────────────────────────────────
  const { data: areas = [], isLoading: areasLoading } = useQuery<DeliveryArea[]>({
    queryKey: ["online-config", "areas"],
    queryFn: () => getDeliveryAreas(true).then(r => r.data.data),
  });

  const [newAreaName, setNewAreaName] = useState("");
  const [newAreaFee, setNewAreaFee] = useState("0");
  const [newAreaMin, setNewAreaMin] = useState("0");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [areasError, setAreasError] = useState<string | null>(null);
  // Per-area edit state: areaId → { deliveryFee, minOrderAmount } as strings for inputs
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<AreaEditState>({ deliveryFee: "0", minOrderAmount: "0" });

  const addMutation = useMutation({
    mutationFn: ({ name, fee, min }: { name: string; fee: number; min: number }) =>
      addDeliveryArea(name, fee, min).then(r => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["online-config", "areas"] });
      setNewAreaName(""); setNewAreaFee("0"); setNewAreaMin("0");
      setAreasError(null);
    },
    onError: () => setAreasError("Failed to add area. Name may already exist."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDeliveryArea(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["online-config", "areas"] });
      setDeleteConfirmId(null);
    },
  });

  const patchMutation = useMutation({
    mutationFn: (payload: { id: string } & Record<string, unknown>) => {
      const { id, ...rest } = payload;
      return toggleDeliveryArea(id, rest as { isActive?: boolean; deliveryFee?: number; minOrderAmount?: number }).then(r => r.data.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["online-config", "areas"] });
      setEditingId(null);
    },
  });

  const handleAddArea = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newAreaName.trim();
    if (!name) return;
    addMutation.mutate({ name, fee: Number(newAreaFee) || 0, min: Number(newAreaMin) || 0 });
  };

  const startEdit = (area: DeliveryArea) => {
    setEditingId(area._id);
    setEditState({ deliveryFee: String(area.deliveryFee), minOrderAmount: String(area.minOrderAmount) });
  };

  const saveEdit = (id: string) => {
    patchMutation.mutate({
      id,
      deliveryFee: Number(editState.deliveryFee) || 0,
      minOrderAmount: Number(editState.minOrderAmount) || 0,
    });
  };

  return (
    <div className="bg-dhaba-bg min-h-[calc(100vh-4rem)] pb-8">
      <div className="container mx-auto px-6 py-6 max-w-3xl">

        {/* Page header */}
        <div className="flex items-center gap-3 mb-6">
          <BackButton />
          <div>
            <h1 className="font-display text-2xl font-bold text-dhaba-text">Online Config</h1>
            <p className="text-sm text-dhaba-muted">Manage store availability, delivery, and areas</p>
          </div>
        </div>

        {/* ── Store Flags ─────────────────────────────────────────────────────── */}
        <section className="space-y-4 mb-8">
          <h2 className="text-sm font-semibold text-dhaba-muted uppercase tracking-wider">Store Status</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Online Orders Toggle */}
            <button
              onClick={() => handleToggle("isOnline")}
              disabled={flagsLoading || flagsMutation.isPending}
              className={`glass-card rounded-2xl p-5 flex items-center gap-4 text-left transition-all border ${
                flagsData?.isOnline
                  ? "border-dhaba-success/40 hover:bg-dhaba-success/5"
                  : "border-dhaba-danger/40 hover:bg-dhaba-danger/5"
              }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                flagsData?.isOnline ? "bg-dhaba-success/15" : "bg-dhaba-danger/15"
              }`}>
                {flagsData?.isOnline
                  ? <MdWifi className="text-dhaba-success text-2xl" />
                  : <MdWifiOff className="text-dhaba-danger text-2xl" />
                }
              </div>
              <div className="flex-1">
                <p className="font-semibold text-dhaba-text text-sm">Online Orders</p>
                <p className={`text-xs font-bold mt-0.5 ${flagsData?.isOnline ? "text-dhaba-success" : "text-dhaba-danger"}`}>
                  {flagsLoading ? "Loading…" : flagsData?.isOnline ? "ON — Accepting orders" : "OFF — Customers see offline screen"}
                </p>
              </div>
            </button>

            {/* Delivery Toggle */}
            <button
              onClick={() => handleToggle("deliveryEnabled")}
              disabled={flagsLoading || flagsMutation.isPending}
              className={`glass-card rounded-2xl p-5 flex items-center gap-4 text-left transition-all border ${
                flagsData?.deliveryEnabled
                  ? "border-dhaba-success/40 hover:bg-dhaba-success/5"
                  : "border-dhaba-border/40 hover:bg-dhaba-surface-hover"
              }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                flagsData?.deliveryEnabled ? "bg-dhaba-success/15" : "bg-dhaba-muted/10"
              }`}>
                <MdDeliveryDining className={`text-2xl ${flagsData?.deliveryEnabled ? "text-dhaba-success" : "text-dhaba-muted"}`} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-dhaba-text text-sm">Delivery</p>
                <p className={`text-xs font-bold mt-0.5 ${flagsData?.deliveryEnabled ? "text-dhaba-success" : "text-dhaba-muted"}`}>
                  {flagsLoading ? "Loading…" : flagsData?.deliveryEnabled ? "ON — Delivery available" : "OFF — Dine-in & Takeaway only"}
                </p>
              </div>
            </button>
          </div>

          {/* Available Hours */}
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <MdAccessTime className="text-dhaba-accent text-xl" />
              <p className="font-semibold text-dhaba-text text-sm">Available Hours</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-xs text-dhaba-muted">From</label>
                <input
                  type="time" value={timeStart} onChange={e => setTimeStart(e.target.value)}
                  className="glass-input rounded-lg px-3 py-2 text-sm text-dhaba-text bg-transparent border border-dhaba-border/40 focus:border-dhaba-accent outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-dhaba-muted">Until</label>
                <input
                  type="time" value={timeEnd} onChange={e => setTimeEnd(e.target.value)}
                  className="glass-input rounded-lg px-3 py-2 text-sm text-dhaba-text bg-transparent border border-dhaba-border/40 focus:border-dhaba-accent outline-none"
                />
              </div>
              {hoursChanged && (
                <button
                  onClick={handleSaveHours}
                  disabled={flagsMutation.isPending}
                  className="bg-dhaba-accent text-dhaba-bg text-xs font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {flagsMutation.isPending ? "Saving…" : "Save Hours"}
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ── Delivery Areas ───────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-dhaba-muted uppercase tracking-wider">Delivery Areas</h2>
            <span className="text-xs text-dhaba-muted">{areas.length} area{areas.length !== 1 ? "s" : ""}</span>
          </div>

          {/* Add area form */}
          <form onSubmit={handleAddArea} className="glass-card rounded-2xl p-4 mb-4 space-y-3">
            <p className="text-xs font-semibold text-dhaba-muted uppercase tracking-wider">Add New Area</p>
            <div className="flex gap-2">
              <input
                type="text" value={newAreaName} onChange={e => { setNewAreaName(e.target.value); setAreasError(null); }}
                placeholder="Area name (e.g. Sonkatch)"
                className="glass-input flex-1 rounded-xl px-4 py-2.5 text-sm text-dhaba-text bg-transparent border border-dhaba-border/40 focus:border-dhaba-accent outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-dhaba-muted block mb-1">Delivery Fee (₹)</label>
                <input
                  type="number" min="0" step="1" value={newAreaFee} onChange={e => setNewAreaFee(e.target.value)}
                  className="glass-input w-full rounded-xl px-3 py-2 text-sm text-dhaba-text bg-transparent border border-dhaba-border/40 focus:border-dhaba-accent outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-dhaba-muted block mb-1">Minimum Order (₹)</label>
                <input
                  type="number" min="0" step="1" value={newAreaMin} onChange={e => setNewAreaMin(e.target.value)}
                  className="glass-input w-full rounded-xl px-3 py-2 text-sm text-dhaba-text bg-transparent border border-dhaba-border/40 focus:border-dhaba-accent outline-none"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={!newAreaName.trim() || addMutation.isPending}
              className="w-full bg-dhaba-accent text-dhaba-bg py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              <MdAdd className="text-base" />
              {addMutation.isPending ? "Adding…" : "Add Area"}
            </button>
            {areasError && <p className="text-xs text-dhaba-danger">{areasError}</p>}
          </form>

          {/* Areas list */}
          {areasLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="glass-card rounded-xl h-16 animate-pulse" />)}
            </div>
          ) : areas.length === 0 ? (
            <div className="glass-card rounded-2xl p-8 text-center">
              <MdDeliveryDining className="text-dhaba-muted/40 text-4xl mx-auto mb-2" />
              <p className="text-sm text-dhaba-muted">No delivery areas yet. Add one above.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {areas.map((area) => {
                const isEditing = editingId === area._id;
                return (
                  <div key={area._id} className="glass-card rounded-xl px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-dhaba-text">{area.name}</span>
                        {!isEditing && (
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-xs text-dhaba-muted">
                              Fee: <span className="text-dhaba-text font-medium">₹{area.deliveryFee}</span>
                            </span>
                            <span className="text-xs text-dhaba-muted">
                              Min order: <span className="text-dhaba-text font-medium">
                                {area.minOrderAmount > 0 ? `₹${area.minOrderAmount}` : "—"}
                              </span>
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Active badge */}
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${
                        area.isActive ? "bg-dhaba-success/15 text-dhaba-success" : "bg-dhaba-muted/15 text-dhaba-muted"
                      }`}>
                        {area.isActive ? "Active" : "Inactive"}
                      </span>

                      {/* Toggle switch */}
                      <button
                        onClick={() => patchMutation.mutate({ id: area._id, isActive: !area.isActive })}
                        disabled={patchMutation.isPending}
                        title={area.isActive ? "Deactivate" : "Activate"}
                        className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${area.isActive ? "bg-dhaba-success" : "bg-dhaba-border/60"}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${area.isActive ? "left-[22px]" : "left-0.5"}`} />
                      </button>

                      {/* Edit / Save / Cancel */}
                      {isEditing ? (
                        <>
                          <button onClick={() => saveEdit(area._id)} disabled={patchMutation.isPending}
                            className="p-1.5 rounded-lg bg-dhaba-success/15 text-dhaba-success hover:bg-dhaba-success/25 transition-colors flex-shrink-0">
                            <MdCheck className="text-sm" />
                          </button>
                          <button onClick={() => setEditingId(null)}
                            className="p-1.5 rounded-lg hover:bg-dhaba-surface-hover text-dhaba-muted transition-colors flex-shrink-0">
                            <MdClose className="text-sm" />
                          </button>
                        </>
                      ) : (
                        <button onClick={() => startEdit(area)}
                          className="p-1.5 rounded-lg hover:bg-dhaba-surface-hover text-dhaba-muted hover:text-dhaba-accent transition-colors flex-shrink-0">
                          <MdEdit className="text-sm" />
                        </button>
                      )}

                      {/* Delete */}
                      <button
                        onClick={() => setDeleteConfirmId(area._id)}
                        className="p-1.5 rounded-lg hover:bg-dhaba-danger/10 text-dhaba-muted hover:text-dhaba-danger transition-colors flex-shrink-0"
                        title="Delete area"
                      >
                        <FiTrash2 className="text-sm" />
                      </button>
                    </div>

                    {/* Inline edit inputs */}
                    {isEditing && (
                      <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-dhaba-border/20">
                        <div>
                          <label className="text-xs text-dhaba-muted block mb-1">Delivery Fee (₹)</label>
                          <input
                            type="number" min="0" step="1"
                            value={editState.deliveryFee}
                            onChange={e => setEditState(s => ({ ...s, deliveryFee: e.target.value }))}
                            className="glass-input w-full rounded-lg px-3 py-2 text-sm text-dhaba-text bg-transparent border border-dhaba-border/40 focus:border-dhaba-accent outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-dhaba-muted block mb-1">Minimum Order (₹)</label>
                          <input
                            type="number" min="0" step="1"
                            value={editState.minOrderAmount}
                            onChange={e => setEditState(s => ({ ...s, minOrderAmount: e.target.value }))}
                            className="glass-input w-full rounded-lg px-3 py-2 text-sm text-dhaba-text bg-transparent border border-dhaba-border/40 focus:border-dhaba-accent outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ── Confirm Toggle Dialog ──────────────────────────────────────────────── */}
      {confirmToggle && flagsData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="glass-card rounded-2xl p-6 w-full max-w-sm shadow-glow">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 mx-auto ${
              confirmToggle.next ? "bg-dhaba-success/15" : "bg-dhaba-danger/15"
            }`}>
              {confirmToggle.field === "isOnline"
                ? confirmToggle.next
                  ? <MdWifi className="text-dhaba-success text-2xl" />
                  : <MdWifiOff className="text-dhaba-danger text-2xl" />
                : <MdDeliveryDining className={`text-2xl ${confirmToggle.next ? "text-dhaba-success" : "text-dhaba-muted"}`} />
              }
            </div>
            <h2 className="font-display text-lg font-bold text-dhaba-text text-center mb-1">
              {confirmToggle.field === "isOnline"
                ? confirmToggle.next ? "Turn On Online Orders?" : "Turn Off Online Orders?"
                : confirmToggle.next ? "Enable Delivery?" : "Disable Delivery?"
              }
            </h2>
            <p className="text-dhaba-muted text-sm text-center mb-6">
              {confirmToggle.field === "isOnline"
                ? confirmToggle.next
                  ? "Customers will be able to browse the menu and place orders online."
                  : "Customers will see an offline page and won't be able to place new orders."
                : confirmToggle.next
                  ? "Customers will see Delivery as an order type option."
                  : "Delivery will be hidden. Only Dine-in and Takeaway will be available."
              }
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmToggle(null)}
                className="flex-1 glass-card rounded-xl py-2.5 text-sm text-dhaba-muted hover:bg-dhaba-surface-hover transition-colors">
                Cancel
              </button>
              <button
                onClick={() => flagsMutation.mutate({ [confirmToggle.field]: confirmToggle.next })}
                disabled={flagsMutation.isPending}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                  confirmToggle.next
                    ? "bg-dhaba-success/90 hover:bg-dhaba-success text-white"
                    : "bg-dhaba-danger/90 hover:bg-dhaba-danger text-white"
                }`}
              >
                {flagsMutation.isPending ? "Saving…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Delete Dialog ──────────────────────────────────────────────── */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="glass-card rounded-2xl p-6 w-full max-w-sm shadow-glow">
            <div className="w-12 h-12 rounded-xl bg-dhaba-danger/15 flex items-center justify-center mb-4 mx-auto">
              <FiTrash2 className="text-dhaba-danger text-xl" />
            </div>
            <h2 className="font-display text-lg font-bold text-dhaba-text text-center mb-1">Delete Area?</h2>
            <p className="text-dhaba-muted text-sm text-center mb-6">
              This area will be permanently removed. Active delivery orders won't be affected.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirmId(null)}
                className="flex-1 glass-card rounded-xl py-2.5 text-sm text-dhaba-muted hover:bg-dhaba-surface-hover transition-colors">
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirmId)}
                disabled={deleteMutation.isPending}
                className="flex-1 bg-dhaba-danger/90 hover:bg-dhaba-danger text-white rounded-xl py-2.5 text-sm font-semibold transition-colors"
              >
                {deleteMutation.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OnlineConfig;
