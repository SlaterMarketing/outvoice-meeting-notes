import { getSession } from "@/lib/session";
import { getUserIdFromExtensionToken } from "@/lib/extension-auth";

export async function resolveWebOrExtensionUserId(req: Request) {
  const session = await getSession();
  if (session) return session.sub;
  const ext = await getUserIdFromExtensionToken(req.headers.get("authorization"));
  return ext;
}
