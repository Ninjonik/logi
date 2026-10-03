import { getUserByIdentifier, getUserStableId } from "./identity"
import type { QueryCtx } from "./_generated/server"

type Context = Pick<QueryCtx, "db">

/** A Logi/import identifier is not proof of a Discord account binding. */
export async function assignmentDiscordSubject(ctx: Context, userId: string) {
    return (await getUserByIdentifier(ctx, userId))?.discordId ?? null
}

export async function readMembershipAssignment(
    ctx: Context,
    subject: { guildId: string; gameId: string; discordUserId: string }
) {
    const user = await ctx.db
        .query("users")
        .withIndex("discordId", (q) => q.eq("discordId", subject.discordUserId))
        .unique()
    if (!user) return null
    const aliases = [...new Set([getUserStableId(user), subject.discordUserId])]
    const assignments = []
    for (const userId of aliases) {
        // An imported ID can collide with another account's Discord ID.
        if ((await getUserByIdentifier(ctx, userId))?._id !== user._id) continue
        const rows = await ctx.db
            .query("userAssignments")
            .withIndex("serverId_userId", (q) =>
                q.eq("serverId", subject.guildId).eq("userId", userId)
            )
            .collect()
        assignments.push(
            ...rows.filter(
                (row) => (row.gameId ?? "hell_let_loose") === subject.gameId
            )
        )
    }
    // Conflicting legacy aliases require an explicit data repair.
    return assignments.length === 1 ? assignments[0] : null
}
