import { getDb } from "../db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toApi(row: any) {
  if (!row) return null;
  const { id, created_at, updated_at, ...rest } = row;
  return {
    _id: String(id),
    ...rest,
    createdAt: created_at,
    updatedAt: updated_at,
  };
}

export function findByEmail(email: string) {
  const row = getDb()
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email);
  return toApi(row);
}

export function findById(id: string | number) {
  const row = getDb()
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(Number(id));
  return toApi(row);
}

export function findByIdWithoutPassword(id: string | number) {
  const row = getDb()
    .prepare("SELECT id, name, email, phone, role, created_at, updated_at FROM users WHERE id = ?")
    .get(Number(id));
  return toApi(row);
}

export function create(data: {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: string;
}) {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO users (name, email, phone, password, role)
       VALUES (@name, @email, @phone, @password, @role)`
    )
    .run(data);
  return findById(result.lastInsertRowid as number)!;
}
