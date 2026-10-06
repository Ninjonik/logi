import {
    buildServerStatusView,
    serverStatusNoConnectionsCard,
    serverStatusNotAllowedCard,
    serverStatusUnavailableCard,
    type ServerStatusRow,
} from "../../../src/domain/discord-commands/server-status-view"
import {
    checkCommandAccess,
    type AccessDeps,
    type AccessInteraction,
} from "../commands/access"
import {
    dataGameSchema,
    gameDataSettingsSchema,
} from "../../../src/domain/game-data/contracts"
import { commandDecisionCard } from "../../../src/domain/discord-commands/access-view"
import { getIntlLocaleForClanLanguage } from "../../../src/lib/clan-language/core"
import { getCommandMessages } from "../../../src/lib/clan-language/commands"
import { MessageFlags, type ChatInputCommandInteraction } from "discord.js"
import { replyError, replyPrivately } from "../ui/replies"
import type { InteractionFeature } from "./registry"
import type { z } from "zod"

type Settings = z.infer<typeof gameDataSettingsSchema>
type Game = z.infer<typeof dataGameSchema>
const gameNames: Record<Game, string> = {
    hell_let_loose: "Hell Let Loose",
    wardogs: "Wardogs",
}

/**
 * The stored connections of one game in this server, as the reply rows. A
 * row that is not fresh shows the last observed state, at most a day old
 * ("Online · zastaralé"); without it the row reads "Bez dat" (M3-23).
 */
export function serverStatusRows(
    guildId: string,
    game: Game,
    settings: Settings
): ServerStatusRow[] {
    return settings.connections
        .filter(
            ({ snapshot }) =>
                snapshot.guildId === guildId && snapshot.gameId === game
        )
        .map(({ snapshot, health, lastState }) => ({
            displayName: snapshot.displayName,
            state:
                snapshot.freshness === "fresh"
                    ? snapshot.state
                    : (lastState ?? "unknown"),
            freshness: snapshot.freshness,
            collecting: health.enabled,
            players: snapshot.players,
            capacity: snapshot.capacity,
            map: snapshot.map,
            observedAt: snapshot.observedAt,
            provider: snapshot.provider,
        }))
}

/** What `/server-status` reads; Convex in production, fakes in tests. */
export type ServerStatusPorts = AccessDeps & {
    /** `gameData:listConnections`, bounded in time; throws when unreadable. */
    connections(guildId: string): Promise<unknown>
    /** The workspace's "Herní servery" page, for the link. */
    gameServersUrl(
        guildId: string,
        language: string
    ): Promise<string | undefined>
}

type Interaction = AccessInteraction &
    Pick<ChatInputCommandInteraction, "deferReply"> & {
        options: { getString(name: string): string | null }
    }

/**
 * `/server-status` (M3 1.4): only for Logi's managers (Administrator or the
 * Logi admin role, plus the extra roles from the "Příkazy" page), checked
 * freshly from Discord; the reply is private and in the clan language,
 * never the member's Discord language (M3-21, M3-B04). It shows the stored
 * status of at most five servers of the chosen game with a link to Logi.
 */
export async function handleServerStatusCommand(
    interaction: Interaction,
    ports: ServerStatusPorts
) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral })
    const access = await checkCommandAccess(interaction, "server-status", {
        configs: ports.configs,
        readCaller: ports.readCaller,
        // "nepovoleno" for this command names the live score channel (M3-25).
        refusal: (decision, language, config) =>
            decision.kind === "notAllowed"
                ? serverStatusNotAllowedCard({
                      copy: getCommandMessages(language).serverStatus,
                      extraRoles:
                          getCommandMessages(language).access.extraRoles,
                      or: getCommandMessages(language).access.or,
                      roleIds: decision.roleIds,
                      liveScoreChannelId:
                          config?.liveScoreChannelIds[
                              dataGameSchema.safeParse(
                                  interaction.options.getString("game")
                              ).data ?? "wardogs"
                          ] ??
                          config?.liveScoreChannelIds.hell_let_loose ??
                          config?.liveScoreChannelIds.wardogs,
                  })
                : commandDecisionCard(decision, {
                      command: "server-status",
                      copy: getCommandMessages(language).access,
                  }),
    })
    if (!access || !interaction.guildId) return
    const language = access.language
    const copy = getCommandMessages(language).serverStatus
    const options = { language, style: access.config?.messageStyle }
    const game = dataGameSchema.safeParse(interaction.options.getString("game"))
    if (!game.success) {
        await replyError(
            interaction,
            serverStatusUnavailableCard(copy),
            options
        )
        return
    }
    let settings: Settings
    try {
        settings = gameDataSettingsSchema.parse(
            await ports.connections(interaction.guildId)
        )
    } catch {
        await replyError(
            interaction,
            serverStatusUnavailableCard(copy),
            options
        )
        return
    }
    const gameServersUrl = await ports
        .gameServersUrl(interaction.guildId, language)
        .catch(() => undefined)
    const rows = serverStatusRows(interaction.guildId, game.data, settings)
    if (!rows.length) {
        await replyError(
            interaction,
            serverStatusNoConnectionsCard({
                copy,
                gameLabel: gameNames[game.data],
                gameServersUrl,
            }),
            options
        )
        return
    }
    await replyPrivately(
        interaction,
        buildServerStatusView({
            copy,
            language,
            locale: getIntlLocaleForClanLanguage(language),
            gameLabel: gameNames[game.data],
            rows,
            gameServersUrl,
        }),
        options
    )
}

/** Routes `/server-status` through the interaction registry. */
export function serverStatusInteractions(
    ports: () => ServerStatusPorts
): InteractionFeature {
    return {
        name: "server-status",
        register(registry) {
            registry.command("server-status", (interaction) =>
                handleServerStatusCommand(interaction, ports())
            )
        },
    }
}
