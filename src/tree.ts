import { z } from "zod";

export const NodeSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    id: z.string(),
    content: z.string(),
    children: z.array(NodeSchema),
    metadata: z
      .object({
        kind: z.enum(["root", "heading", "paragraph", "option", "bullet"]),
        forkedFrom: z.string().optional(),
        injectedFact: z.string().optional(),
      })
      .optional(),
  })
);

export const DecisionSchema = z.object({
  conclusion: z.string(),
  rejected: z.array(z.string()).default([]),
  confidence: z.enum(["low", "medium", "high"]),
  revisitIf: z.string(),
  decidedAt: z.string(),
});

export const TreeSchema = z.object({
  sessionId: z.string(),
  prompt: z.string(),
  model: z.string(),
  createdAt: z.string(),
  root: NodeSchema,
  finalText: z.string(),
  tags: z.array(z.string()).default([]).optional(),
  pinned: z.boolean().default(false).optional(),
  incomplete: z.boolean().default(false).optional(),
  decision: DecisionSchema.optional(),
});

export type Node = z.infer<typeof NodeSchema>;
export type Tree = z.infer<typeof TreeSchema>;
export type Decision = z.infer<typeof DecisionSchema>;
