import type { EventDiscordDeletion } from "../src/domain/events/deletion"
import type { MutationCtx } from "./_generated/server"

/** Separate from the delete workflow so hot bot sync modules import no broad graph. */
export async function queueEventDiscordDeletion(
    ctx: MutationCtx,
    eventId: string,
    resources: EventDiscordDeletion
) {
    const id = ctx.db.normalizeId("events", eventId)
    const receipts = id
        ? await ctx.db
              .query("discordEventResources")
              .withIndex("eventId_key", (q) => q.eq("eventId", id))
              .collect()
        : []
    // A create receipt may have committed before the outer sync saved its IDs.
    resources = {
        ...resources,
        channelIds: [
            ...new Set([
                ...resources.channelIds,
                ...receipts
                    .filter(
                        (row) =>
                            row.guildId === resources.guildId &&
                            row.state === "bound" &&
                            row.key !== "scheduled-event" &&
                            row.resourceId
                    )
                    .map((row) => row.resourceId!),
            ]),
        ],
        scheduledEventIds: [
            ...new Set([
                ...resources.scheduledEventIds,
                ...receipts
                    .filter(
                        (row) =>
                            row.guildId === resources.guildId &&
                            row.state === "bound" &&
                            row.key === "scheduled-event" &&
                            row.resourceId
                    )
                    .map((row) => row.resourceId!),
            ]),
        ],
    }
    if (
        !resources.messages.length &&
        !resources.channelIds.length &&
        !resources.roleIds.length &&
        !resources.scheduledEventIds.length
    )
        return false
    const now = new Date().toISOString()
    await ctx.db.insert("eventDeletionRequests", {
        ...resources,
        eventId,
        status: "pending",
        attempts: 0,
        nextAttemptAt: now,
        createdAt: now,
    })
    return true
}
