"use client";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

const COLORS = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];
const NAMES = ["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"];

export interface PresenceUser {
  name: string;
  color: string;
  cursor: { x: number; y: number } | null;
  selectedNodeId: string | null;
}

export function makeProvider(roomId: string) {
  const wsUrl = process.env.NEXT_PUBLIC_BRANCH_WS_URL ?? "ws://localhost:7433";
  const ydoc = new Y.Doc();
  const provider = new WebsocketProvider(wsUrl, `branch-${roomId}`, ydoc);
  const me: PresenceUser = {
    name: NAMES[Math.floor(Math.random() * NAMES.length)],
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    cursor: null,
    selectedNodeId: null,
  };
  provider.awareness.setLocalState(me);
  return { provider, ydoc, me };
}

export type AwarenessChange = (states: Map<number, PresenceUser>) => void;

export function subscribePresence(provider: WebsocketProvider, cb: AwarenessChange) {
  const handler = () => {
    const map = new Map<number, PresenceUser>();
    provider.awareness.getStates().forEach((state, clientId) => {
      if (clientId === provider.awareness.clientID) return; // skip self
      if (state) map.set(clientId, state as PresenceUser);
    });
    cb(map);
  };
  provider.awareness.on("change", handler);
  handler();
  return () => provider.awareness.off("change", handler);
}
