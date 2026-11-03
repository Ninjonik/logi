import { validateEventDiscussion } from "../events/discussion"
import { defineClanSettingsSlice } from "./settings-slices"
import { z } from "zod"

export const discussionSettingsSchema = z.strictObject({
    createForumChannel: z.boolean().optional(),
    createDebriefThread: z.boolean().optional(),
    deleteForumAfterConclusion: z.boolean().optional(),
    debriefDestination: z
        .enum([
            "event_forum",
            "results_thread",
            "debrief_forum",
            "private_thread",
        ])
        .optional(),
    debriefForumChannelId: z
        .string()
        .regex(/^\d{17,20}$/)
        .optional(),
})
const gamesSchema = z.record(
    z.string().trim().min(1).max(64),
    discussionSettingsSchema
)
const schema = z.strictObject({
    defaults: discussionSettingsSchema,
    games: gamesSchema,
})
function record(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {}
}
export const eventDiscussionsSettingsSlice = defineClanSettingsSlice({
    key: "eventDiscussions",
    description:
        "Event discussion defaults and game overrides. Snapshot on creation; event fields override them. Debriefs use the retained match forum, a published result message thread, or a separate forum topic. Missing destination on existing events preserves legacy private debriefs.",
    schema,
    patchSchema: schema.partial(),
    read: ({ discordConfig }) => ({
        defaults: discussionSettingsSchema.parse(
            discordConfig?.eventDiscussionDefaults ?? {}
        ),
        games: gamesSchema.parse(
            Object.fromEntries(
                Object.entries(record(discordConfig?.gameOverrides)).flatMap(
                    ([game, value]) =>
                        record(value).eventDiscussionDefaults
                            ? [[game, record(value).eventDiscussionDefaults]]
                            : []
                )
            )
        ),
    }),
    verify: (patch, { discordConfig }) => {
        const defaults =
            patch.defaults ??
            discussionSettingsSchema.parse(
                discordConfig?.eventDiscussionDefaults ?? {}
            )
        try {
            validateEventDiscussion({
                createForumChannel: true,
                deleteForumAfterConclusion: true,
                ...defaults,
            })
            const storedGames = record(discordConfig?.gameOverrides)
            const games =
                patch.games ??
                Object.fromEntries(
                    Object.entries(storedGames).map(([game, value]) => [
                        game,
                        record(value).eventDiscussionDefaults,
                    ])
                )
            for (const override of Object.values(games))
                validateEventDiscussion({
                    createForumChannel: true,
                    deleteForumAfterConclusion: true,
                    ...defaults,
                    ...discussionSettingsSchema.parse(override ?? {}),
                })
            return null
        } catch (error) {
            return error instanceof Error
                ? error.message
                : "Invalid discussion settings"
        }
    },
    toPatch: (patch, { discordConfig }) => {
        const overrides = record(discordConfig?.gameOverrides)
        return {
            ...(patch.defaults !== undefined
                ? { eventDiscussionDefaults: patch.defaults }
                : {}),
            ...(patch.games !== undefined
                ? {
                      gameOverrides: Object.fromEntries(
                          [
                              ...new Set([
                                  ...Object.keys(overrides),
                                  ...Object.keys(patch.games),
                              ]),
                          ].map((game) => [
                              game,
                              {
                                  ...record(overrides[game]),
                                  eventDiscussionDefaults: patch.games?.[game],
                              },
                          ])
                      ),
                  }
                : {}),
        }
    },
})
