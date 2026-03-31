import { getDb } from "../db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToApi(row: any) {
  if (!row) return null;
  const { id, number_of_orders, is_available, is_frequent, is_online_available, created_at, updated_at, variants, ...rest } = row;
  return {
    _id: String(id),
    numberOfOrders: number_of_orders,
    isAvailable: Boolean(is_available),
    isFrequent: Boolean(is_frequent),
    isOnlineAvailable: Boolean(is_online_available),
    variants: variants ? JSON.parse(variants) : [],
    createdAt: created_at,
    updatedAt: updated_at,
    ...rest,
  };
}

export function findByName(name: string) {
  return rowToApi(getDb().prepare("SELECT * FROM dishes WHERE name = ?").get(name));
}

export function findById(id: string | number) {
  return rowToApi(getDb().prepare("SELECT * FROM dishes WHERE id = ?").get(Number(id)));
}

export function findAll() {
  return getDb().prepare("SELECT * FROM dishes ORDER BY name ASC").all().map(rowToApi);
}

export function findOnlineAvailable() {
  return getDb()
    .prepare("SELECT * FROM dishes WHERE is_online_available = 1 AND is_available = 1 ORDER BY name ASC")
    .all()
    .map(rowToApi);
}

export function findFrequent(minOrders: number, limit: number) {
  return getDb()
    .prepare("SELECT * FROM dishes WHERE number_of_orders >= ? ORDER BY number_of_orders DESC, name ASC LIMIT ?")
    .all(minOrders, limit)
    .map(rowToApi);
}

export function create(data: {
  image: string; name: string; type: string; category: string;
  variants: object[]; description?: string; isAvailable?: boolean; isFrequent?: boolean; isOnlineAvailable?: boolean;
}) {
  const db = getDb();
  const result = db.prepare(
    `INSERT INTO dishes (image, name, type, category, variants, description, is_available, is_frequent, is_online_available)
     VALUES (@image, @name, @type, @category, @variants, @description, @isAvailable, @isFrequent, @isOnlineAvailable)`
  ).run({
    ...data,
    variants: JSON.stringify(data.variants),
    description: data.description ?? '',
    isAvailable: data.isAvailable !== false ? 1 : 0,
    isFrequent: data.isFrequent ? 1 : 0,
    isOnlineAvailable: data.isOnlineAvailable ? 1 : 0,
  });
  return findById(result.lastInsertRowid as number)!;
}

export function bulkCreate(dishes: Parameters<typeof create>[0][]) {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO dishes (image, name, type, category, variants, description, is_available, is_frequent, is_online_available)
     VALUES (@image, @name, @type, @category, @variants, @description, @isAvailable, @isFrequent, @isOnlineAvailable)`
  );
  const insertMany = db.transaction((list: typeof dishes) => {
    const saved = [];
    for (const d of list) {
      const result = stmt.run({
        ...d,
        variants: JSON.stringify(d.variants),
        description: d.description ?? '',
        isAvailable: d.isAvailable !== false ? 1 : 0,
        isFrequent: d.isFrequent ? 1 : 0,
        isOnlineAvailable: (d as { isOnlineAvailable?: boolean }).isOnlineAvailable ? 1 : 0,
      });
      saved.push(findById(result.lastInsertRowid as number)!);
    }
    return saved;
  });
  return insertMany(dishes);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function update(id: string | number, updates: Record<string, any>) {
  const db = getDb();
  const allowed = ["image", "name", "type", "category", "variants", "description", "isAvailable", "isFrequent", "isOnlineAvailable", "numberOfOrders"];
  const sets: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params: Record<string, any> = { id: Number(id) };

  for (const key of allowed) {
    if (key in updates) {
      const col = key === "isAvailable" ? "is_available"
                : key === "isFrequent"  ? "is_frequent"
                : key === "isOnlineAvailable" ? "is_online_available"
                : key === "numberOfOrders" ? "number_of_orders"
                : key;
      sets.push(`${col} = @${key}`);
      if (key === "variants") params[key] = JSON.stringify(updates[key]);
      else if (key === "isAvailable" || key === "isFrequent" || key === "isOnlineAvailable") params[key] = updates[key] ? 1 : 0;
      else params[key] = updates[key];
    }
  }

  if (sets.length === 0) return findById(id);
  sets.push("updated_at = datetime('now')");
  db.prepare(`UPDATE dishes SET ${sets.join(", ")} WHERE id = @id`).run(params);
  return findById(id);
}

export function remove(id: string | number) {
  const dish = findById(id);
  getDb().prepare("DELETE FROM dishes WHERE id = ?").run(Number(id));
  return dish;
}

export function incrementOrderCounts(items: { id: string | number; quantity: number }[]) {
  const db = getDb();
  const stmt = db.prepare("UPDATE dishes SET number_of_orders = number_of_orders + ? WHERE id = ?");
  const runAll = db.transaction((list: typeof items) => {
    for (const item of list) stmt.run(item.quantity, Number(item.id));
  });
  runAll(items);
}
