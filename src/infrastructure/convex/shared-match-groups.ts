import {
    sharedGroupPresentation,
    sharedSignupLimits,
} from "../../domain/events/shared-match"
import type { QueryCtx } from "../../../convex/_generated/server"
import type { Doc } from "../../../convex/_generated/dataModel"
import { resolveGameScope } from "../../domain/games/game"

/** Event-specific catalogue: never add foreign groups to local membership settings. */
export async function sharedMatchGroups(
    ctx: Pick<QueryCtx, "db">,
    event: Doc<"events">
) {
    const host = event.hostEventId ? await ctx.db.get(event.hostEventId) : event
    if (!host) return []
    const groups = await ctx.db
        .query("groups")
        .withIndex("guildId", (q) => q.eq("guildId", host.guildId))
        .collect()
    return groups
        .filter(
            (group) =>
                resolveGameScope(group.gameId) ===
                resolveGameScope(event.gameId)
        )
        .map((group) =>
            event.hostEventId ? sharedGroupPresentation(group) : group
        )
}

export async function sharedInvitationGroups(
    ctx: Pick<QueryCtx, "db">,
    event: Doc<"events">
) {
    const groups = await sharedMatchGroups(ctx, event)
    const hostEventId = event.hostEventId
    if (!hostEventId)
        return groups.map((group) => ({ groupId: String(group._id) }))
    const invitation = await ctx.db
        .query("sharedMatchInvitations")
        .withIndex("host_guest", (q) =>
            q.eq("hostEventId", hostEventId).eq("guestGuildId", event.guildId)
        )
        .unique()
    if (
        !invitation ||
        invitation.status !== "accepted" ||
        invitation.localEventId !== event._id
    )
        throw new Error("Your clan is no longer participating in this match.")
    // Old invitations inherit the host's offered groups without inventing IDs.
    const host = await ctx.db.get(hostEventId)
    return (
        invitation.signupGroups ??
        groups
            .filter(
                (group) =>
                    !host?.signupGroupIds ||
                    host.signupGroupIds.includes(String(group._id))
            )
            .map((group) => ({ groupId: String(group._id) }))
    )
}

export async function sharedGroupProjection(
    ctx: Pick<QueryCtx, "db">,
    event: Doc<"events">
) {
    if (!event.hostEventId || event.sharedAccessRevoked) return {}
    const [groups, allowed] = await Promise.all([
        sharedMatchGroups(ctx, event),
        sharedInvitationGroups(ctx, event),
    ])
    const signupGroupIds = (
        event.signupGroupIds ?? allowed.map((group) => group.groupId)
    ).filter((id) => allowed.some((group) => group.groupId === id))
    return {
        signupGroupIds,
        signupGroupLimits: sharedSignupLimits(
            allowed,
            signupGroupIds,
            (event.signupGroupLimits ?? []).filter((limit) =>
                signupGroupIds.includes(limit.groupId)
            )
        ),
        ...(event.signupGroupIds === undefined && allowed.length
            ? { useGeneralSignup: false }
            : {}),
        sharedGroups: groups.map(({ _id, _creationTime, ...group }) => ({
            ...group,
            id: String(_id),
        })),
        sharedSignupGroups: allowed,
    }
}
