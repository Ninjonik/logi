import {
    MessageFlags,
    type AutocompleteInteraction,
    type ButtonInteraction,
    type ChatInputCommandInteraction,
} from "discord.js"

import {
    buildPlayerProfileView,
    playerLoadFailedCard,
    playerNotFoundCard,
    playerOptionLabel,
    type PlayerProfileData,
} from "../../../src/domain/discord-commands/player-view"
import {
    discordMessageUrl,
    shareDeniedCard,
    sharedDoneCard,
} from "../../../src/domain/discord-commands/share-view"
import {
    checkCommandAccess,
    readFreshCaller,
    type AccessInteraction,
} from "./access"
import { getIntlLocaleForClanLanguage } from "../../../src/lib/clan-language/core"
import { errorCard } from "../../../src/domain/discord-messages/message-view"
import { getCommandMessages } from "../../../src/lib/clan-language/commands"
import type { InteractionFeature } from "../interactions/registry"
import { editPayload, messagePayload } from "../ui/message-kit"
import type { GuildCommandConfigs } from "./guild-configs"
import { replyError, replyPrivately } from "../ui/replies"
import { postSharedCard, type ShareGuild } from "./share"
import { fallbackGuildLanguage } from "./definitions"

/** The game the clan's imported match statistics come from. */
const PLAYER_GAME_LABEL = "Hell Let Loose"
const SHARE_PREFIX = "player:share:"
/** A clan player's stable ID as `getClanPlayerProfile` accepts it. */
const PLAYER_ID = /^[\w:-]{1,64}$/

/** A row of `players:searchClanPlayers`. */
export type ClanPlayerOption = {
    id: string
    name: string
    assignmentType?: "member" | "reserve_member" | "mercenary"
    assignmentStatus?: "pending" | "recruit" | "active"
    assignmentPaused?: boolean
}

/** What `/player` reads; Convex in production, fakes in tests. */
export type PlayerPorts = {
    configs: Pick<GuildCommandConfigs, "get">
    search(guildId: string, query: string): Promise<ClanPlayerOption[]>
    /** Null when the player is not in this clan; throws when unreadable. */
    profile(
        guildId: string,
        playerId: string
    ): Promise<PlayerProfileData | null>
    /** The server to share into, read from the bot's guild cache. */
    shareGuild(guildId: string): ShareGuild | null
    readCaller?: typeof readFreshCaller
    now?: () => number
}

type CommandInteraction = AccessInteraction &
    Pick<ChatInputCommandInteraction, "deferReply"> & {
        options: { getString(name: string, required: true): string }
    }

async function languageOf(
    ports: PlayerPorts,
    guildId: string | null,
    preferredLocale?: string | null
) {
    const config = await ports.configs.get(guildId)
    return {
        config,
        language: config?.language ?? fallbackGuildLanguage(preferredLocale),
    }
}

/**
 * The "hráč" autocomplete (M2-35): "Hráč 17 · Člen · aktivní", in the clan
 * language.
 */
export async function handlePlayerAutocomplete(
    interaction: Pick<
        AutocompleteInteraction,
        "guildId" | "respond" | "options"
    > & { guild?: { preferredLocale?: string | null } | null },
    ports: PlayerPorts
) {
    const focused = interaction.options.getFocused(true)
    if (!interaction.guildId || focused.name !== "player") {
        await interaction.respond([])
        return
    }
    const { language } = await languageOf(
        ports,
        interaction.guildId,
        interaction.guild?.preferredLocale
    )
    const copy = getCommandMessages(language).player
    const players = await ports
        .search(interaction.guildId, String(focused.value ?? ""))
        .catch(() => [])
    await interaction.respond(
        players.slice(0, 25).map((player) => ({
            name: playerOptionLabel(copy, {
                name: player.name,
                type: player.assignmentType,
                status: player.assignmentStatus,
                paused: player.assignmentPaused,
            }),
            value: player.id.slice(0, 100),
        }))
    )
}

/**
 * `/player` (M2 1.3): a private profile in the clan language with the game
 * and source named, a small avatar and "Sdílet" (M1-B06); not found and
 * load failures are the shared error cards.
 */
export async function handlePlayerCommand(
    interaction: CommandInteraction,
    ports: PlayerPorts
) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral })
    const access = await checkCommandAccess(interaction, "player", ports)
    if (!access) return
    const copy = getCommandMessages(access.language).player
    const options = {
        language: access.language,
        style: access.config?.messageStyle,
    }
    const playerId = interaction.options.getString("player", true).trim()
    if (!interaction.guildId || !PLAYER_ID.test(playerId)) {
        await replyError(interaction, playerNotFoundCard(copy), options)
        return
    }
    let profile: PlayerProfileData | null
    try {
        profile = await ports.profile(interaction.guildId, playerId)
    } catch {
        await replyError(interaction, playerLoadFailedCard(copy), options)
        return
    }
    if (!profile) {
        await replyError(interaction, playerNotFoundCard(copy), options)
        return
    }
    await replyPrivately(
        interaction,
        buildPlayerProfileView({
            copy,
            gameLabel: PLAYER_GAME_LABEL,
            profile,
            locale: getIntlLocaleForClanLanguage(access.language),
            timeZone: access.config?.timeZone,
            shareId:
                access.access.settings.player.reply === "privateShare"
                    ? `${SHARE_PREFIX}${playerId}`
                    : undefined,
        }),
        options
    )
}

type ShareInteraction = AccessInteraction &
    Pick<ButtonInteraction, "deferUpdate" | "editReply"> & {
        customId: string
    }

/**
 * "Sdílet" (M2-40, M2-42): checks the command again, reads the profile
 * fresh and posts it to the channel where the command was used, naming who
 * shared it and when. The private card turns into "Sdíleno do #kanál".
 */
export async function handlePlayerShare(
    interaction: ShareInteraction,
    ports: PlayerPorts
) {
    await interaction.deferUpdate()
    const { config, language } = await languageOf(
        ports,
        interaction.guildId,
        interaction.guild?.preferredLocale
    )
    const options = { language, style: config?.messageStyle }
    const copy = getCommandMessages(language).player
    const edit = (view: Parameters<typeof editPayload>[0]) =>
        interaction.editReply(
            editPayload({ ...view, ephemeral: true }, options)
        )
    const access = await checkCommandAccess(interaction, "player", ports)
    if (!access) return
    const playerId = interaction.customId.slice(SHARE_PREFIX.length)
    const channelId = interaction.channelId
    if (
        !interaction.guildId ||
        !channelId ||
        !PLAYER_ID.test(playerId) ||
        access.access.settings.player.reply !== "privateShare"
    ) {
        await edit(playerNotFoundCard(copy))
        return
    }
    let profile: PlayerProfileData | null
    try {
        profile = await ports.profile(interaction.guildId, playerId)
    } catch {
        await edit(playerLoadFailedCard(copy))
        return
    }
    if (!profile) {
        await edit(playerNotFoundCard(copy))
        return
    }
    const at = (ports.now ?? Date.now)()
    const shared = await postSharedCard({
        guild: ports.shareGuild(interaction.guildId),
        channelId,
        requesterId: interaction.user.id,
        payload: messagePayload(
            buildPlayerProfileView({
                copy,
                gameLabel: PLAYER_GAME_LABEL,
                profile,
                locale: getIntlLocaleForClanLanguage(language),
                timeZone: config?.timeZone,
                shared: { userId: interaction.user.id, at },
            }),
            options
        ),
    })
    if (!shared.ok) {
        await edit(
            shared.reason === "denied"
                ? shareDeniedCard({
                      title: copy.shareDeniedTitle,
                      body: copy.shareDeniedBody,
                      channelId,
                  })
                : errorCard({
                      title: copy.shareFailedTitle,
                      body: copy.shareFailedBody,
                  })
        )
        return
    }
    await edit(
        sharedDoneCard({
            title: copy.sharedTitle,
            viewMessage: copy.viewMessage,
            channelId: shared.channelId,
            messageUrl:
                shared.url ??
                discordMessageUrl(
                    interaction.guildId,
                    shared.channelId,
                    shared.messageId
                ),
        })
    )
}

/** Routes `/player`, its autocomplete and "Sdílet" through the registry. */
export function playerInteractions(
    ports: () => PlayerPorts
): InteractionFeature {
    return {
        name: "player",
        register(registry) {
            registry
                .command("player", (interaction) =>
                    handlePlayerCommand(interaction, ports())
                )
                .autocomplete("player", (interaction) =>
                    handlePlayerAutocomplete(interaction, ports())
                )
                .button(SHARE_PREFIX, (interaction) =>
                    handlePlayerShare(interaction, ports())
                )
        },
    }
}
