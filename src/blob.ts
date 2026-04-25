import { put } from "@vercel/blob";
import type { Tree } from "./tree.js";

const BLOB_PREFIX = "branch-sessions";

export async function uploadSession(tree: Tree): Promise<string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN not set. Get one from https://vercel.com/dashboard/stores (create a Blob store)."
    );
  }
  const path = `${BLOB_PREFIX}/${tree.sessionId}.json`;
  const body = JSON.stringify(tree, null, 2);
  const result = await put(path, body, {
    access: "public",
    token,
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return result.url;
}

export async function fetchSession(
  blobUrl: string,
  sessionId: string
): Promise<Tree | null> {
  // blobUrl is the base, e.g. https://abc123.public.blob.vercel-storage.com
  const url = `${blobUrl.replace(/\/$/, "")}/${BLOB_PREFIX}/${sessionId}.json`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as Tree;
  } catch {
    return null;
  }
}
