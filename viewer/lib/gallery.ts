export interface GalleryEntry {
  sessionId: string;
  title: string;
  description: string;
  category: "engineering" | "strategy" | "creative" | "philosophy";
  author?: string;
}

// Hardcoded curated examples. Replace with dynamic fetch later.
export const GALLERY: GalleryEntry[] = [
  {
    sessionId: "MYxMPun8wl",
    title: "Should a startup focus on growth or profitability?",
    description: "Six-month runway, $100k left. Reasoning through default-alive, fundraising timing, and growth tactics.",
    category: "strategy",
    author: "branch-ai team",
  },
  {
    sessionId: "HtMKdRWb-d",
    title: "Rails monolith: rewrite, microservices, or fix the actual bottleneck?",
    description: "CTO at a 20-person startup with rising performance complaints. Reasoning through engineer preferences vs real diagnosis.",
    category: "engineering",
    author: "branch-ai team",
  },
];
