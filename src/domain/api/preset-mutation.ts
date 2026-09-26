import { z } from "zod"

import { topicPresetSchema } from "@/lib/validation/topic-preset"
import { squadPresetSchema } from "@/lib/validation/squad-preset"

const gameId = z.enum(["hell_let_loose", "hell_let_loose_vietnam", "wardogs"])

export const stratmapMutationSchema = z.object({
    gameId: gameId.optional(),
    title: z.string().trim().min(1, "Stratmap title is required."),
    description: z.string().trim().optional(),
    baseMapId: z.string().trim().min(1, "Base map is required."),
    side: z.string().trim().optional(),
    strongpointId: z.string().trim().optional(),
    eventId: z.string().trim().optional(),
    state: z.string().optional(),
})

export const presetMutationSchemas = {
    stratmaps: stratmapMutationSchema,
    "topic-presets": topicPresetSchema,
    "squad-presets": squadPresetSchema,
}

export function parsePresetMutation(
    resource: keyof typeof presetMutationSchemas,
    value: unknown
) {
    return presetMutationSchemas[resource].safeParse(value)
}
