#!/usr/bin/env node
import { WebSocketServer } from "ws";
import { setupWSConnection } from "@y/websocket-server/utils";

const PORT = parseInt(process.env.BRANCH_WS_PORT ?? "7433", 10);
const wss = new WebSocketServer({
  port: PORT,
  host: "127.0.0.1",
  verifyClient: ({ origin }) => {
    if (!origin) return true; // Local non-browser clients.
    try {
      const url = new URL(origin);
      return (url.protocol === "http:" || url.protocol === "https:") &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    } catch {
      return false;
    }
  },
});
wss.on("connection", (conn, req) => setupWSConnection(conn, req));
wss.on("listening", () => console.log(`Branch presence ws server on 127.0.0.1:${PORT}`));
