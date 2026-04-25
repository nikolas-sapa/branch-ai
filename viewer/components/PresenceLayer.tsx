"use client";
import { useEffect, useState } from "react";
import type { WebsocketProvider } from "y-websocket";
import { type PresenceUser, subscribePresence } from "@/lib/presence";

export function PresenceLayer({ provider }: { provider: WebsocketProvider }) {
  const [peers, setPeers] = useState<Map<number, PresenceUser>>(new Map());
  useEffect(() => subscribePresence(provider, setPeers), [provider]);

  return (
    <div className="pointer-events-none fixed inset-0 z-40">
      {[...peers.entries()].map(([id, p]) =>
        p.cursor ? (
          <div
            key={id}
            className="absolute transition-all duration-100"
            style={{ left: p.cursor.x, top: p.cursor.y }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20">
              <path d="M2,2 L18,10 L10,12 L8,18 Z" fill={p.color} />
            </svg>
            <div
              className="ml-3 mt-[-4px] inline-block px-1.5 py-0.5 rounded text-xs text-white shadow"
              style={{ backgroundColor: p.color }}
            >
              {p.name}
            </div>
          </div>
        ) : null
      )}
    </div>
  );
}
