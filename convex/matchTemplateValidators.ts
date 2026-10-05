import { v } from "convex/values"

/**
 * A clan's match or training template (design D1). It only pre-fills the
 * dashboard create form; stored events never read it.
 */
export const matchTemplateValidator = v.object({
    id: v.string(),
    name: v.string(),
    kind: v.union(v.literal("match"), v.literal("training")),
    gameId: v.optional(
        v.union(
            v.literal("hell_let_loose"),
            v.literal("hell_let_loose_vietnam"),
            v.literal("wardogs")
        )
    ),
    categoryId: v.optional(v.string()),
    announcementHoursBeforeStart: v.optional(v.number()),
    registrationHoursBeforeMeeting: v.number(),
    meetingMinutesBeforeStart: v.number(),
    durationMinutes: v.number(),
    allowedSignupStatuses: v.array(
        v.union(
            v.literal("member"),
            v.literal("recruit"),
            v.literal("reserve_member"),
            v.literal("mercenary")
        )
    ),
    signupGroupIds: v.optional(v.array(v.string())),
    useGeneralSignup: v.boolean(),
    signupReminderStatuses: v.array(
        v.union(
            v.literal("member"),
            v.literal("recruit"),
            v.literal("reserve_member")
        )
    ),
    pingMode: v.union(v.literal("none"), v.literal("clan"), v.literal("roles")),
    pingRoleIds: v.array(v.string()),
    createForumChannel: v.boolean(),
    createSquadVoiceChannels: v.boolean(),
    topicPresetId: v.optional(v.string()),
})
