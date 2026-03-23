import { Request, Response } from "express";
import { notifEmitter, AdminNotification } from "../utils/notificationEmitter";

// ── GET /api/admin/notify/stream (SSE) ───────────────────────────────────────
// Streams real-time order notifications to the POS frontend.
// Requires auth — EventSource sends cookies automatically.
export function streamAdminNotifications(req: Request, res: Response) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Keepalive comment every 25 s to prevent proxy timeouts
  const keepAlive = setInterval(() => {
    res.write(": keepalive\n\n");
  }, 25_000);

  const onNotification = (data: AdminNotification) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  notifEmitter.on("admin", onNotification);

  req.on("close", () => {
    clearInterval(keepAlive);
    notifEmitter.off("admin", onNotification);
  });
}
