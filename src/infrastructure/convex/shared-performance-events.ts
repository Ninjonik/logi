import type { QueryCtx } from "../../../convex/_generated/server"
import type { Doc } from "../../../convex/_generated/dataModel"
import { sharedMatchPatch } from "./shared-match-store"

/** One local history entry per canonical match, with current host facts. */
export async function performanceEvents(
    ctx: Pick<QueryCtx, "db">,
    guildId: string
) {
    const records = await ctx.db
        .query("events")
        .withIndex("guildId", (q) => q.eq("guildId", guildId))
        .collect()
    const events = new Map<string, Doc<"events">>()
    for (const local of records) {
        if (local.sharedAccessRevoked) continue
        if (!local.hostEventId) {
            events.set(String(local._id), local)
            continue
        }
        const hostId = local.hostEventId
        const invitation = await ctx.db
            .query("sharedMatchInvitations")
            .withIndex("hostEventId", (q) => q.eq("hostEventId", hostId))
            .collect()
        if (
            !invitation.some(
                (item) =>
                    item.status === "accepted" &&
                    item.localEventId === local._id &&
                    item.guestGuildId === guildId
            )
        )
            continue
        const host = await ctx.db.get(hostId)
        if (
            !host ||
            host.hostEventId ||
            !invitation.some(
                (item) =>
                    item.status === "accepted" &&
                    item.localEventId === local._id &&
                    item.hostGuildId === host.guildId
            )
        )
            continue
        events.set(String(host._id), { ...local, ...sharedMatchPatch(host) })
    }
    return [...events.values()]
}

export const performanceSourceId = (
    event: Pick<Doc<"events">, "_id" | "hostEventId">
) => event.hostEventId ?? event._id
