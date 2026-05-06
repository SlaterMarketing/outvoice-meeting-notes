import { db } from "@/db";
import { extensionTokens } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sha256Hex } from "./crypto";

export async function getUserIdFromExtensionToken(header: string | null) {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;
  const hash = sha256Hex(token);
  const rows = await db
    .select()
    .from(extensionTokens)
    .where(eq(extensionTokens.tokenHash, hash))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  await db
    .update(extensionTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(extensionTokens.id, row.id));
  return row.userId;
}
