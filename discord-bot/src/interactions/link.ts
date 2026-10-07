/**
 * `/link` (boards L4 1.5 and M3 1.2): a private guide, one message updated
 * in place, that links the person's Steam, Epic Games, Xbox or PlayStation
 * account. When the clan's servers retained games it first asks "Hrál jsi u
 * nás?" and can find the person by name or ID (L4-B08), from the same
 * source and rule as the application's "Našli jsme tě na serverech klanu?"
 * (`convex/clanPlayerHistory.ts`). IDs are checked per platform before
 * they are stored (M3-B08); a declared ID is a claim, and "Ověřit Steam na
 * webu" leads to the verified Steam flow in Logi → Můj účet. Unlinking says
 * when the person's open application uses the account (L4-B09). The old
 * one-time DM link is gone (L4-B10): its stale buttons only say "Spusť /link
 * znovu."
 */

import {
    LabelBuilder,
    MessageFlags,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    type ButtonInteraction,
    type ChatInputCommandInteraction,
    type Client,
    type ModalSubmitInteraction,
    type StringSelectMenuInteraction,
} from "discord.js"

import {
    LINK_BUTTON_PREFIX,
    LINK_ID_MODAL_PREFIX,
    LINK_SEARCH_MODAL_PREFIX,
    guideView,
    invalidIdView,
    linkedAccountsView,
    linkIdModalId,
    linkSearchModalId,
    linkStartView,
    parseLinkFlowId,
    parseLinkIdModalId,
    parseLinkSearchModalId,
    playedBeforeView,
    searchEmptyView,
    searchResultsView,
    searchUnavailableView,
    staleLinkView,
    takenIdView,
    unlinkView,
    type FoundPlayer,
    type LinkFlowContext,
    type PlatformEmoji,
} from "../../../src/domain/game-accounts/account-views"
import {
    accountsUsedByApplication,
    isGameAccountPlatform,
    parseGameAccountId,
    readStoredGameAccount,
    type GameAccountPlatform,
} from "../../../src/domain/game-accounts/platform-id"
import {
    getIntlLocaleForClanLanguage,
    resolveClanLanguage,
} from "../../../src/lib/clan-language/core"
import type { PreviousPlayer } from "../../../src/domain/membership/previous-players"
import { getGameAccountMessages } from "../../../src/lib/clan-language/game-accounts"
import type { MessageView } from "../../../src/domain/discord-messages/message-view"
import { continueApplicationAfterLink } from "./membership-application"
import { editPayload, type MessageKitOptions } from "../ui/message-kit"
import type { GuildCommandConfigs } from "../commands/guild-configs"
import { seenDay } from "../../../src/domain/discord-commands/text"
import { fallbackGuildLanguage } from "../commands/definitions"
import { replyError, replyPrivately } from "../ui/replies"
import { guildCommandConfigs } from "../commands/runtime"
import { checkCommandAccess } from "../commands/access"
import { makeFunctionReference } from "convex/server"
import type { InteractionFeature } from "./registry"

import { convex, references } from "../convex"
import { client } from "../discord-client"
import { env } from "../environment"

/** Where each platform explains how to find the ID ("Návod"). */
export const GAME_ACCOUNT_GUIDE_URLS: Record<GameAccountPlatform, string> = {
    steam: "https://help.steampowered.com/en/faqs/view/2816-BE67-5B69-0FEC",
    epic: "https://www.epicgames.com/help/c-202300000001645/c-Trending_0/what-is-an-epic-games-account-id-and-where-can-i-find-it-a202300000011535",
    xbox: "https://support.xbox.com/en-US/help/account-profile/profile/change-xbox-live-gamertag",
    playstation:
        "https://www.playstation.com/en-us/support/account/change-online-id/",
}

/** Buttons and selects of the retired DM-era guide (`plink:<step>:l:…`). */
const LEGACY_BUTTON_PREFIXES = [
    "plink:start:l:",
    "plink:player-search:l:",
    "plink:unlink:l:",
    "plink:manual:l:",
]
const LEGACY_SELECT_PREFIXES = [
    "plink:played:l:",
    "plink:platform:l:",
    "plink:unlink-select:l:",
    "plink:player:l:",
]
const LEGACY_MODAL_PREFIXES = ["plink-modal:l:", "plink-search:l:"]

/** `discordGameAccounts:getLinkContext`. */
export type LinkContextRow = {
    /** `accounts`: the stored IDs an application in windows gave. */
    application: {
        answers: Array<{ value: string }>
        accounts?: string[]
    } | null
}

/** What `/link` reads and writes; Convex and Discord in production, fakes in tests. */
export type LinkPorts = {
    configs: Pick<GuildCommandConfigs, "get">
    /** The person's linked accounts, as stored (`steam:7656…`). */
    accounts(userId: string): Promise<string[]>
    /** Links one account; "taken" when another player has it. */
    link(input: {
        userId: string
        userName: string
        userAvatar: string
        stored: string
    }): Promise<"linked" | "taken">
    /** Unlinks one account and returns the remaining ones. */
    unlink(userId: string, stored: string): Promise<string[]>
    context(guildId: string, userId: string): Promise<LinkContextRow>
    /**
     * "Hrál jsi u nás?" (L4-49..L4-51): the clan's retained games, the same
     * source and rule as the application's "Našli jsme tě…" (L6-B06).
     * `known` is false when the clan's servers retained no game yet;
     * `players` answer a name or ID.
     */
    playerHistory(
        guildId: string,
        query?: string
    ): Promise<{ known: boolean; players: PreviousPlayer[] }>
    /** Installed application emoji of the platforms. */
    emoji(): Promise<PlatformEmoji>
    siteUrl: string
    /**
     * Inside a clan application (L4-60): continues the application once the
     * account is linked. Without it the guide shows the linked accounts.
     */
    continueApplication?: (
        interaction:
            | ButtonInteraction
            | StringSelectMenuInteraction
            | ModalSubmitInteraction,
        draftId: string
    ) => Promise<void>
}

type Clan = {
    language: string
    options: MessageKitOptions
    timeZone: string
}

async function clanOf(
    guildId: string | null,
    preferredLocale: string | null | undefined,
    ports: LinkPorts
): Promise<Clan> {
    const config = await ports.configs.get(guildId)
    const language = config?.language ?? fallbackGuildLanguage(preferredLocale)
    return {
        language,
        options: { language, style: config?.messageStyle },
        timeZone: config?.timeZone ?? "UTC",
    }
}

function verifySteamUrl(siteUrl: string, language: string) {
    return new URL(
        `/${resolveClanLanguage(language)}/dashboard/settings/user`,
        siteUrl
    ).toString()
}

type Base = {
    copy: ReturnType<typeof getGameAccountMessages>
    context: LinkFlowContext
    emoji: PlatformEmoji
}

async function base(
    clan: Clan,
    context: LinkFlowContext,
    ports: LinkPorts
): Promise<Base> {
    return {
        copy: getGameAccountMessages(clan.language),
        context,
        emoji: await ports.emoji().catch(() => ({})),
    }
}

/** The first card of the guide: "Hrál jsi u nás?" with retained games, else the platforms. */
async function startView(
    guildId: string | null,
    clan: Clan,
    input: Base,
    ports: LinkPorts
): Promise<MessageView> {
    const history = guildId
        ? await ports.playerHistory(guildId).catch(() => null)
        : null
    return history?.known
        ? playedBeforeView(input)
        : linkStartView({
              ...input,
              verifySteamUrl: verifySteamUrl(ports.siteUrl, clan.language),
          })
}

/** The linked accounts, or the start of the guide when there are none. */
async function accountsView(
    guildId: string | null,
    userId: string,
    clan: Clan,
    input: Base,
    ports: LinkPorts,
    justLinked?: GameAccountPlatform
) {
    const accounts = await ports.accounts(userId)
    return accounts.length
        ? linkedAccountsView({ ...input, accounts, justLinked })
        : startView(guildId, clan, input, ports)
}

/** `/link`: the linked accounts, or the guide when nothing is linked yet. */
export async function handleLinkCommand(
    interaction: ChatInputCommandInteraction,
    ports: LinkPorts
) {
    // Private acknowledgement first: every answer below needs a read.
    await interaction.deferReply({ flags: MessageFlags.Ephemeral })
    const access = await checkCommandAccess(interaction, "link", ports)
    if (!access) return
    const clan: Clan = {
        language: access.language,
        options: {
            language: access.language,
            style: access.config?.messageStyle,
        },
        timeZone: access.config?.timeZone ?? "UTC",
    }
    const input = await base(clan, { kind: "link" }, ports)
    await replyPrivately(
        interaction,
        await accountsView(
            interaction.guildId,
            interaction.user.id,
            clan,
            input,
            ports
        ),
        clan.options
    )
}

/** The ID window of a platform (L4-53, M3-10): "Propojit Steam" / "Steam64 ID". */
export function buildLinkIdModal(
    context: LinkFlowContext,
    platform: GameAccountPlatform,
    language: string
) {
    const copy = getGameAccountMessages(language).platforms[platform]
    return new ModalBuilder()
        .setCustomId(linkIdModalId(context, platform))
        .setTitle(copy.modalTitle.slice(0, 45))
        .addLabelComponents(
            new LabelBuilder()
                .setLabel(copy.idName.slice(0, 45))
                .setTextInputComponent(
                    new TextInputBuilder()
                        .setCustomId("id")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setMaxLength(120)
                        .setPlaceholder(copy.placeholder.slice(0, 100))
                )
        )
}

/** The search window (L4-50): "Najít mě ve hře" / "Jméno ve hře nebo ID". */
export function buildLinkSearchModal(
    context: LinkFlowContext,
    language: string
) {
    const copy = getGameAccountMessages(language).search
    return new ModalBuilder()
        .setCustomId(linkSearchModalId(context))
        .setTitle(copy.modalTitle.slice(0, 45))
        .addLabelComponents(
            new LabelBuilder()
                .setLabel(copy.label.slice(0, 45))
                .setTextInputComponent(
                    new TextInputBuilder()
                        .setCustomId("query")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setMinLength(3)
                        .setMaxLength(100)
                        .setPlaceholder(copy.placeholder.slice(0, 100))
                )
        )
}

type ComponentInteraction = ButtonInteraction | StringSelectMenuInteraction

async function replyStale(
    interaction:
        | ButtonInteraction
        | StringSelectMenuInteraction
        | ModalSubmitInteraction,
    ports: LinkPorts
) {
    const clan = await clanOf(
        interaction.guildId,
        interaction.guild?.preferredLocale,
        ports
    )
    await replyError(
        interaction,
        staleLinkView(getGameAccountMessages(clan.language)),
        clan.options
    )
}

async function linkAccount(
    interaction: ComponentInteraction | ModalSubmitInteraction,
    stored: string,
    platform: GameAccountPlatform | undefined,
    flow: { clan: Clan; input: Base },
    ports: LinkPorts
): Promise<MessageView | null> {
    const outcome = await ports.link({
        userId: interaction.user.id,
        userName: interaction.user.globalName ?? interaction.user.username,
        userAvatar: interaction.user.displayAvatarURL(),
        stored,
    })
    if (outcome === "taken")
        return takenIdView({
            ...flow.input,
            platform: platform ?? "steam",
        })
    const { context } = flow.input
    if (context.kind === "application" && ports.continueApplication) {
        await ports.continueApplication(interaction, context.draftId)
        return null
    }
    return accountsView(
        interaction.guildId,
        interaction.user.id,
        flow.clan,
        flow.input,
        ports,
        platform
    )
}

/** Every button and select of the guide (`link:<context>:<step>[:<platform>]`). */
export async function handleLinkComponent(
    interaction: ComponentInteraction,
    ports: LinkPorts
) {
    const parsed = parseLinkFlowId(interaction.customId)
    if (!parsed) {
        await replyStale(interaction, ports)
        return
    }
    const clan = await clanOf(
        interaction.guildId,
        interaction.guild?.preferredLocale,
        ports
    )
    const value = interaction.isStringSelectMenu()
        ? interaction.values[0]
        : undefined
    const update = async (view: MessageView | null) => {
        if (view) await interaction.update(editPayload(view, clan.options))
    }
    // The windows must be the first answer, before any read.
    if (parsed.step === "enter" && parsed.platform) {
        await interaction.showModal(
            buildLinkIdModal(parsed.context, parsed.platform, clan.language)
        )
        return
    }
    if (
        parsed.step === "search" ||
        (parsed.step === "played" && value === "yes")
    ) {
        await interaction.showModal(
            buildLinkSearchModal(parsed.context, clan.language)
        )
        return
    }
    const input = await base(clan, parsed.context, ports)
    switch (parsed.step) {
        case "start":
            await update(
                await startView(interaction.guildId, clan, input, ports)
            )
            return
        case "played":
        case "back":
        case "manual":
            await update(
                linkStartView({
                    ...input,
                    verifySteamUrl: verifySteamUrl(
                        ports.siteUrl,
                        clan.language
                    ),
                })
            )
            return
        case "platform":
            if (!isGameAccountPlatform(value)) {
                await replyStale(interaction, ports)
                return
            }
            await update(
                guideView({
                    ...input,
                    platform: value,
                    guideUrl: GAME_ACCOUNT_GUIDE_URLS[value],
                })
            )
            return
        case "pick": {
            if (!value) {
                await replyStale(interaction, ports)
                return
            }
            const found = readStoredGameAccount(value)
            const platform =
                found.platform === "other" ? undefined : found.platform
            const stored = platform === "steam" ? `steam:${found.id}` : value
            await update(
                await linkAccount(
                    interaction,
                    stored,
                    platform,
                    { clan, input },
                    ports
                )
            )
            return
        }
        case "unlink":
        case "accounts": {
            if (parsed.step === "accounts") {
                await update(
                    await accountsView(
                        interaction.guildId,
                        interaction.user.id,
                        clan,
                        input,
                        ports
                    )
                )
                return
            }
            const accounts = await ports.accounts(interaction.user.id)
            if (!accounts.length) {
                await update(
                    await startView(interaction.guildId, clan, input, ports)
                )
                return
            }
            const row = interaction.guildId
                ? await ports
                      .context(interaction.guildId, interaction.user.id)
                      .catch(() => null)
                : null
            await update(
                unlinkView({
                    ...input,
                    accounts,
                    usedByApplication: accountsUsedByApplication(
                        accounts,
                        row?.application ?? null
                    ),
                })
            )
            return
        }
        case "unlink-pick": {
            if (!value) {
                await replyStale(interaction, ports)
                return
            }
            const remaining = await ports.unlink(interaction.user.id, value)
            await update(
                remaining.length
                    ? linkedAccountsView({ ...input, accounts: remaining })
                    : await startView(interaction.guildId, clan, input, ports)
            )
            return
        }
        default:
            await replyStale(interaction, ports)
    }
}

/** Shows a view in place of the message the window came from. */
async function updateFromModal(
    interaction: ModalSubmitInteraction,
    view: MessageView,
    options: MessageKitOptions
) {
    if (interaction.isFromMessage())
        await interaction.update(editPayload(view, options))
    else await replyPrivately(interaction, view, options)
}

/** The submitted ID (L4-53, L4-56, M3-10, M3-11). */
export async function handleLinkIdModal(
    interaction: ModalSubmitInteraction,
    ports: LinkPorts
) {
    const parsed = parseLinkIdModalId(interaction.customId)
    if (!parsed) {
        await replyStale(interaction, ports)
        return
    }
    const clan = await clanOf(
        interaction.guildId,
        interaction.guild?.preferredLocale,
        ports
    )
    const input = await base(clan, parsed.context, ports)
    const id = parseGameAccountId(
        parsed.platform,
        interaction.fields.getTextInputValue("id")
    )
    if (!id.ok) {
        await updateFromModal(
            interaction,
            invalidIdView({
                ...input,
                platform: parsed.platform,
                guideUrl: GAME_ACCOUNT_GUIDE_URLS[parsed.platform],
            }),
            clan.options
        )
        return
    }
    const view = await linkAccount(
        interaction,
        id.stored,
        parsed.platform,
        { clan, input },
        ports
    )
    if (view) await updateFromModal(interaction, view, clan.options)
}

/** "Najít mě ve hře" was sent: the people found, nobody, or no answer (L4-51, L4-57). */
export async function handleLinkSearchModal(
    interaction: ModalSubmitInteraction,
    ports: LinkPorts
) {
    const context = parseLinkSearchModalId(interaction.customId)
    if (!context || !interaction.guildId) {
        await replyStale(interaction, ports)
        return
    }
    if (interaction.isFromMessage()) await interaction.deferUpdate()
    else await interaction.deferReply({ flags: MessageFlags.Ephemeral })
    const clan = await clanOf(
        interaction.guildId,
        interaction.guild?.preferredLocale,
        ports
    )
    const input = await base(clan, context, ports)
    const result = await ports
        .playerHistory(
            interaction.guildId,
            interaction.fields.getTextInputValue("query")
        )
        .catch(() => "unavailable" as const)
    const locale = getIntlLocaleForClanLanguage(clan.language)
    const now = Date.now()
    const players: FoundPlayer[] =
        result === "unavailable"
            ? []
            : result.players.map((player) => ({
                  // Stored as `steam:7656…`, `epic:…`, `xbox:…`; an unknown
                  // platform keeps its bare ID.
                  playerId:
                      player.platform === "other"
                          ? player.platformId
                          : player.key,
                  name: player.name,
                  platform: player.platform,
                  // The weekday only within the last 7 days (L4-51).
                  lastSeen: seenDay(
                      player.lastSeenAt,
                      locale,
                      clan.timeZone,
                      now
                  ),
                  server: player.serverName ?? undefined,
              }))
    const view =
        result === "unavailable"
            ? searchUnavailableView(input)
            : players.length
              ? searchResultsView({ ...input, players })
              : searchEmptyView(input)
    await interaction.editReply(editPayload(view, clan.options))
}

/** Routes `/link`, its guide and the stale buttons of the old DM-era guide. */
export function linkInteractions(ports: () => LinkPorts): InteractionFeature {
    return {
        name: "link",
        register(registry) {
            registry
                .command("link", (interaction) =>
                    handleLinkCommand(interaction, ports())
                )
                .button(LINK_BUTTON_PREFIX, (interaction) =>
                    handleLinkComponent(interaction, ports())
                )
                .stringSelect(LINK_BUTTON_PREFIX, (interaction) =>
                    handleLinkComponent(interaction, ports())
                )
                .modal(LINK_ID_MODAL_PREFIX, (interaction) =>
                    handleLinkIdModal(interaction, ports())
                )
                .modal(LINK_SEARCH_MODAL_PREFIX, (interaction) =>
                    handleLinkSearchModal(interaction, ports())
                )
            for (const prefix of LEGACY_BUTTON_PREFIXES)
                registry.button(prefix, (interaction) =>
                    replyStale(interaction, ports())
                )
            for (const prefix of LEGACY_SELECT_PREFIXES)
                registry.stringSelect(prefix, (interaction) =>
                    replyStale(interaction, ports())
                )
            for (const prefix of LEGACY_MODAL_PREFIXES)
                registry.modal(prefix, (interaction) =>
                    replyStale(interaction, ports())
                )
        },
    }
}

let platformEmoji: PlatformEmoji | null = null

/** The application emoji `steam`, `epicgames`, `xbox` and `playstation`, once. */
async function installedPlatformEmoji(discord: Client): Promise<PlatformEmoji> {
    if (platformEmoji) return platformEmoji
    const emojis = await discord.application?.emojis.fetch().catch(() => null)
    if (!emojis) return {}
    const find = (name: string) => {
        const emoji = emojis.find((candidate) => candidate.name === name)
        return emoji?.name ? `<:${emoji.name}:${emoji.id}>` : undefined
    }
    const found: PlatformEmoji = {}
    for (const [platform, name] of [
        ["steam", "steam"],
        ["epic", "epicgames"],
        ["xbox", "xbox"],
        ["playstation", "playstation"],
    ] as const) {
        const emoji = find(name)
        if (emoji) found[platform] = emoji
    }
    platformEmoji = found
    return found
}

const TAKEN = /already linked to another player/i

const searchClanPlayers = makeFunctionReference<"query">(
    "clanPlayerHistory:searchClanPlayers"
)

/** `/link` wired to Convex and Discord. */
export const linkFeature = linkInteractions(() => ({
    configs: guildCommandConfigs,
    accounts: async (userId) =>
        (
            (await convex.query(references.getDiscordPlatformLinkState, {
                secret: env.internalSecret,
                userId,
            })) as { platformIds?: string[] } | null
        )?.platformIds ?? [],
    link: async (input) => {
        try {
            await convex.mutation(references.linkDiscordPlatformId, {
                secret: env.internalSecret,
                userId: input.userId,
                userName: input.userName,
                userAvatar: input.userAvatar,
                platformId: input.stored,
            })
            return "linked"
        } catch (error) {
            if (error instanceof Error && TAKEN.test(error.message))
                return "taken"
            throw error
        }
    },
    unlink: async (userId, stored) =>
        (
            (await convex.mutation(references.unlinkDiscordPlatformId, {
                secret: env.internalSecret,
                userId,
                platformId: stored,
            })) as { platformIds: string[] }
        ).platformIds,
    context: async (guildId, userId) =>
        (await convex.query(references.getLinkContext, {
            secret: env.internalSecret,
            guildId,
            userId,
        })) as LinkContextRow,
    playerHistory: async (guildId, query) =>
        (await convex.query(searchClanPlayers, {
            secret: env.internalSecret,
            guildId,
            ...(query?.trim() ? { query: query.trim() } : {}),
        })) as { known: boolean; players: PreviousPlayer[] },
    emoji: () => installedPlatformEmoji(client),
    siteUrl: env.appSiteUrl,
    // The account step of the clan application (W7a, L4-60).
    continueApplication: continueApplicationAfterLink,
}))
