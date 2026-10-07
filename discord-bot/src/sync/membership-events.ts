import { Events, type Client } from "discord.js"

/**
 * Discord events that make the stored member observations of a guild
 * untrustworthy. Each one bumps the guild's epoch, and a full reconciliation
 * then observes every member again, so only events that can hide a member
 * change invalidate:
 *
 * - a new gateway session (ShardReady; ClientReady invalidates in index.ts),
 *   because events missed while disconnected are never replayed;
 * - a guild becoming available, joined, unavailable or left;
 * - a deleted role, and a role whose permissions changed, since dashboard
 *   access (`isAdmin`) follows the Administrator permission.
 *
 * A resumed session replays the events it missed, so ShardResume,
 * ShardDisconnect and ShardReconnecting invalidate nothing, and a role's
 * position, colour or name change none of the stored member data.
 */
export function registerMembershipInvalidationEvents(
    client: Client,
    ports: {
        invalidate(guildId: string): Promise<void>
        reconcile(): void
        failed(guildId: string, error: unknown): void
    }
) {
    const invalidate = (guildId: string, reconcile = true) => {
        void ports
            .invalidate(guildId)
            .then(() => {
                if (reconcile) ports.reconcile()
            })
            .catch((error) => ports.failed(guildId, error))
    }
    client.on(Events.GuildRoleDelete, (role) => invalidate(role.guild.id))
    client.on(Events.GuildRoleUpdate, (before, role) => {
        if (before.permissions.bitfield !== role.permissions.bitfield)
            invalidate(role.guild.id)
    })
    client.on(Events.GuildUnavailable, (guild) => invalidate(guild.id, false))
    client.on(Events.GuildDelete, (guild) => invalidate(guild.id, false))
    client.on(Events.GuildAvailable, (guild) => invalidate(guild.id))
    client.on(Events.GuildCreate, (guild) => invalidate(guild.id))
    client.on(Events.ShardReady, (id) => {
        for (const guild of client.guilds.cache.values())
            if (guild.shardId === id) invalidate(guild.id)
    })
}
