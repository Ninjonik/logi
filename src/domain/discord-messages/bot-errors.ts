/**
 * The errors channel (board L5 1.1): what the bot could not do, in the clan
 * language and without internal names. Every entry says what failed (the
 * title), what it concerns (the context line), why ("Proč") and what to do
 * ("Co udělat"), with a chip saying whether the bot retries by itself. The
 * bar is the neutral grey of system messages; raw error text, codes,
 * internal steps and record IDs never reach the card (L5-16, L5-B04).
 *
 * Pure: the bot adapter (`discord-bot/src/error-reporting.ts`) classifies
 * the Discord answer, works out the missing permission or the role above
 * the bot and passes the facts in; this module only decides the words.
 */

import {
    escapeMarkdownText,
    type MessageButton,
    type MessageChip,
    type MessageView,
} from "./message-view"
import {
    discordWeekdayTimestamp,
    fillTemplate,
    formatCount,
    type PluralForms,
} from "./format"

// --- Where the bot reports from (L5-17..25) ---------------------------------

export const BOT_ERROR_SOURCES = [
    "announcement",
    "roster",
    "forumCreate",
    "forumUpdate",
    "forumAccess",
    "eventRoles",
    "scheduledEventCreate",
    "scheduledEventUpdate",
    "scheduledEventCancel",
    "memberRoles",
    "adminAccess",
    "ticketPanel",
    "applicationPanel",
    "calendarPanel",
    "publicPanel",
    "attendanceReminders",
    "ticketOpen",
    "ticketSupport",
    "ticketIntro",
    "ticketRename",
    "applicationOpen",
    "applicationRecruiters",
    "applicationIntro",
    "applicationRename",
    "playerReport",
    "panelPassword",
    "seedControl",
    "general",
] as const

export type BotErrorSource = (typeof BOT_ERROR_SOURCES)[number]

/** The second half of the label "CHYBA BOTA · ZÁPAS". */
export type BotErrorArea =
    | "match"
    | "forum"
    | "eventRoles"
    | "scheduledEvent"
    | "memberRoles"
    | "panels"
    | "reminders"
    | "tickets"
    | "applications"
    | "playerReports"
    | "seed"

/**
 * `sync`: the bot retries at its next synchronisation; `interaction`: a
 * person clicked and got a short private answer, so the bot does not retry;
 * `background`: a later step of something that already worked (the ticket
 * is open, the decision is saved), so nobody was told to retry and the bot
 * does not try again.
 */
export type BotErrorFlow = "sync" | "interaction" | "background"

/** The sentence after "Co udělat" that says what happens once fixed. */
export type BotErrorFollowUp =
    | "announcement"
    | "roster"
    | "forum"
    | "eventRoles"
    | "scheduledEvent"
    | "memberRoles"
    | "panel"
    | "reminders"
    | "ticket"
    | "application"
    | "playerReport"
    | "ticketSupport"
    | "ticketIntro"
    | "ticketRename"
    | "applicationRecruiters"
    | "applicationIntro"
    | "applicationRename"
    | "panelPassword"
    | "seedControl"

/** Logi pages an entry can link to (L5-11..14). */
export type BotErrorLink =
    | "match"
    | "channels"
    | "tickets"
    | "roles"
    | "membership"
    | "panels"
    | "seed"

/**
 * Discord permissions the bot needs, by their discord.js flag name. The
 * adapter checks them; the card names them as Discord shows them.
 */
export const BOT_PERMISSIONS = [
    "ViewChannel",
    "SendMessages",
    "SendMessagesInThreads",
    "EmbedLinks",
    "AttachFiles",
    "ReadMessageHistory",
    "ManageChannels",
    "ManageRoles",
    "ManageThreads",
    "ManageMessages",
    "CreatePublicThreads",
    "CreatePrivateThreads",
    "ManageEvents",
    "Connect",
] as const

export type BotPermission = (typeof BOT_PERMISSIONS)[number]

export type BotErrorSourceSpec = {
    area?: BotErrorArea
    flow: BotErrorFlow
    followUp?: BotErrorFollowUp
    links: readonly BotErrorLink[]
    /** What the action needs; checked in the channel, else on the server. */
    permissions: readonly BotPermission[]
    /**
     * A notice that is not a Discord answer (the panel password was hidden,
     * the seed control channel is public) always has this class.
     */
    failure?: BotFailureClass
}

const MESSAGE: readonly BotPermission[] = [
    "ViewChannel",
    "SendMessages",
    "EmbedLinks",
    "AttachFiles",
    "ReadMessageHistory",
]
const PRIVATE_THREAD: readonly BotPermission[] = [
    "ViewChannel",
    "CreatePrivateThreads",
    "SendMessagesInThreads",
]
const IN_THREAD: readonly BotPermission[] = [
    "ViewChannel",
    "SendMessagesInThreads",
    "EmbedLinks",
]

export const BOT_ERROR_SOURCE_SPECS: Record<
    BotErrorSource,
    BotErrorSourceSpec
> = {
    announcement: {
        area: "match",
        flow: "sync",
        followUp: "announcement",
        links: ["match", "channels"],
        permissions: MESSAGE,
    },
    roster: {
        area: "match",
        flow: "sync",
        followUp: "roster",
        links: ["match", "channels"],
        permissions: MESSAGE,
    },
    forumCreate: {
        area: "forum",
        flow: "sync",
        followUp: "forum",
        links: ["match", "channels"],
        permissions: ["ViewChannel", "ManageChannels", "ManageRoles"],
    },
    forumUpdate: {
        area: "forum",
        flow: "sync",
        followUp: "forum",
        links: ["match", "channels"],
        permissions: [
            "ViewChannel",
            "ManageChannels",
            "SendMessages",
            "ManageThreads",
            "EmbedLinks",
            "AttachFiles",
        ],
    },
    forumAccess: {
        area: "forum",
        flow: "sync",
        followUp: "forum",
        links: ["match", "channels"],
        permissions: ["ViewChannel", "ManageChannels", "ManageRoles"],
    },
    eventRoles: {
        area: "eventRoles",
        flow: "sync",
        followUp: "eventRoles",
        links: ["match", "roles"],
        permissions: ["ManageRoles"],
    },
    scheduledEventCreate: {
        area: "scheduledEvent",
        flow: "sync",
        followUp: "scheduledEvent",
        links: ["match", "channels"],
        permissions: ["ViewChannel", "Connect", "ManageEvents"],
    },
    scheduledEventUpdate: {
        area: "scheduledEvent",
        flow: "sync",
        followUp: "scheduledEvent",
        links: ["match", "channels"],
        permissions: ["ViewChannel", "Connect", "ManageEvents"],
    },
    scheduledEventCancel: {
        area: "scheduledEvent",
        flow: "sync",
        followUp: "scheduledEvent",
        links: ["match", "channels"],
        permissions: ["ManageEvents"],
    },
    memberRoles: {
        area: "memberRoles",
        flow: "sync",
        followUp: "memberRoles",
        links: ["roles"],
        permissions: ["ManageRoles"],
    },
    adminAccess: {
        area: "memberRoles",
        flow: "sync",
        followUp: "memberRoles",
        links: ["roles"],
        permissions: [],
    },
    ticketPanel: {
        area: "panels",
        flow: "sync",
        followUp: "panel",
        links: ["tickets"],
        permissions: MESSAGE,
    },
    applicationPanel: {
        area: "panels",
        flow: "sync",
        followUp: "panel",
        links: ["membership"],
        permissions: MESSAGE,
    },
    calendarPanel: {
        area: "panels",
        flow: "sync",
        followUp: "panel",
        links: ["channels"],
        permissions: MESSAGE,
    },
    publicPanel: {
        area: "panels",
        flow: "sync",
        followUp: "panel",
        links: [],
        permissions: MESSAGE,
    },
    attendanceReminders: {
        area: "reminders",
        flow: "sync",
        followUp: "reminders",
        links: ["match"],
        permissions: [],
    },
    ticketOpen: {
        area: "tickets",
        flow: "interaction",
        followUp: "ticket",
        links: ["tickets"],
        permissions: PRIVATE_THREAD,
    },
    ticketSupport: {
        area: "tickets",
        flow: "background",
        followUp: "ticketSupport",
        links: ["tickets"],
        permissions: ["ViewChannel", "SendMessagesInThreads"],
    },
    ticketIntro: {
        area: "tickets",
        flow: "background",
        followUp: "ticketIntro",
        links: ["tickets"],
        permissions: IN_THREAD,
    },
    ticketRename: {
        area: "tickets",
        flow: "background",
        followUp: "ticketRename",
        links: ["tickets"],
        permissions: ["ViewChannel", "ManageThreads"],
    },
    applicationOpen: {
        area: "applications",
        flow: "interaction",
        followUp: "application",
        links: ["membership"],
        permissions: PRIVATE_THREAD,
    },
    applicationRecruiters: {
        area: "applications",
        flow: "background",
        followUp: "applicationRecruiters",
        links: ["membership"],
        permissions: ["ViewChannel", "SendMessagesInThreads"],
    },
    applicationIntro: {
        area: "applications",
        flow: "background",
        followUp: "applicationIntro",
        links: ["membership"],
        permissions: IN_THREAD,
    },
    applicationRename: {
        area: "applications",
        flow: "background",
        followUp: "applicationRename",
        links: ["membership"],
        permissions: ["ViewChannel", "ManageThreads"],
    },
    playerReport: {
        area: "playerReports",
        flow: "interaction",
        followUp: "playerReport",
        links: ["tickets"],
        permissions: PRIVATE_THREAD,
    },
    panelPassword: {
        area: "panels",
        flow: "sync",
        followUp: "panelPassword",
        links: ["panels"],
        permissions: [],
        failure: "channelPublic",
    },
    seedControl: {
        area: "seed",
        flow: "sync",
        followUp: "seedControl",
        links: ["seed"],
        permissions: [],
        failure: "channelPublic",
    },
    general: { flow: "sync", links: [], permissions: [] },
}

export function isBotErrorSource(value: unknown): value is BotErrorSource {
    return BOT_ERROR_SOURCES.includes(value as BotErrorSource)
}

// --- What Discord answered (L5-26..32) --------------------------------------

/** The parts of a Discord or network error the classification reads. */
export type DiscordFailure = {
    /** Discord's JSON error code (50013) or a Node network code (`ETIMEDOUT`). */
    code?: number | string | null
    /** The HTTP status of the request, when there was one. */
    status?: number | null
    name?: string | null
    message?: string | null
}

export const BOT_FAILURE_CLASSES = [
    "missingPermission",
    "missingAccess",
    "unknownChannel",
    "unknownRole",
    "roleAbove",
    "fullCategory",
    "fullServer",
    "wrongChannelType",
    "channelPublic",
    "timeout",
    "other",
] as const

export type BotFailureClass = (typeof BOT_FAILURE_CLASSES)[number]

const NETWORK_TIMEOUTS = new Set([
    "ETIMEDOUT",
    "ECONNRESET",
    "ECONNREFUSED",
    "EAI_AGAIN",
    "UND_ERR_CONNECT_TIMEOUT",
    "UND_ERR_SOCKET",
    "ABORT_ERR",
])

/**
 * The error class of a Discord answer: missing permission (50013), missing
 * access (50001), unknown channel (10003), unknown role (10011), a full
 * category (50 channels) or server (500 channels, 30013), a timeout or
 * server error, or anything else. A role above the bot is answered as a
 * missing permission; the adapter refines that with the role positions.
 */
export function classifyDiscordFailure(
    failure: DiscordFailure
): BotFailureClass {
    const code = failure.code
    const message = failure.message ?? ""
    if (code === 50013) return "missingPermission"
    if (code === 50001) return "missingAccess"
    if (code === 10003) return "unknownChannel"
    if (code === 10011) return "unknownRole"
    if (code === 30013) return "fullServer"
    if (/maximum number of channels in category/i.test(message))
        return "fullCategory"
    if (/maximum number of (guild )?channels/i.test(message))
        return "fullServer"
    if (typeof code === "string" && NETWORK_TIMEOUTS.has(code)) return "timeout"
    if (failure.name === "AbortError" || failure.name === "TimeoutError")
        return "timeout"
    if (typeof failure.status === "number" && failure.status >= 500)
        return "timeout"
    if (/timed? ?out|aborted/i.test(message)) return "timeout"
    return "other"
}

/** Problems an admin fixes in Discord or Logi; the rest pass by themselves. */
const FIXABLE: ReadonlySet<BotFailureClass> = new Set([
    "missingPermission",
    "missingAccess",
    "unknownChannel",
    "unknownRole",
    "roleAbove",
    "fullCategory",
    "fullServer",
    "wrongChannelType",
    "channelPublic",
])

/** Whether an admin must fix the failure in Discord or Logi. */
export function isAdminFixableFailure(failure: BotFailureClass) {
    return FIXABLE.has(failure)
}

export type BotErrorRetry =
    "afterFix" | "byItself" | "playerTold" | "notRetried"

/**
 * The retry chip (L5-B03): a person who clicked was told to try later; a
 * later step of something that already worked is not tried again; the bot
 * retries a sync after a fix, or by itself when Discord only failed to
 * answer.
 */
export function botErrorRetry(
    source: BotErrorSource,
    failure: BotFailureClass
): BotErrorRetry {
    const flow = BOT_ERROR_SOURCE_SPECS[source].flow
    if (flow === "interaction") return "playerTold"
    if (flow === "background") return "notRetried"
    return FIXABLE.has(failure) ? "afterFix" : "byItself"
}

// --- Copy -----------------------------------------------------------------------

/** The errors channel's words in the clan language (`clan-language/system.ts`). */
export type BotErrorsCopy = {
    /** "Chyba bota" — the label without an area. */
    label: string
    /** "Chyba bota · {area}". */
    labelWithArea: string
    areas: Record<BotErrorArea, string>
    /** What failed; `memberRoles` takes `{count}` forms. */
    titles: Record<Exclude<BotErrorSource, "memberRoles">, string>
    memberRolesTitle: PluralForms
    reasonHeading: string
    fixHeading: string
    retry: Record<BotErrorRetry, string>
    reasons: {
        missingPermission: string
        missingPermissionServer: string
        missingPermissionUnknown: string
        privateThreads: string
        missingAccess: string
        unknownChannel: string
        unknownRole: string
        roleAbove: string
        fullCategory: string
        fullServer: string
        wrongChannelType: string
        /** The panel password was hidden: the channel is public (P4-30). */
        panelPasswordPublic: string
        /** The seed controls were not posted: the channel is public. */
        seedControlPublic: string
        timeout: string
        other: string
    }
    fixes: {
        missingPermissionSync: string
        missingPermissionInteraction: string
        missingPermissionServer: string
        missingPermissionGeneric: string
        missingPermissionUnknown: string
        missingAccess: string
        unknownChannel: string
        unknownRole: string
        roleAbove: string
        fullCategoryForum: string
        fullCategory: string
        fullServer: string
        wrongChannelType: string
        panelPasswordPublic: string
        seedControlPublic: string
        timeoutSync: string
        timeoutInteraction: string
        /** A later step: Discord did not answer; said after the follow-up. */
        timeoutBackground: string
        other: string
        /** A later step Discord refused; said after the follow-up. */
        otherBackground: string
    }
    followUps: Record<BotErrorFollowUp, string>
    context: {
        channel: string
        category: string
        role: string
        meetingChannel: string
        tried: string
        /** The ticket's author on an entry about a later step. */
        author: string
        applicant: string
        /** "Panel {panel}". */
        panel: string
        ticketNumber: string
        applicationNumber: string
        moreMembers: string
        players: PluralForms
    }
    /** Words for an unnamed thing, e.g. "nastavený v Logi" (the channel). */
    unnamed: { channel: string; category: string; role: string }
    /** "a": joins the last two names of a list. */
    and: string
    links: Record<BotErrorLink, string>
    permissions: Record<BotPermission, string>
}

// --- The card -----------------------------------------------------------------

/** What the adapter found out about the failure, already as markdown. */
export type BotErrorFacts = {
    failure: BotFailureClass
    /** `<#id>` or `#name` of the channel the action needed. */
    channel?: string
    /** The category name (plain). */
    category?: string
    /** `<@&id>` of the role concerned. */
    role?: string
    /** Permissions the bot lacks in the channel or on the server. */
    missingPermissions?: readonly BotPermission[]
    /** The permissions were checked on the server, not in a channel. */
    serverWide?: boolean
}

/** What the entry concerns (L5-17..25 "Řádek čeho se to týká"). */
export type BotErrorContext = {
    event?: {
        title: string
        category?: string
        gameStart?: string | null
    }
    /** `<#id>`. */
    channel?: string
    /** Plain category name. */
    category?: string
    /** `<@&id>`. */
    role?: string
    /** Markdown names or `<@id>` of the members concerned. */
    members?: readonly string[]
    /** `<@id>` of the person who clicked. */
    user?: string
    /** Ticket or application number. */
    number?: number
    /** Players a reminder was for. */
    players?: number
    /** The Discord panel's name (plain; escaped here). */
    panel?: string
}

export type BotErrorLinks = Partial<Record<BotErrorLink, string>> & {
    /** "Spravováno v Logi" links here. */
    managed?: string
}

export type BotErrorReportInput = {
    copy: BotErrorsCopy
    /** Intl locale of the clan language, for plurals, lists and the weekday. */
    locale: string
    timeZone: string
    source: BotErrorSource
    facts: BotErrorFacts
    context?: BotErrorContext
    links?: BotErrorLinks
}

/** At most five names in an entry (L5-B05). */
export const BOT_ERROR_MEMBER_LIMIT = 5

/** "A", "A a B", "A, B a C" with the language's "and". */
export function joinWithAnd(items: readonly string[], and: string) {
    if (items.length <= 1) return items.join("")
    return `${items.slice(0, -1).join(", ")} ${and} ${items[items.length - 1]}`
}

/** "Vkládat odkazy" or "Vytvářet soukromá vlákna a Posílat zprávy ve vláknech". */
export function permissionNames(
    copy: BotErrorsCopy,
    permissions: readonly BotPermission[]
) {
    return joinWithAnd(
        [...new Set(permissions)].map(
            (permission) => copy.permissions[permission]
        ),
        copy.and
    )
}

/** The title: what failed. */
export function botErrorTitle(
    copy: BotErrorsCopy,
    locale: string,
    source: BotErrorSource,
    context: BotErrorContext = {}
) {
    if (source !== "memberRoles") return copy.titles[source]
    const count = Math.max(1, context.members?.length ?? 1)
    return formatCount(locale, count, copy.memberRolesTitle)
}

/** "Chyba bota · Zápas"; laid out upper case by the kit. */
export function botErrorLabel(copy: BotErrorsCopy, source: BotErrorSource) {
    const area = BOT_ERROR_SOURCE_SPECS[source].area
    return area
        ? fillTemplate(copy.labelWithArea, { area: copy.areas[area] })
        : copy.label
}

/**
 * The context line, e.g. "VLK vs ROG · Přátelák · ne 11. 10. · 20:00" or
 * "Role @Člen · Hráč 17, Hráč 21, Hráč 23" (names capped at five).
 */
export function botErrorContextLine(
    copy: BotErrorsCopy,
    locale: string,
    timeZone: string,
    source: BotErrorSource,
    context: BotErrorContext = {}
) {
    const parts: string[] = []
    const area = BOT_ERROR_SOURCE_SPECS[source].area
    const event = context.event
    if (event) {
        parts.push(escapeMarkdownText(event.title.trim()))
        if (event.category?.trim())
            parts.push(escapeMarkdownText(event.category.trim()))
        const when = discordWeekdayTimestamp(event.gameStart, locale, timeZone)
        if (when) parts.push(when)
    }
    if (area === "scheduledEvent" && context.channel)
        parts.push(
            fillTemplate(copy.context.meetingChannel, {
                channel: context.channel,
            })
        )
    if (
        area === "tickets" ||
        area === "applications" ||
        area === "playerReports"
    ) {
        if (context.category?.trim())
            parts.push(
                fillTemplate(copy.context.category, {
                    category: escapeMarkdownText(context.category.trim()),
                })
            )
        if (typeof context.number === "number" && context.number > 0)
            parts.push(
                fillTemplate(
                    area === "applications"
                        ? copy.context.applicationNumber
                        : copy.context.ticketNumber,
                    { number: String(context.number) }
                )
            )
        if (context.user)
            parts.push(
                fillTemplate(
                    area === "applications"
                        ? copy.context.applicant
                        : BOT_ERROR_SOURCE_SPECS[source].flow === "background"
                          ? copy.context.author
                          : copy.context.tried,
                    { user: context.user }
                )
            )
    }
    if (context.role && (area === "memberRoles" || area === "eventRoles"))
        parts.push(fillTemplate(copy.context.role, { role: context.role }))
    if (area === "memberRoles" && context.members?.length) {
        const shown = context.members.slice(0, BOT_ERROR_MEMBER_LIMIT)
        const more = context.members.length - shown.length
        parts.push(
            shown.join(", ") +
                (more > 0
                    ? ` ${fillTemplate(copy.context.moreMembers, { count: String(more) })}`
                    : "")
        )
    }
    if (area === "reminders" && typeof context.players === "number")
        parts.push(formatCount(locale, context.players, copy.context.players))
    if (area === "panels" && context.panel?.trim())
        parts.push(
            fillTemplate(copy.context.panel, {
                panel: escapeMarkdownText(context.panel.trim().slice(0, 100)),
            })
        )
    if (
        (area === "panels" || area === "seed" || source === "general") &&
        context.channel &&
        !event
    )
        parts.push(
            fillTemplate(copy.context.channel, { channel: context.channel })
        )
    return parts.join(" · ")
}

const joinSentences = (...sentences: string[]) =>
    sentences.filter((sentence) => sentence.trim()).join(" ")

/** "Proč" and "Co udělat" for the failure (L5-26..32, L5-B02). */
export function botErrorExplanation(
    copy: BotErrorsCopy,
    locale: string,
    source: BotErrorSource,
    facts: BotErrorFacts,
    options: { followUp?: boolean } = {}
): { reason: string; fix: string } {
    const spec = BOT_ERROR_SOURCE_SPECS[source]
    const channel = facts.channel ?? copy.unnamed.channel
    const role = facts.role ?? copy.unnamed.role
    const category = facts.category?.trim()
        ? escapeMarkdownText(facts.category.trim())
        : copy.unnamed.category
    const followUp =
        spec.followUp && options.followUp !== false
            ? copy.followUps[spec.followUp]
            : ""
    const withFollowUp = (fix: string) =>
        followUp ? `${fix} ${followUp}` : fix
    switch (facts.failure) {
        case "missingPermission": {
            const missing = facts.missingPermissions ?? []
            if (!missing.length)
                return {
                    reason: copy.reasons.missingPermissionUnknown,
                    fix: withFollowUp(copy.fixes.missingPermissionUnknown),
                }
            const permissions = permissionNames(copy, missing)
            const values = { channel, permissions }
            if (facts.serverWide)
                return {
                    reason: fillTemplate(
                        copy.reasons.missingPermissionServer,
                        values
                    ),
                    fix: withFollowUp(
                        fillTemplate(copy.fixes.missingPermissionServer, values)
                    ),
                }
            const reason = fillTemplate(
                missing.includes("CreatePrivateThreads")
                    ? copy.reasons.privateThreads
                    : copy.reasons.missingPermission,
                values
            )
            // Without the channel's name the board's general sentence (L5-26).
            const fix = !facts.channel
                ? copy.fixes.missingPermissionGeneric
                : spec.flow === "sync"
                  ? copy.fixes.missingPermissionSync
                  : copy.fixes.missingPermissionInteraction
            return {
                reason,
                fix: withFollowUp(fillTemplate(fix, values)),
            }
        }
        case "missingAccess":
            return {
                reason: fillTemplate(copy.reasons.missingAccess, { channel }),
                fix: withFollowUp(copy.fixes.missingAccess),
            }
        case "unknownChannel":
            return {
                reason: fillTemplate(copy.reasons.unknownChannel, { channel }),
                fix: copy.fixes.unknownChannel,
            }
        case "unknownRole":
            return {
                reason: fillTemplate(copy.reasons.unknownRole, { role }),
                fix: copy.fixes.unknownRole,
            }
        case "roleAbove":
            return {
                reason: fillTemplate(copy.reasons.roleAbove, { role }),
                fix: withFollowUp(fillTemplate(copy.fixes.roleAbove, { role })),
            }
        case "fullCategory":
            return {
                reason: fillTemplate(copy.reasons.fullCategory, { category }),
                fix:
                    spec.area === "forum"
                        ? copy.fixes.fullCategoryForum
                        : copy.fixes.fullCategory,
            }
        case "fullServer":
            return {
                reason: copy.reasons.fullServer,
                fix: copy.fixes.fullServer,
            }
        case "wrongChannelType":
            return {
                reason: fillTemplate(copy.reasons.wrongChannelType, {
                    channel,
                }),
                fix: withFollowUp(copy.fixes.wrongChannelType),
            }
        case "channelPublic": {
            const seed = source === "seedControl"
            return {
                reason: fillTemplate(
                    seed
                        ? copy.reasons.seedControlPublic
                        : copy.reasons.panelPasswordPublic,
                    { channel }
                ),
                fix: withFollowUp(
                    fillTemplate(
                        seed
                            ? copy.fixes.seedControlPublic
                            : copy.fixes.panelPasswordPublic,
                        { channel }
                    )
                ),
            }
        }
        case "timeout":
            return {
                reason: copy.reasons.timeout,
                fix:
                    spec.flow === "background"
                        ? joinSentences(followUp, copy.fixes.timeoutBackground)
                        : spec.flow === "interaction"
                          ? copy.fixes.timeoutInteraction
                          : copy.fixes.timeoutSync,
            }
        case "other":
            return {
                reason: copy.reasons.other,
                fix:
                    spec.flow === "background"
                        ? joinSentences(followUp, copy.fixes.otherBackground)
                        : copy.fixes.other,
            }
    }
}

const RETRY_TONES: Record<BotErrorRetry, MessageChip["tone"]> = {
    afterFix: "warning",
    byItself: "warning",
    playerTold: "neutral",
    notRetried: "neutral",
}

/**
 * One entry of the errors channel (L5-08..16): grey bar, "CHYBA BOTA ·
 * ZÁPAS", what failed, what it concerns, the retry chip, "Proč", "Co
 * udělat", links to the Logi pages that fix it and "Spravováno v Logi".
 * Nothing to do (Discord did not answer) means no buttons (L5-15).
 */
export function botErrorReportView(input: BotErrorReportInput): MessageView {
    const { copy, locale, source, facts } = input
    const spec = BOT_ERROR_SOURCE_SPECS[source]
    const context = input.context ?? {}
    const { reason, fix } = botErrorExplanation(copy, locale, source, facts)
    const contextLine = botErrorContextLine(
        copy,
        locale,
        input.timeZone,
        source,
        context
    )
    const retry = botErrorRetry(source, facts.failure)
    const buttons: MessageButton[] =
        facts.failure === "timeout"
            ? []
            : spec.links.flatMap((link) => {
                  const url = input.links?.[link]
                  return url && /^https?:\/\//.test(url)
                      ? [
                            {
                                kind: "link" as const,
                                url,
                                label: copy.links[link],
                            },
                        ]
                      : []
              })
    return {
        accent: "system",
        header: {
            label: botErrorLabel(copy, source),
            title: botErrorTitle(copy, locale, source, context),
            // The board draws what it concerns as a muted line (L5-08).
            subtitle: contextLine ? `-# ${contextLine}` : undefined,
            chips: [{ label: copy.retry[retry], tone: RETRY_TONES[retry] }],
        },
        blocks: [
            {
                kind: "text",
                markdown: `**${copy.reasonHeading}**\n${reason}\n**${copy.fixHeading}**\n${fix}`,
            },
            { kind: "separator", divider: true, spacing: "small" },
            ...(buttons.length
                ? [{ kind: "buttons" as const, buttons: buttons.slice(0, 5) }]
                : []),
        ],
        footer: {
            kind: "managed",
            managedUrl:
                input.links?.managed && /^https?:\/\//.test(input.links.managed)
                    ? input.links.managed
                    : undefined,
        },
    }
}

/**
 * The same title, "Proč" and "Co udělat" as one plain line for the
 * dashboard (L5-44), e.g. the stored last error of a panel publication.
 * Pass the channel as plain "#name": the dashboard renders no mentions.
 * The line is cut at `max` characters.
 */
export function botErrorSummary(
    copy: BotErrorsCopy,
    locale: string,
    source: BotErrorSource,
    facts: BotErrorFacts,
    max = 240
) {
    const { reason, fix } = botErrorExplanation(copy, locale, source, facts, {
        followUp: false,
    })
    const plain = (value: string) =>
        value.replace(/\\([\\*_~`|[\]<>#-])/g, "$1")
    const text = `${botErrorTitle(copy, locale, source)}. ${copy.reasonHeading}: ${plain(reason)} ${copy.fixHeading}: ${plain(fix)}`
    return text.length > max ? `${text.slice(0, max - 1)}…` : text
}
