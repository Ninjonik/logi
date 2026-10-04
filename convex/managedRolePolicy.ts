import { managedRolePolicy } from "../src/domain/membership/managed-roles"
import type { MutationCtx } from "./_generated/server"
import { GAME_IDS } from "../src/domain/games/game"

/** Linking a group must not install a second writer for a managed role. */
export async function assertManagedRoleGroupLink(
    ctx: MutationCtx,
    guildId: string,
    roleId?: string
) {
    if (!roleId?.trim()) return
    const config = await ctx.db
        .query("discordConfigs")
        .withIndex("guildId", (q) => q.eq("guildId", guildId))
        .unique()
    for (const gameId of GAME_IDS)
        managedRolePolicy(config ?? {}, gameId, [roleId.trim()])
}
