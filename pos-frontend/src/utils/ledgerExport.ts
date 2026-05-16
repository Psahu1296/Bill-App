import jsPDF from "jspdf";
import { autoTable } from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { Order, CustomerProfile, CustomerLedger } from "../types";

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(date: string) {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtTime(date: string) {
  return new Date(date).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function payStatus(order: Order) {
  if (order.paymentStatus === "Paid") return "Paid";
  if ((order.balanceDueOnOrder ?? 0) > 0 && (order.amountPaid ?? 0) > 0)
    return "Partial";
  return "Unpaid";
}

function itemsSummary(order: Order, maxLen = 60) {
  const s = order.items
    .map((i) => `${i.name}${i.quantity > 1 ? " ×" + i.quantity : ""}`)
    .join(", ");
  return s.length > maxLen ? s.slice(0, maxLen - 1) + "…" : s;
}

function formatPhone(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.length === 10) return "91" + d;
  if (d.startsWith("0") && d.length === 11) return "91" + d.slice(1);
  return d;
}

export interface ExportPayload {
  orders: Order[];
  profile?: CustomerProfile;
  ledger?: CustomerLedger | null;
  phone: string;
}

// ─── PDF builder ──────────────────────────────────────────────────────────────

function buildPDF({ orders, profile, ledger, phone }: ExportPayload): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const name = profile?.name ?? ledger?.customerName ?? phone;
  const area = profile?.preferredArea ?? "";
  const balance = ledger?.balanceDue ?? profile?.balanceDue ?? 0;
  const now = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const totalBilled = orders.reduce((s, o) => s + o.bills.totalWithTax, 0);
  const totalPaid = orders.reduce((s, o) => s + (o.amountPaid ?? 0), 0);

  // ── Header bar ──
  doc.setFillColor(10, 18, 40);
  doc.rect(0, 0, 210, 38, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("CUSTOMER LEDGER", 14, 15);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated: ${now}`, 14, 22);
  doc.text("Confidential — For customer reference only", 14, 28);

  // ── Customer card ──
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, 43, 182, area ? 34 : 30, 3, 3, "F");

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(name, 20, 54);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(`Phone: ${phone}`, 20, 62);
  if (area) doc.text(`Area: ${area}`, 20, 69);

  // Balance chip (right side of card)
  // Rect: x=138, y=47, w=52, h=24 → center-x=164, center-y=59
  // Two text lines centered inside: label baseline=55, amount baseline=66
  const isOwed = balance > 0;
  doc.setFillColor(...(isOwed ? ([220, 38, 38] as [number, number, number]) : ([5, 150, 105] as [number, number, number])));
  doc.roundedRect(138, 47, 52, 24, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("OUTSTANDING", 164, 55, { align: "center" });
  doc.setFontSize(12);
  doc.text(`Rs. ${balance.toFixed(2)}`, 164, 65, { align: "center" });

  // ── Orders table ──
  const startY = area ? 83 : 79;

  const GREEN: [number, number, number] = [5, 150, 105];
  const AMBER: [number, number, number] = [217, 119, 6];
  const RED: [number, number, number] = [220, 38, 38];

  autoTable(doc, {
    startY,
    head: [["Date", "Time", "Items", "Type", "Total", "Paid", "Due", "Status"]],
    body: orders.map((o) => [
      fmtDate(o.orderDate),
      fmtTime(o.orderDate),
      itemsSummary(o),
      o.orderType ?? "dine-in",
      `Rs. ${o.bills.totalWithTax.toFixed(2)}`,
      `Rs. ${(o.amountPaid ?? 0).toFixed(2)}`,
      (o.balanceDueOnOrder ?? 0) > 0
        ? `Rs. ${o.balanceDueOnOrder.toFixed(2)}`
        : "—",
      payStatus(o),
    ]),
    theme: "striped",
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7.5,
      halign: "center",
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [15, 23, 42],
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 22, halign: "center" },
      1: { cellWidth: 14, halign: "center" },
      2: { cellWidth: 56 },
      3: { cellWidth: 17, halign: "center" },
      4: { cellWidth: 22, halign: "right" },
      5: { cellWidth: 22, halign: "right" },
      6: { cellWidth: 20, halign: "right" },
      7: { cellWidth: 16, halign: "center" },
    },
    margin: { left: 14, right: 14 },
    didParseCell(data) {
      if (data.section === "body" && data.column.index === 7) {
        const s = data.cell.raw as string;
        data.cell.styles.fontStyle = "bold";
        if (s === "Paid") data.cell.styles.textColor = GREEN;
        else if (s === "Partial") data.cell.styles.textColor = AMBER;
        else if (s === "Unpaid") data.cell.styles.textColor = RED;
      }
    },
  });

  // ── Summary footer ──
  const finalY =
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
      ?.finalY ?? 220;

  doc.setFillColor(10, 18, 40);
  doc.roundedRect(14, finalY + 6, 182, 26, 3, 3, "F");

  doc.setTextColor(148, 163, 184);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text("SUMMARY", 20, finalY + 13);

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");

  const col1x = 14, col2x = 65, col3x = 120;
  doc.text(`Orders: ${orders.length}`, col1x + 6, finalY + 20);
  doc.text(`Total Billed: Rs. ${totalBilled.toFixed(2)}`, col2x, finalY + 20);
  doc.text(`Paid: Rs. ${totalPaid.toFixed(2)}`, col3x, finalY + 20);

  const outstandingColor: [number, number, number] = balance > 0
    ? [248, 113, 113]
    : [52, 211, 153];
  doc.setTextColor(...outstandingColor);
  doc.setFont("helvetica", "bold");
  doc.text(
    `Outstanding: Rs. ${balance.toFixed(2)}`,
    col1x + 6,
    finalY + 27
  );

  return doc;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function exportToPDF(payload: ExportPayload) {
  const doc = buildPDF(payload);
  const name = payload.profile?.name ?? payload.ledger?.customerName ?? payload.phone;
  doc.save(`${name.replace(/\s+/g, "-")}-ledger.pdf`);
}

export function getPDFBlob(payload: ExportPayload): Blob {
  return buildPDF(payload).output("blob");
}

export function exportToExcel({ orders, profile, ledger, phone }: ExportPayload) {
  const name = profile?.name ?? ledger?.customerName ?? phone;
  const balance = ledger?.balanceDue ?? profile?.balanceDue ?? 0;
  const totalBilled = orders.reduce((s, o) => s + o.bills.totalWithTax, 0);
  const totalPaid = orders.reduce((s, o) => s + (o.amountPaid ?? 0), 0);
  const now = new Date().toLocaleDateString("en-IN");

  const rows = [
    ["Customer Ledger"],
    ["Customer:", name],
    ["Phone:", phone],
    ["Area:", profile?.preferredArea ?? "—"],
    ["Outstanding Balance:", `₹${balance.toFixed(2)}`],
    ["Generated:", now],
    [],
    ["Date", "Time", "Items", "Order Type", "Total (₹)", "Paid (₹)", "Due (₹)", "Status"],
    ...orders.map((o) => [
      fmtDate(o.orderDate),
      fmtTime(o.orderDate),
      itemsSummary(o, 200),
      o.orderType ?? "dine-in",
      Number(o.bills.totalWithTax.toFixed(2)),
      Number((o.amountPaid ?? 0).toFixed(2)),
      Number(((o.balanceDueOnOrder ?? 0) > 0 ? o.balanceDueOnOrder : 0).toFixed(2)),
      payStatus(o),
    ]),
    [],
    ["Summary"],
    ["Total Orders", orders.length],
    ["Total Billed", Number(totalBilled.toFixed(2))],
    ["Total Paid", Number(totalPaid.toFixed(2))],
    ["Outstanding", Number(balance.toFixed(2))],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [
    { wch: 16 }, { wch: 10 }, { wch: 50 }, { wch: 12 },
    { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Ledger");
  XLSX.writeFile(wb, `${name.replace(/\s+/g, "-")}-ledger.xlsx`);
}

export function shareViaWhatsAppText({
  orders,
  profile,
  ledger,
  phone,
}: ExportPayload) {
  const name = profile?.name ?? ledger?.customerName ?? phone;
  const balance = ledger?.balanceDue ?? profile?.balanceDue ?? 0;

  const orderLines = orders
    .slice(0, 10) // keep WhatsApp message reasonable
    .map((o, i) => {
      const status = payStatus(o);
      const due =
        (o.balanceDueOnOrder ?? 0) > 0
          ? ` | Due: ₹${o.balanceDueOnOrder.toFixed(0)}`
          : "";
      return (
        `${i + 1}. ${fmtDate(o.orderDate)} — ₹${o.bills.totalWithTax.toFixed(0)} (${status}${due})\n` +
        `   ${itemsSummary(o, 80)}`
      );
    })
    .join("\n");

  const more = orders.length > 10 ? `\n…and ${orders.length - 10} more orders` : "";

  const msg = [
    `*Customer Ledger — ${name}*`,
    `Phone: ${phone}`,
    ``,
    `*Orders (${orders.length}):*`,
    orderLines + more,
    ``,
    `*Outstanding Balance: ₹${balance.toFixed(2)}*`,
    ``,
    `_Generated on ${new Date().toLocaleDateString("en-IN")}_`,
  ].join("\n");

  window.open(
    `https://wa.me/${formatPhone(phone)}?text=${encodeURIComponent(msg)}`,
    "_blank"
  );
}

export async function shareViaNativeShare(payload: ExportPayload) {
  const name = payload.profile?.name ?? payload.ledger?.customerName ?? payload.phone;
  const blob = getPDFBlob(payload);
  const file = new File([blob], `${name.replace(/\s+/g, "-")}-ledger.pdf`, {
    type: "application/pdf",
  });

  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      title: `${name} — Customer Ledger`,
      text: `Ledger for ${name} (${payload.phone})`,
      files: [file],
    });
    return true;
  }
  return false; // caller falls back to WhatsApp text link
}
