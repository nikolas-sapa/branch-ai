"use client";
import { useEffect, useState } from "react";
import type { WebsocketProvider } from "y-websocket";
import { type PresenceUser, subscribePresence } from "@/lib/presence";

export function PeopleIndicator({ provider, me }: { provider: WebsocketProvider; me: PresenceUser }) {
  const [peers, setPeers] = useState<Map<number, PresenceUser>>(new Map());
  useEffect(() => subscribePresence(provider, setPeers), [provider]);
  const all = [me, ...peers.values()];
  return (
    <div className="flex -space-x-1.5">
      {all.map((p, i) => (
        <div
          key={i}
          title={p.name}
          className="w-6 h-6 rounded-full border-2 border-white text-[10px] font-medium text-white flex items-center justify-center shadow-sm"
          style={{ backgroundColor: p.color }}
        >
          {p.name[0]}
        </div>
      ))}
    </div>
  );
}
