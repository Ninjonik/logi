/**
 * The `/link` cards (boards L4 1.5 and M3 1.2) as {@link MessageView}s: the
 * private guide that links a game account, the "Hrál jsi u nás?" search,
 * the linked accounts with unlinking, and its errors. Every card is private,
 * in the clan colour and the clan language, labelled "Herní účty". The
 * guide is one private message updated in place; the same steps run inside
 * the clan application, where the guide's button reads "Zadat ID a
 * pokračovat" (L4-60). Pure: copy, links and emoji come in.
 */

import {
    errorCard,
    escapeMarkdownText,
    type MessageBlock,
    type MessageButton,
    type MessageView,
} from "../discord-messages/message-view"
import {
    GAME_ACCOUNT_PLATFORMS,
    isGameAccountPlatform,
    readStoredGameAccount,
    type GameAccountPlatform,
} from "./platform-id"
import { fillTemplate } from "../discord-messages/format"
import type { GameAccountCopy } from "./account-copy"

/** Where the guide runs: `/link`, or the account step of an application draft. */
export type LinkFlowContext =
    { kind: "link" } | { kind: "application"; draftId: string }

export const LINK_BUTTON_PREFIX = "link:"
export const LINK_ID_MODAL_PREFIX = "link-modal:"
export const LINK_SEARCH_MODAL_PREFIX = "link-search:"

export type LinkFlowStep =
    | "start"
    | "platform"
    | "played"
    | "enter"
    | "back"
    | "search"
    | "manual"
    | "pick"
    | "unlink"
    | "unlink-pick"
    | "accounts"

const STEPS: ReadonlySet<string> = new Set<LinkFlowStep>([
    "start",
    "platform",
    "played",
    "enter",
    "back",
    "search",
    "manual",
    "pick",
    "unlink",
    "unlink-pick",
    "accounts",
])
const DRAFT_ID = /^[A-Za-z0-9_-]{1,64}$/

function encodeContext(context: LinkFlowContext) {
    return context.kind === "application" ? `a.${context.draftId}` : "l"
}

function decodeContext(token: string | undefined): LinkFlowContext | null {
    if (token === "l") return { kind: "link" }
    if (token?.startsWith("a.")) {
        const draftId = token.slice(2)
        return DRAFT_ID.test(draftId) ? { kind: "application", draftId } : null
    }
    return null
}

/** The custom ID of a guide button or select, e.g. `link:l:enter:steam`. */
export function linkFlowId(
    context: LinkFlowContext,
    step: LinkFlowStep,
    platform?: GameAccountPlatform
) {
    return [LINK_BUTTON_PREFIX.slice(0, -1), encodeContext(context), step]
        .concat(platform ? [platform] : [])
        .join(":")
}

/** Reads a guide button or select ID; null for anything stale or foreign. */
export function parseLinkFlowId(customId: string) {
    const [prefix, token, step, platform, ...rest] = customId.split(":")
    const context = decodeContext(token)
    if (
        prefix !== "link" ||
        !context ||
        !step ||
        !STEPS.has(step) ||
        rest.length
    )
        return null
    if (platform !== undefined && !isGameAccountPlatform(platform)) return null
    if (step === "enter" && !platform) return null
    return {
        context,
        step: step as LinkFlowStep,
        platform: platform as GameAccountPlatform | undefined,
    }
}

/** The ID window of a platform: `link-modal:l:steam`. */
export function linkIdModalId(
    context: LinkFlowContext,
    platform: GameAccountPlatform
) {
    return `${LINK_ID_MODAL_PREFIX}${encodeContext(context)}:${platform}`
}

export function parseLinkIdModalId(customId: string) {
    if (!customId.startsWith(LINK_ID_MODAL_PREFIX)) return null
    const [token, platform, ...rest] = customId
        .slice(LINK_ID_MODAL_PREFIX.length)
        .split(":")
    const context = decodeContext(token)
    if (!context || !isGameAccountPlatform(platform) || rest.length) return null
    return { context, platform }
}

/** The search window: `link-search:l`. */
export function linkSearchModalId(context: LinkFlowContext) {
    return `${LINK_SEARCH_MODAL_PREFIX}${encodeContext(context)}`
}

export function parseLinkSearchModalId(customId: string) {
    if (!customId.startsWith(LINK_SEARCH_MODAL_PREFIX)) return null
    return decodeContext(customId.slice(LINK_SEARCH_MODAL_PREFIX.length))
}

/** Installed application emoji per platform (`<:steam:123…>`), if any. */
export type PlatformEmoji = Partial<Record<GameAccountPlatform, string>>

type ViewInput = {
    copy: GameAccountCopy
    context: LinkFlowContext
    emoji?: PlatformEmoji
}

function card(
    header: MessageView["header"],
    blocks: MessageBlock[]
): MessageView {
    return { accent: "clan", ephemeral: true, header, blocks }
}

function platformName(copy: GameAccountCopy, platform: string) {
    return isGameAccountPlatform(platform)
        ? copy.platforms[platform].name
        : copy.otherPlatform
}

/** "**Steam** · 76561198000000017" with the platform's emoji when installed. */
export function linkedAccountRow(
    copy: GameAccountCopy,
    stored: string,
    emoji: PlatformEmoji = {}
) {
    const account = readStoredGameAccount(stored)
    const icon =
        account.platform === "other" ? undefined : emoji[account.platform]
    return [
        icon,
        `**${escapeMarkdownText(platformName(copy, account.platform))}** · ${escapeMarkdownText(account.id)}`,
    ]
        .filter(Boolean)
        .join(" ")
}

/**
 * "Propoj svůj herní účet" (L4-46..48): what linking does, the platform
 * select with each ID's name, the note that it is a declaration, not proof,
 * and "Ověřit Steam na webu" to the verified Steam flow on Logi.
 */
export function linkStartView(
    input: ViewInput & { verifySteamUrl?: string }
): MessageView {
    const { copy, context } = input
    return card({ label: copy.label, title: copy.start.title }, [
        { kind: "text", markdown: copy.start.body },
        {
            kind: "select",
            select: {
                id: linkFlowId(context, "platform"),
                placeholder: copy.start.platformPlaceholder,
                options: GAME_ACCOUNT_PLATFORMS.map((platform) => ({
                    value: platform,
                    label: copy.platforms[platform].name,
                    description: copy.platforms[platform].option,
                    ...(input.emoji?.[platform]
                        ? { emoji: input.emoji[platform] }
                        : {}),
                })),
            },
        },
        { kind: "text", markdown: copy.start.declaration },
        ...(input.verifySteamUrl
            ? [
                  {
                      kind: "buttons" as const,
                      buttons: [
                          {
                              kind: "link" as const,
                              url: input.verifySteamUrl,
                              label: copy.start.verifySteam,
                          },
                      ],
                  },
              ]
            : []),
    ])
}

/** "Hrál jsi už na serverech klanu?" (L4-49), only with stats servers (L4-B08). */
export function playedBeforeView(input: ViewInput): MessageView {
    const { copy } = input
    return card({ label: copy.label, title: copy.playedBefore.title }, [
        {
            kind: "select",
            select: {
                id: linkFlowId(input.context, "played"),
                placeholder: copy.playedBefore.placeholder,
                options: [
                    {
                        value: "yes",
                        label: copy.playedBefore.yes,
                        description: copy.playedBefore.yesDescription,
                    },
                    {
                        value: "no",
                        label: copy.playedBefore.no,
                        description: copy.playedBefore.noDescription,
                    },
                ],
            },
        },
    ])
}

/** A player found on the clan's servers. */
export type FoundPlayer = {
    /** The provider's player ID, stored as the account. */
    playerId: string
    name: string
    platform: GameAccountPlatform | "other"
    /** "so 3. 10.", already in the clan's language and zone. */
    lastSeen?: string
    server?: string
}

/** "Steam · naposledy so 3. 10. na Vlci #1" under a found name. */
export function foundPlayerDescription(
    copy: GameAccountCopy,
    player: FoundPlayer
) {
    const seen = player.lastSeen
        ? player.server
            ? fillTemplate(copy.search.lastSeenOn, {
                  date: player.lastSeen,
                  server: player.server,
              })
            : fillTemplate(copy.search.lastSeen, { date: player.lastSeen })
        : undefined
    return [platformName(copy, player.platform), seen]
        .filter(Boolean)
        .join(" · ")
        .slice(0, 100)
}

const oneLine = (value: string) => value.replace(/[\s\p{Cc}]+/gu, " ").trim()

/**
 * "Vyber se ze seznamu" (L4-51): the people found, "Hráči, kteří hráli na
 * serverech klanu.", "Hledat znovu" and "Zadat ID ručně".
 */
export function searchResultsView(
    input: ViewInput & { players: readonly FoundPlayer[] }
): MessageView {
    const { copy, context } = input
    const seen = new Set<string>()
    const players = input.players.filter((player) => {
        const value = player.playerId.slice(0, 100)
        if (!value || seen.has(value)) return false
        seen.add(value)
        return true
    })
    return card({ label: copy.label, title: copy.search.resultsTitle }, [
        {
            kind: "select",
            select: {
                id: linkFlowId(context, "pick"),
                placeholder: copy.search.resultsPlaceholder,
                options: players.slice(0, 25).map((player) => ({
                    value: player.playerId.slice(0, 100),
                    label: oneLine(player.name).slice(0, 100) || "?",
                    description: foundPlayerDescription(copy, player),
                    ...(player.platform !== "other" &&
                    input.emoji?.[player.platform]
                        ? { emoji: input.emoji[player.platform] }
                        : {}),
                })),
            },
        },
        { kind: "text", markdown: copy.search.resultsNote },
        { kind: "buttons", buttons: searchButtons(input) },
    ])
}

function searchButtons(input: ViewInput): MessageButton[] {
    return [
        {
            kind: "action",
            id: linkFlowId(input.context, "search"),
            label: input.copy.search.searchAgain,
            style: "secondary",
        },
        {
            kind: "action",
            id: linkFlowId(input.context, "manual"),
            label: input.copy.search.enterManually,
            style: "secondary",
        },
    ]
}

/** "Na serverech klanu jsme tě nenašli" (L4-57) with both ways on. */
export function searchEmptyView(input: ViewInput): MessageView {
    return card({ title: input.copy.search.noneTitle }, [
        { kind: "text", markdown: input.copy.search.noneBody },
        { kind: "buttons", buttons: searchButtons(input) },
    ])
}

/** The stats servers did not answer: the search is off for now, the ID still works. */
export function searchUnavailableView(input: ViewInput): MessageView {
    return card({ title: input.copy.search.unavailableTitle }, [
        { kind: "text", markdown: input.copy.search.unavailableBody },
        {
            kind: "buttons",
            buttons: [searchButtons(input)[1]!],
        },
    ])
}

/**
 * "Najdi své Steam64 ID" (L4-52): what the ID looks like, three steps,
 * "Zadat Steam64 ID" (or "Zadat ID a pokračovat" in the application), the
 * platform's "Návod" and "Zpět".
 */
export function guideView(
    input: ViewInput & {
        platform: GameAccountPlatform
        guideUrl?: string
    }
): MessageView {
    const { copy, context, platform } = input
    const platformCopy = copy.platforms[platform]
    const enter: MessageButton = {
        kind: "action",
        id: linkFlowId(context, "enter", platform),
        label:
            context.kind === "application"
                ? copy.guide.continueApplication
                : platformCopy.enter,
        style: "primary",
        ...(input.emoji?.[platform] ? { emoji: input.emoji[platform] } : {}),
    }
    return card(
        {
            label: fillTemplate(copy.platformLabel, {
                platform: platformCopy.name,
            }),
            title: platformCopy.guideTitle,
        },
        [
            { kind: "text", markdown: platformCopy.guideHelp },
            { kind: "list", marker: "number", items: [...platformCopy.steps] },
            {
                kind: "buttons",
                buttons: [
                    enter,
                    ...(input.guideUrl
                        ? [
                              {
                                  kind: "link" as const,
                                  url: input.guideUrl,
                                  label: copy.guide.guideLink,
                              },
                          ]
                        : []),
                ],
            },
            {
                kind: "buttons",
                buttons: [
                    {
                        kind: "action",
                        id: linkFlowId(context, "back"),
                        label: copy.guide.back,
                        style: "secondary",
                    },
                ],
            },
        ]
    )
}

/**
 * The linked accounts (L4-54) or, right after linking, "Steam je
 * propojený" (M3-09): one row per account, "Přidat další účet" and the red
 * "Odpojit účet".
 */
export function linkedAccountsView(
    input: ViewInput & {
        accounts: readonly string[]
        /** The platform just linked; the success title replaces the chip. */
        justLinked?: GameAccountPlatform
    }
): MessageView {
    const { copy, context } = input
    const first = input.accounts[0]
        ? readStoredGameAccount(input.accounts[0])
        : undefined
    const header: MessageView["header"] = input.justLinked
        ? {
              label: copy.label,
              title: fillTemplate(copy.linked.successTitle, {
                  platform: copy.platforms[input.justLinked].name,
              }),
          }
        : {
              label: copy.label,
              title: copy.linked.title,
              chips: first
                  ? [
                        {
                            label: fillTemplate(copy.linked.chip, {
                                platform: platformName(copy, first.platform),
                            }),
                            tone: "success",
                        },
                    ]
                  : [],
          }
    return card(header, [
        ...(input.justLinked
            ? [{ kind: "text" as const, markdown: copy.linked.successBody }]
            : []),
        {
            kind: "text",
            markdown: input.accounts
                .map((stored) => linkedAccountRow(copy, stored, input.emoji))
                .join("\n"),
        },
        { kind: "separator", divider: true, spacing: "small" },
        {
            kind: "buttons",
            buttons: [
                {
                    kind: "action",
                    id: linkFlowId(context, "start"),
                    label: copy.linked.addAnother,
                    style: "primary",
                },
                {
                    kind: "action",
                    id: linkFlowId(context, "unlink"),
                    label: copy.linked.unlink,
                    style: "danger",
                },
            ],
        },
    ])
}

/**
 * "Který účet odpojit?" (L4-55): each account with what unlinking it
 * changes; an account the person's open application uses says so (L4-B09).
 */
export function unlinkView(
    input: ViewInput & {
        accounts: readonly string[]
        usedByApplication: ReadonlySet<string>
    }
): MessageView {
    const { copy, context } = input
    return card({ label: copy.label, title: copy.unlink.title }, [
        {
            kind: "select",
            select: {
                id: linkFlowId(context, "unlink-pick"),
                placeholder: copy.unlink.placeholder,
                options: input.accounts.slice(0, 25).map((stored) => {
                    const account = readStoredGameAccount(stored)
                    return {
                        value: stored.slice(0, 100),
                        label: `${platformName(copy, account.platform)} · ${oneLine(account.id)}`.slice(
                            0,
                            100
                        ),
                        description: input.usedByApplication.has(stored)
                            ? copy.unlink.usedByApplication
                            : copy.unlink.statsStop,
                        ...(account.platform !== "other" &&
                        input.emoji?.[account.platform]
                            ? { emoji: input.emoji[account.platform] }
                            : {}),
                    }
                }),
            },
        },
        {
            kind: "buttons",
            buttons: [
                {
                    kind: "action",
                    id: linkFlowId(context, "accounts"),
                    label: copy.unlink.back,
                    style: "secondary",
                },
            ],
        },
    ])
}

/**
 * "Tohle nevypadá jako Steam64 ID" (L4-56, M3-11): what the ID looks like
 * and the one button "Zadat znovu". An error card has at most one button
 * (M3-05), so the platform's guide is a link in the text, "Najdeš ho podle
 * [návodu](…)", instead of L4's second "Návod" button (lead resolution).
 */
export function invalidIdView(
    input: ViewInput & { platform: GameAccountPlatform; guideUrl?: string }
): MessageView {
    const platformCopy = input.copy.platforms[input.platform]
    const guide = input.copy.guide.guideInline
    const url = input.guideUrl && safeLinkUrl(input.guideUrl)
    return errorCard({
        title: platformCopy.invalidTitle,
        body: fillTemplate(platformCopy.invalidBody, {
            guide: url ? `[${escapeMarkdownText(guide)}](${url})` : guide,
        }),
        action: {
            kind: "action",
            id: linkFlowId(input.context, "enter", input.platform),
            label: input.copy.errors.retry,
            style: "primary",
        },
    })
}

/** A guide URL fit for a Markdown link: https only, nothing that ends it. */
function safeLinkUrl(value: string) {
    try {
        const url = new URL(value)
        return url.protocol === "https:" && !/[()\s<>]/.test(url.href)
            ? url.href
            : undefined
    } catch {
        return undefined
    }
}

/** The ID belongs to another player in Logi. */
export function takenIdView(
    input: ViewInput & { platform: GameAccountPlatform }
): MessageView {
    return errorCard({
        title: input.copy.errors.takenTitle,
        body: input.copy.errors.takenBody,
        action: {
            kind: "action",
            id: linkFlowId(input.context, "enter", input.platform),
            label: input.copy.errors.retry,
            style: "primary",
        },
    })
}

/** "Tahle nabídka už neplatí" / "Spusť /link znovu." (L4-58, M3-12). */
export function staleLinkView(copy: GameAccountCopy): MessageView {
    return errorCard({
        title: copy.errors.staleTitle,
        body: copy.errors.staleBody,
    })
}
