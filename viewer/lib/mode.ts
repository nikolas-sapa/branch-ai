export function isLocalViewer(): boolean {
  if (typeof window === "undefined") return true; // SSR — assume local; client will re-evaluate
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h.startsWith("192.168.") || h === "0.0.0.0";
}
