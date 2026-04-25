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
});

export type Node = z.infer<typeof NodeSchema>;
export type Tree = z.infer<typeof TreeSchema>;
