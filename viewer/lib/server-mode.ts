import { headers } from "next/headers";

export async function isLocalRequest(): Promise<boolean> {
  // Honor explicit env override first
  if (process.env.BRANCH_ALLOW_HOSTED_EDITS === "1") return true;
  const h = await headers();
  const host = h.get("host") ?? "";
  return (
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("192.168.") ||
    host.startsWith("0.0.0.0")
  );
}
