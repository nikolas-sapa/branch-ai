"use client";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { ReactFlow, Background, Controls, useReactFlow, type Node as RFNode, type Edge as RFEdge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { NodeCard } from "./NodeCard";
import { NodeDialog } from "./NodeDialog";
import { NodePreview } from "./NodePreview";
import { PresenceLayer } from "./PresenceLayer";
import { PeopleIndicator } from "./PeopleIndicator";
import { layoutTree } from "@/lib/layout";
import { makeProvider } from "@/lib/presence";
import { isLocalViewer } from "@/lib/mode";

const nodeTypes = { card: NodeCard };

interface RawNode {
  id: string;
  content: string;
  children: RawNode[];
}

interface Toast {
  id: number;
  message: string;
}

function ToastBanner({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="bg-neutral-900 text-white text-xs px-4 py-2.5 rounded-lg shadow-lg animate-fade-in"
          style={{ animation: "toastIn 0.18s cubic-bezier(0.34,1.56,0.64,1) both" }}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

function TreeCanvasInner({
  root,
  sessionId,
  pendingFocusNodeId,
  onFocusConsumed,
}: {
  root: RawNode;
  sessionId: string;
  pendingFocusNodeId: string | null;
  onFocusConsumed: () => void;
}) {
  const { setCenter, getNodes } = useReactFlow();

  useEffect(() => {
    if (!pendingFocusNodeId) return;
    // Wait one frame for ReactFlow to lay out the new node
    const raf = requestAnimationFrame(() => {
      const rfNodes = getNodes();
      const target = rfNodes.find((n) => n.id === pendingFocusNodeId);
      if (target && target.position) {
        const x = target.position.x + (target.measured?.width ?? 280) / 2;
        const y = target.position.y + (target.measured?.height ?? 80) / 2;
        setCenter(x, y, { zoom: 1, duration: 600 });
      }
      onFocusConsumed();
    });
    return () => cancelAnimationFrame(raf);
  }, [pendingFocusNodeId, getNodes, setCenter, onFocusConsumed]);

  return null;
}

export function TreeCanvas({ root, sessionId }: { root: RawNode; sessionId: string }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [previewNode, setPreviewNode] = useState<{ id: string; content: string } | null>(null);
  const [dialogState, setDialogState] = useState<{ nodeId: string; mode: "fork" | "inject" } | null>(null);
  const [pendingFocusNodeId, setPendingFocusNodeId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [local, setLocal] = useState(true);
  const toastCounter = useRef(0);
  const providerRef = useRef<ReturnType<typeof makeProvider> | null>(null);
  const [, forceUpdate] = useState(0);

  useEffect(() => { setLocal(isLocalViewer()); }, []);

  const showToast = useCallback((message: string) => {
    const id = ++toastCounter.current;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2200);
  }, []);

  useEffect(() => {
    if (!isLocalViewer()) return; // skip presence in hosted mode
    providerRef.current = makeProvider(sessionId);
    forceUpdate((n) => n + 1);

    const onMove = (e: MouseEvent) => {
      const p = providerRef.current;
      if (!p) return;
      p.provider.awareness.setLocalState({ ...p.me, cursor: { x: e.clientX, y: e.clientY } });
    };
    window.addEventListener("mousemove", onMove);

    return () => {
      window.removeEventListener("mousemove", onMove);
      providerRef.current?.provider.destroy();
      providerRef.current = null;
    };
  }, [sessionId]);

  const { nodes, edges } = useMemo(() => {
    function filter(n: RawNode): RawNode {
      if (collapsed.has(n.id)) return { ...n, children: [] };
      return { ...n, children: n.children.map(filter) };
    }
    const filtered = filter(root);
    const { nodes: baseNodes, edges: baseEdges } = layoutTree(filtered);

    const origChildCount = new Map<string, number>();
    (function walk(n: RawNode) {
      origChildCount.set(n.id, n.children.length);
      n.children.forEach(walk);
    })(root);

    const enhancedNodes = baseNodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        hasChildren: (origChildCount.get(n.id) ?? 0) > 0,
        collapsed: collapsed.has(n.id),
        onToggle: () => {
          setCollapsed((prev) => {
            const next = new Set(prev);
            if (next.has(n.id)) next.delete(n.id); else next.add(n.id);
            return next;
          });
        },
      },
    }));
    return { nodes: enhancedNodes, edges: baseEdges };
  }, [root, collapsed]);

  const p = providerRef.current;

  // Find full content of a node by walking the raw tree
  const findNode = useCallback((id: string): RawNode | null => {
    function walk(n: RawNode): RawNode | null {
      if (n.id === id) return n;
      for (const c of n.children) { const f = walk(c); if (f) return f; }
      return null;
    }
    return walk(root);
  }, [root]);

  function handleNodeClick(_: React.MouseEvent, n: { id: string }) {
    const found = findNode(n.id);
    if (found) setPreviewNode({ id: n.id, content: found.content });
    if (p) p.provider.awareness.setLocalState({ ...p.me, selectedNodeId: n.id });
  }

  function handleForkFromPreview() {
    if (!previewNode) return;
    setDialogState({ nodeId: previewNode.id, mode: "fork" });
    setPreviewNode(null);
  }

  function handleInjectFromPreview() {
    if (!previewNode) return;
    setDialogState({ nodeId: previewNode.id, mode: "inject" });
    setPreviewNode(null);
  }

  function handleDialogSuccess(newNodeId: string, label: string) {
    setPendingFocusNodeId(newNodeId);
    showToast(label);
  }

  return (
    <>
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)     scale(1); }
        }
      `}</style>

      <div className="h-[calc(100vh-56px)] w-full relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          onNodeClick={(e, n) => handleNodeClick(e as unknown as React.MouseEvent, n)}
        >
          <Background gap={24} size={1} />
          <Controls />
          <TreeCanvasInner
            root={root}
            sessionId={sessionId}
            pendingFocusNodeId={pendingFocusNodeId}
            onFocusConsumed={() => setPendingFocusNodeId(null)}
          />
        </ReactFlow>

        {previewNode && (
          <NodePreview
            content={previewNode.content}
            onFork={handleForkFromPreview}
            onInject={handleInjectFromPreview}
            onClose={() => setPreviewNode(null)}
          />
        )}

        {dialogState && (
          <NodeDialog
            sessionId={sessionId}
            nodeId={dialogState.nodeId}
            initialMode={dialogState.mode}
            onClose={() => setDialogState(null)}
            onSuccess={handleDialogSuccess}
          />
        )}

        {local && p && <PresenceLayer provider={p.provider} />}

        {local && p && (
          <div className="absolute top-3 right-3 z-50 bg-white/90 backdrop-blur rounded-full px-2 py-1 shadow-sm border border-neutral-200">
            <PeopleIndicator provider={p.provider} me={p.me} />
          </div>
        )}
      </div>

      <ToastBanner toasts={toasts} />
    </>
  );
}
