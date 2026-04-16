export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export function fmtScheduled(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export const DISH_STATUSES = ["pending", "noted", "added", "rejected"] as const;
export const PREORDER_STATUSES = ["pending", "confirmed", "cancelled", "completed"] as const;

export const dishStatusCfg: Record<string, { badge: string; label: string }> = {
  pending:  { badge: "bg-dhaba-warning/15 text-dhaba-warning border border-dhaba-warning/20",   label: "Pending" },
  noted:    { badge: "bg-blue-500/15 text-blue-400 border border-blue-500/20",                 label: "Noted" },
  added:    { badge: "bg-dhaba-success/15 text-dhaba-success border border-dhaba-success/20",  label: "Added" },
  rejected: { badge: "bg-dhaba-danger/15 text-dhaba-danger border border-dhaba-danger/20",     label: "Rejected" },
};

export const preOrderStatusCfg: Record<string, { badge: string; label: string; border: string }> = {
  pending:   { badge: "bg-dhaba-warning/15 text-dhaba-warning border border-dhaba-warning/20",   label: "Pending",   border: "border-l-dhaba-warning" },
  confirmed: { badge: "bg-dhaba-success/15 text-dhaba-success border border-dhaba-success/20",  label: "Confirmed", border: "border-l-dhaba-success" },
  cancelled: { badge: "bg-dhaba-danger/15 text-dhaba-danger border border-dhaba-danger/20",     label: "Cancelled", border: "border-l-dhaba-danger" },
  completed: { badge: "bg-blue-500/15 text-blue-400 border border-blue-500/20",                 label: "Completed", border: "border-l-dhaba-muted" },
};
