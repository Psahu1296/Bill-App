"use client";
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getAvatarName, getBgColor } from "../../utils";
import { removeCustomer, updateTable as tableStateUpdate } from "../../redux/slices/customerSlice";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateTable } from "../../https";
import { removeAllItems } from "../../redux/slices/cartSlice";
import { useAppDispatch } from "../../redux/hooks";
import { MdChair } from "react-icons/md";
import { MdQrCode2, MdDownload, MdClose } from "react-icons/md";
import { QRCodeCanvas } from "qrcode.react";

interface TableCardProps {
  id: string;
  name: number | string;
  status: "Available" | "Booked";
  initials?: string;
  seats: number;
  orderId?: string;
}

const TableCard: React.FC<TableCardProps> = ({ id, name, status, initials, seats, orderId }) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isBooked = status === "Booked";

  const [showQr, setShowQr] = useState(false);
  const [tunnelUrl, setTunnelUrl] = useState<string | null>(null);
  const qrRef = useRef<HTMLCanvasElement | null>(null);

  // Read tunnel URL from Electron bridge (same pattern as Header)
  useEffect(() => {
    const bridge = (window as unknown as Record<string, unknown>).appBridge as
      | { getTunnelUrl: () => Promise<string | null>; onTunnelUrl: (cb: (u: string | null) => void) => () => void }
      | undefined;
    if (!bridge) return;
    bridge.getTunnelUrl().then(setTunnelUrl);
    const unsub = bridge.onTunnelUrl(setTunnelUrl);
    return unsub;
  }, []);

  const customerBase = (import.meta.env.VITE_CUSTOMER_APP_URL as string | undefined) ?? "";
  const qrUrl = tunnelUrl
    ? `${customerBase}/?type=dine-in&table=${name}&api=${tunnelUrl}`
    : `${customerBase}/?type=dine-in&table=${name}`;

  const handleDownload = () => {
    const canvas = qrRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `table-${name}-qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const handleClick = () => {
    if (isBooked) return;
    dispatch(tableStateUpdate({ table: { tableId: id, tableNo: name } }));
    navigate("/menu");
  };

  const onChangeStatus = (e: React.MouseEvent) => {
    e.stopPropagation();
    tableUpdateMutation.mutate({ tableId: id, status: isBooked ? "Available" : "Booked", orderId: isBooked ? null : (orderId ?? null) });
  };

  const tableUpdateMutation = useMutation({
    mutationFn: (reqData: { tableId: string; status: string; orderId: string | null }) => updateTable(reqData),
    onSuccess: () => {
      dispatch(removeCustomer());
      dispatch(removeAllItems());
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  return (
    <>
    <div
      onClick={handleClick}
      className={`glass-card rounded-2xl p-5 transition-all duration-300 ${
        !isBooked ? "cursor-pointer hover:shadow-glow hover:-translate-y-1" : "cursor-default"
      }`}
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-display text-lg font-bold text-dhaba-text">
          Table {name}
        </h3>
        <span className={`status-chip ${
          isBooked ? "bg-dhaba-success/15 text-dhaba-success" : "bg-dhaba-accent/15 text-dhaba-accent"
        }`}>
          {status}
        </span>
      </div>

      <div className="flex items-center justify-center py-4">
        <div
          className="h-16 w-16 rounded-2xl flex items-center justify-center text-lg font-bold text-white transition-transform hover:scale-105"
          style={{ backgroundColor: initials ? getBgColor() : "hsl(var(--dhaba-surface))" }}
        >
          {getAvatarName(initials) || "—"}
        </div>
      </div>

      <div className="flex justify-between items-center mt-4 pt-3 border-t border-dhaba-border/20">
        <div className="flex items-center gap-2 text-dhaba-muted text-sm">
          <MdChair className="text-dhaba-accent" />
          <span>{seats} seats</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="text-xs font-bold p-1.5 rounded-xl bg-dhaba-surface text-dhaba-muted hover:text-dhaba-accent hover:bg-dhaba-accent/10 transition-colors"
            title="Show QR code"
            onClick={(e) => { e.stopPropagation(); setShowQr(true); }}
          >
            <MdQrCode2 className="text-base" />
          </button>
          <button
            className="text-xs font-bold px-3 py-1.5 rounded-xl bg-dhaba-accent/10 text-dhaba-accent hover:bg-dhaba-accent/20 transition-colors"
            onClick={onChangeStatus}
          >
            {isBooked ? "Free Up" : "Reserve"}
          </button>
        </div>
      </div>
    </div>

    {/* ── QR Modal ── */}
    {showQr && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={() => setShowQr(false)}
      >
        <div
          className="glass-card rounded-2xl p-6 w-72 flex flex-col items-center gap-4 shadow-glow"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="w-full flex items-center justify-between">
            <div>
              <p className="font-display font-bold text-dhaba-text text-base">Table {name}</p>
              <p className="text-xs text-dhaba-muted">{seats} seats · Scan to order</p>
            </div>
            <button
              onClick={() => setShowQr(false)}
              className="w-8 h-8 rounded-xl bg-dhaba-surface-hover flex items-center justify-center text-dhaba-muted hover:text-dhaba-text transition-colors"
            >
              <MdClose />
            </button>
          </div>

          {/* QR code */}
          <div className="bg-white p-3 rounded-xl">
            <QRCodeCanvas
              ref={qrRef}
              value={qrUrl}
              size={180}
              bgColor="#ffffff"
              fgColor="#1a1108"
              level="M"
              includeMargin={false}
            />
          </div>

          <p className="text-[11px] text-dhaba-muted text-center break-all px-1 leading-relaxed">
            {qrUrl}
          </p>

          {/* Download */}
          <button
            onClick={handleDownload}
            className="btn-primary w-full rounded-xl py-2.5 flex items-center justify-center gap-2 text-sm font-bold"
          >
            <MdDownload className="text-base" /> Download PNG
          </button>
        </div>
      </div>
    )}
    </>
  );
};

export default TableCard;
