import { headers } from "next/headers";

function isLoopbackHost(host: string): boolean {
  return /^(?:localhost|127\.0\.0\.1|\[::1\])(?::[0-9]{1,5})?$/i.test(host);
}

export async function isLocalRequest(): Promise<boolean> {
  const h = await headers();
  return isLoopbackHost(h.get("host") ?? "");
}

export async function isLocalMutation(req: Request): Promise<boolean> {
  if (!(await isLocalRequest()) && process.env.BRANCH_ALLOW_HOSTED_EDITS !== "1") return false;
  if (req.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(req.url).origin) return false;
    } catch {
      return false;
    }
  }
  return true;
}
