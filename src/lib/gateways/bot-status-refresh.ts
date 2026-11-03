import { appCacheTags } from "../cache-tags"

type Guild = { id: string; discordId: string; name: string; avatar: string }

/** Expire snapshots only after Discord checks and persistence both succeed. */
export async function refreshManagedBotStatus(
    user: { id: string; discordId: string },
    guilds: Guild[],
    deps: {
        check(guildId: string): Promise<boolean>
        sync(
            userId: string,
            guilds: {
                id: string
                name: string
                avatar: string
                botInside: boolean
            }[]
        ): Promise<unknown>
        invalidate(tags: string[]): void
    }
) {
    const checked = await Promise.all(
        guilds.map(async (guild) => ({
            id: guild.discordId,
            name: guild.name,
            avatar: guild.avatar,
            botInside: await deps.check(guild.discordId),
        }))
    )
    await deps.sync(user.discordId, checked)
    deps.invalidate([
        appCacheTags.users(),
        appCacheTags.player(user.id),
        ...guilds.flatMap((guild) =>
            [guild.id, guild.discordId].flatMap((id) => [
                appCacheTags.server(id),
                appCacheTags.serverContext(id),
            ])
        ),
    ])
}
