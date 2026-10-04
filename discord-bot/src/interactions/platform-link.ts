import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    type APIMessageComponentEmoji,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
} from "discord.js"

import {
    getClanDiscordMessages,
    type ClanLanguage,
} from "../../../src/lib/clan-language"
import {
    detectPlatformFromId,
    stripPlatformPrefix,
} from "../../../src/lib/platform-ids"

type PlatformLinkMode = "membership" | "link"
type PlatformKey = "steam" | "epic" | "xbox" | "playstation"

type PlatformLinkContext = {
    mode: PlatformLinkMode
    categoryId?: string
    gameId?: "hell_let_loose" | "hell_let_loose_vietnam" | "wardogs"
    draftId?: string
}

type PlatformEmojiMap = Partial<Record<PlatformKey, APIMessageComponentEmoji>>

const FLOW_PREFIX = "plink"
const MODAL_PREFIX = "plink-modal"
const APPLY_MODAL_PREFIX = "plink-apply"
const MOCK_APPLY_MODAL_PREFIX = "plink-mock-apply"
const SEARCH_MODAL_PREFIX = "plink-search"

const PLATFORM_GUIDES: Record<PlatformKey, string> = {
    steam: "https://help.steampowered.com/en/faqs/view/2816-BE67-5B69-0FEC",
    epic: "https://www.epicgames.com/help/c-202300000001645/c-Trending_0/what-is-an-epic-games-account-id-and-where-can-i-find-it-a202300000011535",
    xbox: "https://support.xbox.com/en-US/help/account-profile/profile/change-xbox-live-gamertag",
    playstation:
        "https://www.playstation.com/en-us/support/account/change-online-id/",
}

export function getPlatformFlowMessages(language: ClanLanguage) {
    const messages = getClanDiscordMessages(language)
    if (messages.platformFlow) {
        return messages.platformFlow
    }

    if (language === "cs") {
        const czechFallback =
            getClanDiscordMessages("en").platformFlowCsFallback
        if (czechFallback) {
            return czechFallback
        }
    }

    return getClanDiscordMessages("en").platformFlow!
}

function formatStoredPlatformId(platformId: string) {
    const platform = detectPlatformFromId(platformId)
    return {
        platform,
        rawId: stripPlatformPrefix(platformId),
    }
}

function formatEmojiForText(emoji: APIMessageComponentEmoji | undefined) {
    if (!emoji?.id || !emoji.name) {
        return ""
    }

    return `<:${emoji.name}:${emoji.id}> `
}

function decodeContext(
    mode: string,
    categoryId: string | undefined,
    gameId?: string,
    draftId?: string
): PlatformLinkContext | null {
    const parsedMode =
        mode === "membership" || mode === "m"
            ? "membership"
            : mode === "link" || mode === "l"
              ? "link"
              : undefined
    if (!parsedMode) {
        return null
    }

    const parsedGameId = decodeGameId(gameId)

    return {
        mode: parsedMode,
        ...(categoryId && categoryId !== "_" ? { categoryId } : {}),
        ...(parsedGameId ? { gameId: parsedGameId } : {}),
        ...(draftId ? { draftId } : {}),
    }
}

function decodeGameId(gameId: string | undefined) {
    return gameId === "hell_let_loose" || gameId === "h"
        ? "hell_let_loose"
        : gameId === "hell_let_loose_vietnam" || gameId === "v"
          ? "hell_let_loose_vietnam"
          : gameId === "wardogs" || gameId === "w"
            ? "wardogs"
            : undefined
}

function encodeMode(mode: PlatformLinkMode) {
    return mode === "membership" ? "m" : "l"
}

function encodeGameId(gameId: PlatformLinkContext["gameId"]) {
    switch (gameId) {
        case "hell_let_loose":
            return "h"
        case "hell_let_loose_vietnam":
            return "v"
        case "wardogs":
            return "w"
        default:
            return "_"
    }
}

function getDraftIdFromToken(token: string | undefined) {
    if (!token) return undefined
    if (token.startsWith("draft_")) return token.slice("draft_".length)
    if (token.startsWith("d_")) return token.slice("d_".length)
    return undefined
}

export function buildPlatformLinkCustomId(
    step: string,
    context: PlatformLinkContext,
    extra?: string
) {
    return [
        FLOW_PREFIX,
        step,
        encodeMode(context.mode),
        context.categoryId ?? "_",
        encodeGameId(context.gameId),
        context.draftId ? `d_${context.draftId}` : undefined,
        extra,
    ]
        .filter(Boolean)
        .join(":")
}

export function buildPlatformLinkModalId(
    context: PlatformLinkContext,
    platform: PlatformKey
) {
    return `${MODAL_PREFIX}:${encodeMode(context.mode)}:${context.categoryId ?? "_"}:${encodeGameId(context.gameId)}:${platform}${context.draftId ? `:d_${context.draftId}` : ""}`
}

export function buildPlatformLinkApplyModalId(
    categoryId: string,
    platform: PlatformKey,
    gameId?: PlatformLinkContext["gameId"]
) {
    return `${APPLY_MODAL_PREFIX}:membership:${categoryId}:${gameId ?? "_"}:${platform}`
}

export function buildPlatformLinkMockApplyModalId(
    categoryId: string,
    mockPlayerId: string,
    gameId?: PlatformLinkContext["gameId"]
) {
    return `${MOCK_APPLY_MODAL_PREFIX}:membership:${categoryId}:${gameId ?? "_"}:${mockPlayerId}`
}

export function parsePlatformLinkInteractionId(customId: string) {
    const [prefix, step, mode, categoryId, gameIdOrExtra, ...rest] =
        customId.split(":")
    if (prefix !== FLOW_PREFIX || !step || !mode) {
        return null
    }

    const hasGameId = Boolean(
        gameIdOrExtra === "_" || decodeGameId(gameIdOrExtra)
    )
    const draftToken = rest.find(
        (item) => item.startsWith("draft_") || item.startsWith("d_")
    )
    const extraParts = rest.filter((item) => item !== draftToken)
    return {
        step,
        context: decodeContext(
            mode,
            categoryId,
            hasGameId ? gameIdOrExtra : undefined,
            getDraftIdFromToken(draftToken)
        ),
        extra: hasGameId
            ? extraParts.length
                ? extraParts.join(":")
                : undefined
            : gameIdOrExtra,
    }
}

export function parsePlatformLinkModalId(customId: string) {
    const [
        prefix,
        mode,
        categoryId,
        gameIdOrPlatform,
        maybePlatform,
        draftToken,
    ] = customId.split(":")
    const platform = maybePlatform ?? gameIdOrPlatform
    if (prefix !== MODAL_PREFIX || !mode || !platform) {
        return null
    }

    if (
        platform !== "steam" &&
        platform !== "epic" &&
        platform !== "xbox" &&
        platform !== "playstation"
    ) {
        return null
    }

    return {
        context: decodeContext(
            mode,
            categoryId,
            maybePlatform ? gameIdOrPlatform : undefined,
            getDraftIdFromToken(draftToken)
        ),
        platform,
    } satisfies { context: PlatformLinkContext | null; platform: PlatformKey }
}

export function buildPlatformLinkSearchModalId(context: PlatformLinkContext) {
    return `${SEARCH_MODAL_PREFIX}:${encodeMode(context.mode)}:${context.categoryId ?? "_"}:${encodeGameId(context.gameId)}${context.draftId ? `:d_${context.draftId}` : ""}`
}

export function parsePlatformLinkSearchModalId(customId: string) {
    const [prefix, mode, categoryId, gameId, draftToken] = customId.split(":")
    if (prefix !== SEARCH_MODAL_PREFIX || !mode) {
        return null
    }

    return decodeContext(
        mode,
        categoryId,
        gameId,
        getDraftIdFromToken(draftToken)
    )
}

export function parsePlatformLinkApplyModalId(customId: string) {
    const [prefix, mode, categoryId, gameIdOrPlatform, maybePlatform] =
        customId.split(":")
    const platform = maybePlatform ?? gameIdOrPlatform
    if (
        prefix !== APPLY_MODAL_PREFIX ||
        mode !== "membership" ||
        !categoryId ||
        !platform
    ) {
        return null
    }

    if (
        platform !== "steam" &&
        platform !== "epic" &&
        platform !== "xbox" &&
        platform !== "playstation"
    ) {
        return null
    }

    return {
        categoryId,
        gameId: maybePlatform
            ? decodeContext(mode, categoryId, gameIdOrPlatform)?.gameId
            : undefined,
        platform,
    } satisfies {
        categoryId: string
        gameId?: PlatformLinkContext["gameId"]
        platform: PlatformKey
    }
}

export function parsePlatformLinkMockApplyModalId(customId: string) {
    const [prefix, mode, categoryId, gameIdOrPlayerId, maybePlayerId] =
        customId.split(":")
    const mockPlayerId = maybePlayerId ?? gameIdOrPlayerId
    if (
        prefix !== MOCK_APPLY_MODAL_PREFIX ||
        mode !== "membership" ||
        !categoryId ||
        !mockPlayerId
    ) {
        return null
    }

    return {
        categoryId,
        gameId: maybePlayerId
            ? decodeContext(mode, categoryId, gameIdOrPlayerId)?.gameId
            : undefined,
        mockPlayerId,
    }
}

export function buildPlatformLinkStartMessage(
    language: ClanLanguage,
    context: PlatformLinkContext
) {
    const messages = getPlatformFlowMessages(language)
    const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(messages.title)
        .setDescription(
            context.mode === "membership"
                ? messages.membershipIntro
                : messages.linkIntro
        )

    const components = [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(buildPlatformLinkCustomId("start", context))
                .setLabel(messages.startButton)
                .setStyle(ButtonStyle.Primary)
        ),
    ]

    return { embeds: [embed], components }
}

export function buildPlatformLinkManageMessage(input: {
    language: ClanLanguage
    platformIds: string[]
    emojis?: PlatformEmojiMap
}) {
    const messages = getPlatformFlowMessages(input.language)
    const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(messages.title)
        .setDescription(
            input.platformIds.length
                ? messages.manageDescription
                : messages.linkIntro
        )

    if (input.platformIds.length) {
        embed.addFields({
            name: messages.linkedFieldTitle,
            value: input.platformIds
                .map((platformId, index) => {
                    const formatted = formatStoredPlatformId(platformId)
                    const label =
                        formatted.platform === "steam"
                            ? messages.platformSteam
                            : formatted.platform === "epic"
                              ? messages.platformEpic
                              : formatted.platform === "xbox"
                                ? messages.platformXbox
                                : formatted.platform === "playstation"
                                  ? messages.platformPlaystation
                                  : "Platform"
                    const emoji =
                        formatted.platform === "other"
                            ? ""
                            : formatEmojiForText(
                                  input.emojis?.[formatted.platform]
                              )
                    return `${index + 1}. ${emoji}\`${formatted.rawId}\` (${label})`
                })
                .join("\n"),
        })
    }

    const addButton = new ButtonBuilder()
        .setCustomId(buildPlatformLinkCustomId("start", { mode: "link" }))
        .setLabel(
            input.platformIds.length
                ? messages.addAnotherButton
                : messages.startButton
        )
        .setStyle(ButtonStyle.Primary)

    const removeButton = new ButtonBuilder()
        .setCustomId(buildPlatformLinkCustomId("unlink", { mode: "link" }))
        .setLabel(messages.unlinkButton)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!input.platformIds.length)

    return {
        embeds: [embed],
        components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                addButton,
                removeButton
            ),
        ],
    }
}

export function buildPlayedBeforeMessage(
    language: ClanLanguage,
    context: PlatformLinkContext
) {
    const messages = getPlatformFlowMessages(language)
    const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(messages.title)
        .setDescription(messages.playedBeforePrompt)

    const menu = new StringSelectMenuBuilder()
        .setCustomId(buildPlatformLinkCustomId("played", context))
        .setPlaceholder(messages.playedBeforePlaceholder)
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(messages.playedBeforeYes)
                .setDescription(messages.playedBeforeYesDescription)
                .setValue("yes"),
            new StringSelectMenuOptionBuilder()
                .setLabel(messages.playedBeforeNo)
                .setDescription(messages.playedBeforeNoDescription)
                .setValue("no")
        )

    return {
        embeds: [embed],
        components: [
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu),
        ],
    }
}

export function buildMockPlayerMessage(
    language: ClanLanguage,
    context: PlatformLinkContext
) {
    const messages = getPlatformFlowMessages(language)
    const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(messages.title)
        .setDescription(messages.playerSearchIntro)

    const menu = new StringSelectMenuBuilder()
        .setCustomId(buildPlatformLinkCustomId("player", context))
        .setPlaceholder(messages.playerSearchPlaceholder)
        .setDisabled(true)
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(messages.playerSearchEmptyOption)
                .setDescription(messages.playerSearchEmptyDescription)
                .setValue("empty")
        )

    const button = new ButtonBuilder()
        .setCustomId(buildPlatformLinkCustomId("player-search", context))
        .setLabel(messages.playerSearchButton)
        .setStyle(ButtonStyle.Primary)

    return {
        embeds: [embed],
        components: [
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu),
            new ActionRowBuilder<ButtonBuilder>().addComponents(button),
        ],
    }
}

export function buildPlayerSearchResultsMessage(input: {
    language: ClanLanguage
    context: PlatformLinkContext
    results: Array<{
        playerId: string
        playerName: string
        description: string
        emoji?: APIMessageComponentEmoji
    }>
}) {
    const messages = getPlatformFlowMessages(input.language)
    const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(messages.title)
        .setDescription(
            input.results.length
                ? messages.playerSearchIntro
                : messages.playerSearchNoMatches
        )

    const button = new ButtonBuilder()
        .setCustomId(buildPlatformLinkCustomId("player-search", input.context))
        .setLabel(messages.playerSearchButton)
        .setStyle(ButtonStyle.Primary)

    const components: Array<
        | ActionRowBuilder<StringSelectMenuBuilder>
        | ActionRowBuilder<ButtonBuilder>
    > = []
    if (input.results.length) {
        const menu = new StringSelectMenuBuilder()
            .setCustomId(buildPlatformLinkCustomId("player", input.context))
            .setPlaceholder(messages.playerSearchPlaceholder)
            .addOptions(
                input.results.slice(0, 25).map((player) => {
                    const option = new StringSelectMenuOptionBuilder()
                        .setLabel(player.playerName.slice(0, 100))
                        .setDescription(player.description.slice(0, 100))
                        .setValue(player.playerId.slice(0, 100))
                    if (player.emoji) {
                        option.setEmoji(player.emoji)
                    }
                    return option
                })
            )
        components.push(
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)
        )
    } else {
        const menu = new StringSelectMenuBuilder()
            .setCustomId(buildPlatformLinkCustomId("player", input.context))
            .setPlaceholder(messages.playerSearchPlaceholder)
            .setDisabled(true)
            .addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel(messages.playerSearchEmptyOption)
                    .setDescription(messages.playerSearchEmptyDescription)
                    .setValue("empty")
            )
        components.push(
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)
        )
    }
    components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(button))

    return {
        embeds: [embed],
        components,
    }
}

export function buildPlatformSelectMessageWithEmojis(input: {
    language: ClanLanguage
    context: PlatformLinkContext
    emojis?: PlatformEmojiMap
}) {
    const { language, context, emojis } = input
    const messages = getPlatformFlowMessages(language)
    const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(messages.title)
        .setDescription(messages.platformIntro)

    const steam = new StringSelectMenuOptionBuilder()
        .setLabel(messages.platformSteam)
        .setValue("steam")
    const epic = new StringSelectMenuOptionBuilder()
        .setLabel(messages.platformEpic)
        .setValue("epic")
    const xbox = new StringSelectMenuOptionBuilder()
        .setLabel(messages.platformXbox)
        .setValue("xbox")
    const playstation = new StringSelectMenuOptionBuilder()
        .setLabel(messages.platformPlaystation)
        .setValue("playstation")
    if (emojis?.steam) {
        steam.setEmoji(emojis.steam)
    }
    if (emojis?.epic) {
        epic.setEmoji(emojis.epic)
    }
    if (emojis?.xbox) {
        xbox.setEmoji(emojis.xbox)
    }
    if (emojis?.playstation) {
        playstation.setEmoji(emojis.playstation)
    }

    const menu = new StringSelectMenuBuilder()
        .setCustomId(buildPlatformLinkCustomId("platform", context))
        .setPlaceholder(messages.platformPlaceholder)
        .addOptions(steam, epic, xbox, playstation)

    return {
        embeds: [embed],
        components: [
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu),
        ],
    }
}

export function buildUnlinkPlatformMessage(input: {
    language: ClanLanguage
    platformIds: string[]
    emojis?: PlatformEmojiMap
}) {
    const messages = getPlatformFlowMessages(input.language)
    const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(messages.title)
        .setDescription(messages.unlinkPrompt)

    const menu = new StringSelectMenuBuilder()
        .setCustomId(
            buildPlatformLinkCustomId("unlink-select", { mode: "link" })
        )
        .setPlaceholder(messages.unlinkPlaceholder)
        .addOptions(
            input.platformIds.slice(0, 25).map((platformId) => {
                const formatted = formatStoredPlatformId(platformId)
                const option = new StringSelectMenuOptionBuilder()
                    .setLabel(stripPlatformPrefix(platformId).slice(0, 100))
                    .setDescription(
                        (formatted.platform === "other"
                            ? "platform"
                            : formatted.platform
                        ).slice(0, 100)
                    )
                    .setValue(platformId)

                const emoji =
                    formatted.platform === "other"
                        ? undefined
                        : input.emojis?.[formatted.platform]
                if (emoji) {
                    option.setEmoji(emoji)
                }
                return option
            })
        )

    return {
        embeds: [embed],
        components: [
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu),
        ],
    }
}

function getPlatformGuideCopy(language: ClanLanguage, platform: PlatformKey) {
    const messages = getPlatformFlowMessages(language)
    switch (platform) {
        case "steam":
            return messages.guides.steam
        case "epic":
            return messages.guides.epic
        case "xbox":
            return messages.guides.xbox
        case "playstation":
            return messages.guides.playstation
    }
}

export function buildPlatformGuideMessage(
    language: ClanLanguage,
    context: PlatformLinkContext,
    platform: PlatformKey,
    emojis?: PlatformEmojiMap
) {
    const messages = getPlatformFlowMessages(language)
    const copy = getPlatformGuideCopy(language, platform)
    const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(messages.title)
        .setDescription(
            [
                `${copy.label}`,
                copy.help,
                "",
                `1. ${copy.stepOne}`,
                `2. ${copy.stepTwo}`,
                `3. ${copy.stepThree}`,
                "",
                `${messages.guideLinkLabel}: ${PLATFORM_GUIDES[platform]}`,
            ].join("\n")
        )

    const button = new ButtonBuilder()
        .setCustomId(buildPlatformLinkCustomId("manual", context, platform))
        .setLabel(
            context.mode === "membership"
                ? messages.continueWithIdButton
                : messages.submitIdButton
        )
        .setStyle(ButtonStyle.Primary)

    const emoji = emojis?.[platform]
    if (emoji) {
        button.setEmoji(emoji)
    }

    return {
        embeds: [embed],
        components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(button),
        ],
    }
}
