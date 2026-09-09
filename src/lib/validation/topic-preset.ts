import { z } from "zod"

import { DISCORD_MESSAGE_MAX_ATTACHMENTS } from "@/domain/discord-sync/attachment-limits"

const urlSchema = z.string().trim().url("Attachment must be a valid URL.")

export const topicSchema = z.object({
    id: z.string().optional(),
    title: z.string().trim().min(1, "Topic title is required."),
    body: z.string().trim().optional(),
    attachments: z
        .array(urlSchema)
        .max(
            DISCORD_MESSAGE_MAX_ATTACHMENTS,
            `A Discord message can have at most ${DISCORD_MESSAGE_MAX_ATTACHMENTS} attachments.`
        ),
    messages: z
        .array(
            z
                .object({
                    id: z.string(),
                    body: z.string().trim().optional(),
                    attachments: z
                        .array(urlSchema)
                        .max(
                            DISCORD_MESSAGE_MAX_ATTACHMENTS,
                            `A Discord message can have at most ${DISCORD_MESSAGE_MAX_ATTACHMENTS} attachments.`
                        ),
                })
                .refine(
                    (message) =>
                        Boolean(
                            message.body?.trim() || message.attachments.length
                        ),
                    "A Discord message needs text or an attachment."
                )
        )
        .optional(),
})

export const topicPresetSchema = z.object({
    name: z.string().trim().min(1, "Preset name is required."),
    side: z.string().trim().optional(),
    map: z.string().trim().optional(),
    cap: z.string().trim().optional(),
    notes: z.string().trim().optional(),
    topics: z.array(topicSchema).min(1, "Add at least one topic."),
})

export type TopicPresetInput = z.infer<typeof topicPresetSchema>
