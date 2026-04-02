/**
 * Strips formatting and country code from a phone number, returning the last 10 digits.
 * Examples:
 *   "+91-98765-43210" → "9876543210"
 *   "09876543210"     → "9876543210"
 *   "9876543210"      → "9876543210"
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").replace(/^91/, "").slice(-10);
}
