import type { QueryCtx, MutationCtx } from "../../../convex/_generated/server"
import type { Doc } from "../../../convex/_generated/dataModel"
import { getGuildByDiscordId } from "../../../convex/identity"
import { sharedMatchMembers } from "./shared-match-store"

/** Partner badges are decorative; the destination clan keeps its main identity. */
export async function sharedMatchLogos(
    ctx: Pick<QueryCtx, "db">,
    event: Doc<"events">
) {
    if (
        event.sharedAccessRevoked ||
        (!event.hostEventId && event.sharedLocalPlayerIds === undefined)
    )
        return []
    const { events } = await sharedMatchMembers(ctx, event)
    const otherGuilds = [...new Set(events.map((item) => item.guildId))].filter(
        (id) => id !== event.guildId
    )
    const clans = await Promise.all(
        otherGuilds.map((id) => getGuildByDiscordId(ctx, id))
    )
    return clans.flatMap((clan) =>
        clan ? [{ name: clan.name, logoUrl: clan.avatar || null }] : []
    )
}

/** Partner membership changes must redraw every destination, even with no players yet. */
export async function refreshSharedMatchPresentation(
    ctx: Pick<MutationCtx, "db">,
    host: Doc<"events">,
    updatedAt: string
) {
    const { events } = await sharedMatchMembers(ctx, host)
    await Promise.all(
        events.map((event) => ctx.db.patch(event._id, { updatedAt }))
    )
}
