import {
    getServerUserAssignment,
    getUsersByIds,
} from "@/lib/server-user-management"
import { recheckPlayerDisplayName } from "@/lib/gateways/player-display-name"
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags"
import { getServerContext } from "@/lib/server-context"

export async function POST(
    _request: Request,
    {
        params,
    }: {
        params: Promise<{ serverId: string; assignmentId: string }>
    }
) {
    const { serverId, assignmentId } = await params
    const context = await getServerContext(serverId, "all")
    if (!context?.canAdmin)
        return Response.json({ error: "Forbidden." }, { status: 403 })
    const assignment = await getServerUserAssignment(assignmentId)
    if (!assignment || assignment.serverId !== context.server.discordId) {
        return Response.json({ error: "Player not found." }, { status: 404 })
    }
    const [user] = await getUsersByIds(
        [assignment.userId],
        context.server.discordId
    )
    if (
        !user?.hasDiscordLink ||
        !user.linkedDiscordId ||
        !/^\d{17,20}$/.test(user.discordId)
    ) {
        return Response.json(
            { error: "Player has no linked Discord account." },
            { status: 400 }
        )
    }
    try {
        const result = await recheckPlayerDisplayName({
            guildId: context.server.discordId,
            discordId: user.linkedDiscordId,
        })
        revalidateCacheEntries([
            appCacheTags.users(),
            appCacheTags.player(user.id),
            appCacheTags.serverContext(serverId),
            appCacheTags.rosterImage(),
            appCacheTags.publicProfile(user.id),
            appCacheTags.publicClan(context.server.discordId),
        ])
        return Response.json(result)
    } catch {
        return Response.json(
            {
                error: "Unable to recheck the name. Check that the player is still in Discord and the bot can read the member.",
            },
            { status: 502 }
        )
    }
}
