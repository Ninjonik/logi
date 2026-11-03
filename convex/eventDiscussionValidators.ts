import { v } from "convex/values"
export const debriefDestinationValidator = v.union(
    v.literal("event_forum"),
    v.literal("results_thread"),
    v.literal("debrief_forum"),
    v.literal("private_thread")
)
export const eventDiscussionDefaultsValidator = v.object({
    createForumChannel: v.optional(v.boolean()),
    createDebriefThread: v.optional(v.boolean()),
    deleteForumAfterConclusion: v.optional(v.boolean()),
    debriefDestination: v.optional(debriefDestinationValidator),
    debriefForumChannelId: v.optional(v.string()),
})
