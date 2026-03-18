import { getDb } from "../db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToApi(row: any) {
  if (!row) return null;
  const { id, total_earnings, percentage_change_from_yesterday, created_at, updated_at, ...rest } = row;
  return {
    _id: String(id),
    totalEarnings: total_earnings,
    percentageChangeFromYesterday: percentage_change_from_yesterday,
    createdAt: created_at,
    updatedAt: updated_at,
    ...rest,
  };
}

export function findByDate(dateIso: string) {
  const row = getDb().prepare("SELECT * FROM daily_earnings WHERE date = ?").get(dateIso);
  return rowToApi(row);
}

export function findInRange(startIso: string, endIso: string) {
  return getDb()
    .prepare("SELECT * FROM daily_earnings WHERE date >= ? AND date <= ? ORDER BY date ASC")
    .all(startIso, endIso)
    .map(rowToApi);
}

/** Sums total_earnings for a date range — equivalent to Mongoose aggregate $group $sum */
export function sumInRange(startIso: string, endIso: string): number {
  const row = getDb().prepare(
    "SELECT COALESCE(SUM(total_earnings), 0) AS total FROM daily_earnings WHERE date >= ? AND date <= ?"
  ).get(startIso, endIso) as { total: number };
  return row.total;
}

/** Upsert — replaces findOneAndUpdate(upsert:true) */
export function upsert(dateIso: string, totalEarnings: number, percentageChange: number) {
  getDb().prepare(`
    INSERT INTO daily_earnings (date, total_earnings, percentage_change_from_yesterday)
    VALUES (@date, @totalEarnings, @percentageChange)
    ON CONFLICT(date) DO UPDATE SET
      total_earnings = excluded.total_earnings,
      percentage_change_from_yesterday = excluded.percentage_change_from_yesterday,
      updated_at = datetime('now')
  `).run({ date: dateIso, totalEarnings, percentageChange });
  return findByDate(dateIso)!;
}

/** Atomically increment total_earnings for a date */
export function incrementEarnings(dateIso: string, delta: number) {
  getDb().prepare(`
    INSERT INTO daily_earnings (date, total_earnings, percentage_change_from_yesterday)
    VALUES (@date, @delta, 0)
    ON CONFLICT(date) DO UPDATE SET
      total_earnings = total_earnings + excluded.total_earnings,
      updated_at = datetime('now')
  `).run({ date: dateIso, delta });
  return findByDate(dateIso)!;
}

/** Sum paid orders' totalWithTax for a given date range — used by calculateAndSaveDailyEarnings */
export function sumPaidOrdersInRange(startIso: string, endIso: string): number {
  const row = getDb().prepare(`
    SELECT COALESCE(SUM(json_extract(bills, '$.totalWithTax')), 0) AS total
    FROM orders
    WHERE payment_status = 'Paid'
      AND order_date >= ?
      AND order_date <= ?
  `).get(startIso, endIso) as { total: number };
  return row.total;
}
