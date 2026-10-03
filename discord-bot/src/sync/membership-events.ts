import { Events, type Client } from "discord.js"
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
    const shard = (id: number, reconcile: boolean) => {
        for (const guild of client.guilds.cache.values())
            if (guild.shardId === id) invalidate(guild.id, reconcile)
    }
    client.on(Events.GuildRoleDelete, (role) => invalidate(role.guild.id))
    client.on(Events.GuildRoleUpdate, (_before, role) =>
        invalidate(role.guild.id)
    )
    client.on(Events.GuildUnavailable, (guild) => invalidate(guild.id, false))
    client.on(Events.GuildDelete, (guild) => invalidate(guild.id, false))
    client.on(Events.GuildAvailable, (guild) => invalidate(guild.id))
    client.on(Events.GuildCreate, (guild) => invalidate(guild.id))
    client.on(Events.ShardDisconnect, (_event, id) => shard(id, false))
    client.on(Events.ShardReconnecting, (id) => shard(id, false))
    client.on(Events.ShardResume, (id) => shard(id, true))
    client.on(Events.ShardReady, (id) => shard(id, true))
}
