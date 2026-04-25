#!/usr/bin/env node
import { WebSocketServer } from "ws";
import { setupWSConnection } from "y-websocket/bin/utils";

const PORT = parseInt(process.env.BRANCH_WS_PORT ?? "7433", 10);
const wss = new WebSocketServer({ port: PORT });
wss.on("connection", (conn, req) => setupWSConnection(conn, req));
console.log(`Branch presence ws server on :${PORT}`);
