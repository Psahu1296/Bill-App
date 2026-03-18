import fs from "fs";
import { Request, Response, NextFunction } from "express";
import * as XLSX from "xlsx";
import { getDb } from "../db";

const TABLE_MAP: Record<string, string> = {
  orders: "orders",
  staff: "staff",
  consumables: "consumables",
  tables: "tables_tb",
  dishes: "dishes",
  ledger: "customer_ledger",
};

// Column used for date-range filtering per module (null = no filter)
const DATE_COL: Record<string, string | null> = {
  orders: "order_date",
  consumables: "timestamp",
  staff: null,
  tables: null,
  dishes: null,
  ledger: null,
};

// ─── Stats ────────────────────────────────────────────────────────────────────

export const getStats = (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    let totalRecords = 0;
    const counts: Record<string, number> = {};

    for (const [key, table] of Object.entries(TABLE_MAP)) {
      const row = db.prepare(`SELECT COUNT(*) as cnt FROM ${table}`).get() as { cnt: number };
      counts[key] = row.cnt;
      totalRecords += row.cnt;
    }

    const dbPath = process.env["DATABASE_PATH"] ?? "";
    let dbSize = "N/A";
    if (dbPath) {
      try {
        const bytes = fs.statSync(dbPath).size;
        dbSize =
          bytes > 1_048_576
            ? `${(bytes / 1_048_576).toFixed(1)} MB`
            : `${(bytes / 1024).toFixed(1)} KB`;
      } catch {
        // file might not exist yet in dev
      }
    }

    res.json({ success: true, data: { totalRecords, counts, dbSize } });
  } catch (err) {
    next(err);
  }
};

// ─── Export helper ────────────────────────────────────────────────────────────

function fetchModuleRows(
  mod: string,
  startDate?: string,
  endDate?: string
): Record<string, unknown>[] {
  const db = getDb();
  const table = TABLE_MAP[mod];
  const dateCol = DATE_COL[mod];

  let sql: string;
  const params: string[] = [];

  if (mod === "staff") {
    // Include payments as JSON array
    sql = `
      SELECT s.*,
        (SELECT json_group_array(json_object(
          'id', sp.id, 'amount', sp.amount, 'type', sp.type, 'date', sp.date, 'note', sp.note
        )) FROM staff_payments sp WHERE sp.staff_id = s.id) AS payments
      FROM staff s
    `;
  } else if (mod === "ledger") {
    // Include transactions as JSON array
    sql = `
      SELECT l.*,
        (SELECT json_group_array(json_object(
          'id', t.id, 'transaction_type', t.transaction_type,
          'amount', t.amount, 'timestamp', t.timestamp, 'notes', t.notes
        )) FROM customer_ledger_transactions t WHERE t.ledger_id = l.id) AS transactions
      FROM customer_ledger l
    `;
  } else if (dateCol && startDate && endDate) {
    const endDt = new Date(endDate);
    endDt.setUTCHours(23, 59, 59, 999);
    sql = `SELECT * FROM ${table} WHERE ${dateCol} >= ? AND ${dateCol} <= ? ORDER BY ${dateCol} DESC`;
    params.push(new Date(startDate).toISOString(), endDt.toISOString());
  } else {
    sql = `SELECT * FROM ${table}`;
  }

  return db.prepare(sql).all(...params) as Record<string, unknown>[];
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const exportData = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { modules, startDate, endDate, format } = req.query as Record<string, string>;

    if (!modules) {
      res.status(400).json({ success: false, message: "modules query param is required" });
      return;
    }

    const moduleList = modules.split(",").filter((m) => TABLE_MAP[m]);
    const result: Record<string, Record<string, unknown>[]> = {};

    for (const mod of moduleList) {
      result[mod] = fetchModuleRows(mod, startDate, endDate);
    }

    const ts = Date.now();

    if (format === "csv") {
      const csvParts: string[] = [];
      for (const [mod, rows] of Object.entries(result)) {
        if (!rows.length) {
          csvParts.push(`### ${mod}\n(no data)`);
          continue;
        }
        const headers = Object.keys(rows[0]).join(",");
        const body = rows
          .map((r) =>
            Object.values(r)
              .map((v) =>
                v == null
                  ? ""
                  : typeof v === "string"
                  ? `"${v.replace(/"/g, '""')}"`
                  : v
              )
              .join(",")
          )
          .join("\n");
        csvParts.push(`### ${mod}\n${headers}\n${body}`);
      }
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="dhaba-export-${ts}.csv"`
      );
      res.send(csvParts.join("\n\n"));
      return;
    }

    if (format === "xlsx") {
      const wb = XLSX.utils.book_new();
      for (const [mod, rows] of Object.entries(result)) {
        // Flatten any JSON-string columns so they're readable in the sheet
        const flatRows = rows.map((r) => {
          const out: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(r)) {
            if (typeof v === "string") {
              try {
                const parsed = JSON.parse(v);
                // Only flatten if it's an object/array (not a plain string that happens to be valid JSON)
                if (typeof parsed === "object" && parsed !== null) {
                  out[k] = JSON.stringify(parsed); // keep as compact string in cell
                } else {
                  out[k] = v;
                }
              } catch {
                out[k] = v;
              }
            } else {
              out[k] = v;
            }
          }
          return out;
        });
        const ws = XLSX.utils.json_to_sheet(flatRows.length ? flatRows : [{}]);
        XLSX.utils.book_append_sheet(wb, ws, mod.slice(0, 31)); // sheet names max 31 chars
      }
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="dhaba-export-${ts}.xlsx"`);
      res.send(buf);
      return;
    }

    // Default: JSON
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="dhaba-export-${ts}.json"`
    );
    res.json({ exportedAt: new Date().toISOString(), data: result });
  } catch (err) {
    next(err);
  }
};

// ─── Delete ───────────────────────────────────────────────────────────────────

export const deleteData = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { modules, startDate, endDate } = req.body as {
      modules: string[];
      startDate?: string;
      endDate?: string;
    };

    if (!Array.isArray(modules) || modules.length === 0) {
      res.status(400).json({ success: false, message: "modules array is required" });
      return;
    }

    const db = getDb();
    const counts: Record<string, number> = {};

    const deleteTx = db.transaction(() => {
      for (const mod of modules) {
        const table = TABLE_MAP[mod];
        if (!table) continue;

        const dateCol = DATE_COL[mod];
        let result: { changes: number };

        if (dateCol && startDate && endDate) {
          const endDt = new Date(endDate);
          endDt.setUTCHours(23, 59, 59, 999);
          result = db
            .prepare(`DELETE FROM ${table} WHERE ${dateCol} >= ? AND ${dateCol} <= ?`)
            .run(new Date(startDate).toISOString(), endDt.toISOString()) as { changes: number };
        } else {
          result = db.prepare(`DELETE FROM ${table}`).run() as { changes: number };
        }

        counts[mod] = result.changes;
      }
    });

    deleteTx();

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    res.json({
      success: true,
      message: `Deleted ${total} record(s).`,
      data: counts,
    });
  } catch (err) {
    next(err);
  }
};
