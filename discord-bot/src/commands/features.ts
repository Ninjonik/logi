import {
    playerProfileFromRow,
    type ClanPlayerProfileRow,
} from "../../../src/domain/discord-commands/player-view"
import { serverStatusInteractions } from "../interactions/server-status"
import { playerInteractions, type ClanPlayerOption } from "./player"
import type { InteractionFeature } from "../interactions/registry"
import { noticeInteractions, type NoticeTarget } from "./notice"
import { statsInteractions } from "../interactions/stats-live"
import { guildCommandConfigs, workspaceOf } from "./runtime"
import type { EventInteractionContext } from "../types"
import { convex, references } from "../convex"
import { revalidateAppData } from "../cache"
import { client } from "../discord-client"
import { helpInteractions } from "./help"
import { withTimeout } from "../utils"
import { shareGuildOf } from "./share"
import { env } from "../environment"

/**
 * The command features of the commands workstream, wired to Convex and the
 * Discord client. `interactions/features.ts` lists them for the registry.
 */

const secret = () => env.internalSecret

/** `/help`: the live settings, the workspace check and the wiki link. */
export const helpFeature: InteractionFeature = helpInteractions(() => ({
    configs: guildCommandConfigs,
    workspaceOf,
    siteUrl: env.appSiteUrl,
}))

/** `/player`: clan players and their imported-match profile. */
export const playerFeature: InteractionFeature = playerInteractions(() => ({
    configs: guildCommandConfigs,
    search: async (guildId, query) =>
        (await convex.query(references.searchClanPlayers, {
            secret: secret(),
            guildId,
            query,
            limit: 25,
        })) as ClanPlayerOption[],
    profile: async (guildId, playerId) => {
        const row = (await withTimeout(
            convex.query(references.getClanPlayerProfile, {
                secret: secret(),
                guildId,
                userId: playerId,
            }),
            8_000,
            "Clan player profile"
        )) as ClanPlayerProfileRow | null
        return row ? playerProfileFromRow(row) : null
    },
    shareGuild: (guildId) => shareGuildOf(client.guilds.cache.get(guildId)),
}))

/** `/notice`, its window and the reminder's "Přijdu později" button. */
export const noticeFeature: InteractionFeature = noticeInteractions(
    (context) => ({
        configs: guildCommandConfigs,
        targets: async (guildId, userId, query) =>
            (await convex.query(references.findNoticeTarget, {
                secret: secret(),
                guildId,
                userId,
                query,
            })) as NoticeTarget[],
        event: async (eventId) => {
            const found = (await convex.query(
                references.getEventInteractionContext,
                { secret: secret(), eventId: eventId as never }
            )) as EventInteractionContext | null
            if (!found) return null
            return {
                guildId: found.event.guildId,
                language: found.config.defaultLanguage,
                timeZone: found.config.timezone,
                name: found.event.name,
                gameStart: found.event.gameStart,
                status: found.event.status,
                style: found.config.messageStyle,
                announcementsChannelId:
                    found.event.announcementChannelId ??
                    found.config.announcementsChannelId,
            }
        },
        save: async (eventId, userId, reason) => {
            await convex.mutation(references.upsertNotice, {
                secret: secret(),
                eventId: eventId as never,
                userId,
                reason,
            })
        },
        saved: async (guildId, eventId) => {
            await revalidateAppData({
                type: "event-changed",
                serverId: guildId,
                eventId,
            }).catch(() => undefined)
            context.enqueueEventSync(eventId)
            context.triggerPollSoon()
        },
    })
)

/** `/server-status`: stored connections and the link to Herní servery. */
export const serverStatusFeature: InteractionFeature = serverStatusInteractions(
    () => ({
        configs: guildCommandConfigs,
        connections: (guildId) =>
            withTimeout(
                convex.query(references.getGameDataConnections, {
                    secret: secret(),
                    guildId,
                }),
                10_000,
                "Stored game server status"
            ),
        gameServersUrl: async (guildId, language) => {
            const workspace = await workspaceOf(guildId)
            return workspace
                ? `${env.appSiteUrl.replace(/\/+$/, "")}/${language}/dashboard/servers/${workspace.workspaceId}/settings/game-servers`
                : undefined
        },
    })
)

/** Every command feature, in the order they register. */
export const commandFeatures: readonly InteractionFeature[] = [
    helpFeature,
    statsInteractions,
    playerFeature,
    noticeFeature,
    serverStatusFeature,
]
