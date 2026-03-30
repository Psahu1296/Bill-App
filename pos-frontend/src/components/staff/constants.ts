import type { StaffRole } from "../../types";

export const ROLE_CONFIG: Record<StaffRole, { label: string; emoji: string; color: string }> = {
  cook:     { label: "Cook",     emoji: "👨‍🍳", color: "text-dhaba-orange"  },
  supplier: { label: "Supplier", emoji: "🚚",  color: "text-dhaba-info"    },
  owner:    { label: "Owner",    emoji: "👑",  color: "text-dhaba-accent"  },
  manager:  { label: "Manager",  emoji: "📋",  color: "text-dhaba-success" },
  delivery: { label: "Delivery", emoji: "🏍️", color: "text-dhaba-warning" },
  other:    { label: "Other",    emoji: "👤",  color: "text-dhaba-muted"   },
};

export const ROLES: StaffRole[] = ["cook", "supplier", "owner", "manager", "delivery", "other"];
