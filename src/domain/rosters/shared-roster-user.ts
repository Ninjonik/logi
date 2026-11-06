import type { AppUser } from "../../types/domain"

/** Foreign players need a display identity, not another clan's member/account record. */
export function sharedRosterUser(user: AppUser, local: boolean): AppUser {
    if (local) return user
    return {
        id: user.id,
        discordId: user.discordId,
        name: user.name,
        avatar: user.avatar,
        hasDiscordLink: user.hasDiscordLink,
        isStreamer: user.isStreamer,
        nicknames: {},
        platformIds: [],
        managedGuildIds: [],
        mercenaryGuildIds: [],
        scores: {},
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        sharedGuildId: user.sharedGuildId,
        sharedEligibleGuildIds: user.sharedEligibleGuildIds,
    }
}
