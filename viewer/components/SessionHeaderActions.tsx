"use client";
import { useState } from "react";

interface Props {
  sessionId: string;
  initialPinned: boolean;
  initialTags: string[];
}

export function SessionHeaderActions({ sessionId, initialPinned, initialTags }: Props) {
  const [pinned, setPinned] = useState(initialPinned);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [tagInput, setTagInput] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);
  const [saving, setSaving] = useState(false);

  async function togglePin() {
    setSaving(true);
    try {
      const res = await fetch("/api/tag", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, pinned: !pinned }),
      });
      if (res.ok) setPinned((p) => !p);
    } finally {
      setSaving(false);
    }
  }

  async function addTag(e: React.FormEvent) {
    e.preventDefault();
    const newTag = tagInput.trim();
    if (!newTag) return;
    setSaving(true);
    try {
      const res = await fetch("/api/tag", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, tags: [newTag] }),
      });
      if (res.ok) {
        const data = await res.json();
        setTags(data.tags ?? [...tags, newTag]);
        setTagInput("");
        setShowTagInput(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function removeTag(tag: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/tag", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, tag }),
      });
      if (res.ok) {
        const data = await res.json();
        setTags(data.tags ?? tags.filter((t) => t !== tag));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* Tag chips (interactive) */}
      {tags.map((tag) => (
        <span
          key={tag}
          className="group flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 text-xs border border-neutral-200"
        >
          {tag}
          <button
            onClick={() => removeTag(tag)}
            disabled={saving}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-neutral-400 hover:text-neutral-700 leading-none"
            aria-label={`Remove tag ${tag}`}
          >
            ×
          </button>
        </span>
      ))}

      {/* Add tag */}
      {showTagInput ? (
        <form onSubmit={addTag} className="flex items-center gap-1">
          <input
            autoFocus
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder="tag name"
            className="border border-neutral-300 rounded px-2 py-0.5 text-xs w-24 focus:outline-none focus:ring-1 focus:ring-neutral-300"
            onBlur={() => { if (!tagInput.trim()) setShowTagInput(false); }}
          />
          <button type="submit" disabled={saving} className="text-xs text-neutral-500 hover:text-neutral-900">
            Add
          </button>
        </form>
      ) : (
        <button
          onClick={() => setShowTagInput(true)}
          className="text-xs text-neutral-400 hover:text-neutral-700 transition-colors border border-dashed border-neutral-300 px-2 py-0.5 rounded-full"
          aria-label="Add tag"
        >
          + tag
        </button>
      )}

      {/* Pin star */}
      <button
        onClick={togglePin}
        disabled={saving}
        title={pinned ? "Unpin session" : "Pin session"}
        className={`text-lg leading-none transition-colors ${pinned ? "text-yellow-400 hover:text-yellow-500" : "text-neutral-300 hover:text-yellow-400"}`}
        aria-label={pinned ? "Unpin" : "Pin"}
      >
        ★
      </button>
    </div>
  );
}
