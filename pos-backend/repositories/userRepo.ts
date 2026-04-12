import { User } from "../models";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toApi(doc: any) {
  if (!doc) return null;
  return {
    _id: String(doc._id),
    name: doc.name,
    email: doc.email,
    phone: doc.phone ?? "",
    password: doc.password,
    role: doc.role,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function findByEmail(email: string) {
  const doc = await User.findOne({ email }).lean();
  return toApi(doc);
}

export async function findById(id: string) {
  try {
    const doc = await User.findById(id).lean();
    return toApi(doc);
  } catch { return null; }
}

export async function findByIdWithoutPassword(id: string) {
  try {
    const doc = await User.findById(id).select("-password").lean();
    return toApi(doc);
  } catch { return null; }
}

export async function create(data: {
  name: string; email: string; phone: string; password: string; role: string;
}) {
  const doc = await User.create(data);
  return toApi(doc.toObject())!;
}
