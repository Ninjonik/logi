import { z } from "zod";

const urlSchema = z.string().trim().url("Attachment must be a valid URL.");

export const topicSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, "Topic title is required."),
  body: z.string().trim().optional(),
  attachments: z.array(urlSchema),
});

export const topicPresetSchema = z.object({
  name: z.string().trim().min(1, "Preset name is required."),
  side: z.string().trim().optional(),
  map: z.string().trim().optional(),
  cap: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  topics: z.array(topicSchema).min(1, "Add at least one topic."),
});

export type TopicPresetInput = z.infer<typeof topicPresetSchema>;
