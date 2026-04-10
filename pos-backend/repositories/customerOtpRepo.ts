import { getDb } from "../db";

/** Create a new OTP session, replacing any previous one for this phone. */
export function createOtp(phone: string, otp: string, expirySeconds: number): void {
  const db = getDb();
  db.prepare("DELETE FROM customer_otp_sessions WHERE phone = ?").run(phone);
  const expiresAt = new Date(Date.now() + expirySeconds * 1000).toISOString();
  db.prepare(
    "INSERT INTO customer_otp_sessions (phone, otp_code, expires_at) VALUES (?, ?, ?)"
  ).run(phone, otp, expiresAt);
}

export type OtpResult = "verified" | "invalid" | "expired" | "max_attempts";

/** Verify an OTP for the given phone. Increments attempt counter on wrong code. */
export function verifyOtp(phone: string, otp: string): OtpResult {
  const db = getDb();
  const row = db.prepare(
    "SELECT * FROM customer_otp_sessions WHERE phone = ? AND verified = 0 ORDER BY id DESC LIMIT 1"
  ).get(phone) as Record<string, unknown> | undefined;

  if (!row) return "invalid";
  if (new Date(row.expires_at as string) < new Date()) return "expired";
  if ((row.attempts as number) >= 5) return "max_attempts";

  if (row.otp_code !== otp) {
    db.prepare("UPDATE customer_otp_sessions SET attempts = attempts + 1 WHERE id = ?").run(row.id);
    return "invalid";
  }

  db.prepare("UPDATE customer_otp_sessions SET verified = 1 WHERE id = ?").run(row.id);
  return "verified";
}

/**
 * Count how many OTPs have been sent to this phone in the last `windowMinutes`.
 * Used to enforce a per-phone send cap regardless of IP.
 */
export function countRecentSends(phone: string, windowMinutes = 60): number {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const row = getDb().prepare(
    "SELECT COUNT(*) as cnt FROM customer_otp_sessions WHERE phone = ? AND created_at >= ?"
  ).get(phone, since) as { cnt: number };
  return row.cnt;
}

/** Remove all expired sessions — call on each send to keep the table clean. */
export function cleanup(): void {
  getDb().prepare("DELETE FROM customer_otp_sessions WHERE expires_at < datetime('now')").run();
}
