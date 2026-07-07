import { z } from "zod";

export const groupSchema = z.object({
  name: z.string().trim().min(1, "Group name is required."),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Pick a valid color."),
  order: z.coerce.number().int().default(0),
  parentId: z.string().optional(),
  description: z.string().trim().optional(),
});

export type GroupInput = z.infer<typeof groupSchema>;
