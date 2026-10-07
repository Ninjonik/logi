import {
    ChannelType,
    PermissionFlagsBits,
    type Client,
    type Guild,
    type GuildBasedChannel,
    type GuildMember,
    type MessageCreateOptions,
} from "discord.js"

import {
    BOT_ERROR_SOURCE_SPECS,
    BOT_PERMISSIONS,
    classifyDiscordFailure,
    botErrorReportView,
    isBotErrorSource,
    type BotErrorContext,
    type BotErrorFacts,
    type BotErrorLinks,
    type BotErrorSource,
    type BotPermission,
    type DiscordFailure,
} from "../../src/domain/discord-messages/bot-errors"
import type { MessageStyle } from "../../src/domain/discord-messages/message-style"
import { escapeMarkdownText } from "../../src/domain/discord-messages/message-view"
import type { PublicationChannelError } from "./sync/publication-errors"
import { getSystemMessages } from "../../src/lib/clan-language/system"
import { resolveClanLanguage } from "../../src/lib/clan-language/core"
import { makeFunctionReference } from "convex/server"
import { messagePayload } from "./ui/message-kit"
import { env } from "./environment"
import { convex } from "./convex"
import { logWarn } from "./log"

/**
 * One failure for the clan's errors channel (board L5 1.1). Name the
 * `source` (what failed) and what it concerns; the reporter reads the
 * Discord answer, works out the missing permission or the role above the
 * bot and posts the Czech/English/German card. The older free-text fields
 * (`action`, `location`, `scope`, `target`, `details`) are still read to
 * recognise the source of existing call sites; they never reach the card.
 */
export type ClanErrorReportInput = {
    client?: Client
    guildId: string
    error: unknown
    source?: BotErrorSource
    /** The match the failure concerns (its title, category and start). */
    eventId?: string
    /** The channel or thread parent the action needed. */
    channelId?: string
    /** The category the action created a channel in. */
    categoryId?: string
    roleId?: string
    /** Members whose roles failed; at most five are named. */
    memberIds?: string[]
    /** The person who clicked (ticket, application, report). */
    userId?: string
    /** The ticket or application category's label. */
    categoryLabel?: string
    /** Ticket or application number. */
    number?: number
    /** Players a reminder was for. */
    players?: number
    /** The Discord panel's name (the password notice, P4-30). */
    panel?: string
    /** @deprecated Free text of older call sites; only read to find the source. */
    action?: string
    /** @deprecated See `action`. */
    location?: string
    /** @deprecated See `action`. */
    scope?: string
    /** @deprecated See `action`. */
    target?: string
    /** @deprecated See `action`; IDs in it are read, never shown. */
    details?: Record<string, string | undefined>
}

/** What the errors channel entry reads from Convex (`discordErrorReports:context`). */
export type ErrorReportContext = {
    errorsChannelId: string
    language: string
    timeZone: string
    messageStyle: MessageStyle | null
    serverId: string | null
    channels: Partial<
        Record<
            | "announcements"
            | "eventInfo"
            | "calendar"
            | "forumCategory"
            | "meeting"
            | "ticketPanel"
            | "ticketThreads"
            | "applicationPanel"
            | "applicationThreads",
            string | null
        >
    >
    event: {
        id: string
        kind: string
        title: string
        category: string | null
        gameStart: string
        announcementChannelId: string | null
        meetingChannelId: string | null
    } | null
}

const contextReference = makeFunctionReference<"query">(
    "discordErrorReports:context"
)

const has = (value: string | undefined, pattern: RegExp) =>
    Boolean(value && pattern.test(value))

/**
 * The source of an older call site from its free text, or null for a
 * failure that does not belong in the errors channel (a DM that could not
 * be delivered is shown where the admin acted, L2-63).
 */
export function inferErrorSource(
    input: Pick<ClanErrorReportInput, "action" | "location" | "scope">
): BotErrorSource | null {
    const { action, location, scope } = input
    if (has(action, /\bDM\b/)) return null
    switch (scope) {
        case "event-sync":
            return "announcement"
        case "event-roles":
            return "eventRoles"
        case "forum":
            if (has(action, /access/i)) return "forumAccess"
            if (has(action, /^Create/i)) return "forumCreate"
            return "forumUpdate"
        case "scheduled-events":
            if (has(action, /^Create/i)) return "scheduledEventCreate"
            if (has(action, /^Cancel/i)) return "scheduledEventCancel"
            return "scheduledEventUpdate"
        case "guild-sync":
            if (has(action, /managed member roles/i)) return "memberRoles"
            if (has(action, /admin role|member access/i)) return "adminAccess"
            if (has(action, /ticket panel/i)) return "ticketPanel"
            if (has(action, /membership panel/i)) return "applicationPanel"
            if (has(action, /calendar/i)) return "calendarPanel"
            if (has(action, /attendance reminder/i))
                return "attendanceReminders"
            return "general"
    }
    if (has(location, /ticket/i)) {
        if (has(action, /participant|support/i)) return "ticketSupport"
        if (has(action, /first|intro/i)) return "ticketIntro"
        if (has(action, /rename/i)) return "ticketRename"
        return "ticketOpen"
    }
    if (has(location, /membership application/i)) {
        if (has(action, /participant|recruit/i)) return "applicationRecruiters"
        if (has(action, /first|intro/i)) return "applicationIntro"
        if (has(action, /rename/i)) return "applicationRename"
        return "applicationOpen"
    }
    if (has(location, /player report/i)) return "playerReport"
    return "general"
}

/**
 * The error and what it wraps, outermost first: a publication's
 * `deliveryCause` (the stored cause), then the standard `cause`. Bounded,
 * and safe against cycles.
 */
export function errorChain(error: unknown): unknown[] {
    const chain: unknown[] = []
    const queue: unknown[] = [error]
    while (queue.length && chain.length < 8) {
        const current = queue.shift()
        if (current === undefined || current === null) continue
        if (chain.includes(current)) continue
        chain.push(current)
        if (typeof current === "object") {
            const wrapped = current as {
                deliveryCause?: unknown
                cause?: unknown
            }
            queue.push(wrapped.deliveryCause, wrapped.cause)
        }
    }
    return chain
}

function readDiscordFailure(error: unknown): DiscordFailure {
    if (typeof error === "string") return { message: error }
    if (!error || typeof error !== "object") return {}
    const value = error as {
        code?: unknown
        status?: unknown
        name?: unknown
        message?: unknown
        rawError?: { code?: unknown }
    }
    const code = value.code ?? value.rawError?.code
    return {
        code:
            typeof code === "number" || typeof code === "string"
                ? code
                : undefined,
        status: typeof value.status === "number" ? value.status : undefined,
        name: typeof value.name === "string" ? value.name : undefined,
        message: typeof value.message === "string" ? value.message : undefined,
    }
}

/**
 * The parts of a thrown Discord, REST or network error the classification
 * reads. A wrapped answer counts (a publication's `PublicationNotSent`
 * carries Discord's 403 as its cause, L5-08): the first error in the chain
 * that tells something wins, else the first with a code or status.
 */
export function discordFailureOf(error: unknown): DiscordFailure {
    const failures = errorChain(error).map(readDiscordFailure)
    return (
        failures.find(
            (failure) => classifyDiscordFailure(failure) !== "other"
        ) ??
        failures.find(
            (failure) =>
                failure.code !== undefined || failure.status !== undefined
        ) ??
        failures[0] ??
        {}
    )
}

const isBotPermission = (value: string): value is BotPermission =>
    (BOT_PERMISSIONS as readonly string[]).includes(value)

/**
 * The facts a thrown error carries by itself (L5-09, L5-26, L5-44): the
 * permissions a publication's channel pre-check found missing and that
 * channel, a deleted or wrong channel, or the class of Discord's answer.
 * The channel is plain "#name"; the errors channel mentions it by
 * `channelId`.
 */
export function errorFacts(error: unknown): {
    facts: BotErrorFacts
    channelId?: string
} {
    for (const item of errorChain(error)) {
        const permission = publicationPermissionFailure(item)
        if (permission)
            return {
                facts: {
                    failure: "missingPermission",
                    missingPermissions: permission.missing,
                    channel: permission.channelName
                        ? `#${escapeMarkdownText(permission.channelName)}`
                        : undefined,
                },
                channelId: permission.channelId,
            }
        const channel = publicationChannelFailure(item)
        if (channel)
            return {
                facts:
                    channel.reason === "channel_missing"
                        ? { failure: "unknownChannel" }
                        : channel.reason === "channel_type"
                          ? { failure: "wrongChannelType" }
                          : {
                                failure: "missingPermission",
                                missingPermissions: channel.permissions,
                            },
            }
    }
    return {
        facts: { failure: classifyDiscordFailure(discordFailureOf(error)) },
    }
}

const CHANNEL_REASONS: ReadonlySet<unknown> = new Set<
    PublicationChannelError["reason"]
>(["channel_missing", "channel_type", "missing_permissions"])

const isChannelReason = (
    value: unknown
): value is PublicationChannelError["reason"] => CHANNEL_REASONS.has(value)

/**
 * A publication channel failure (P1-16), by its class's shape, so an error
 * that crossed a module boundary or a serialisation is still recognised.
 */
function publicationChannelFailure(item: unknown) {
    if (!item || typeof item !== "object") return null
    const value = item as { reason?: unknown; permissions?: unknown }
    if (!isChannelReason(value.reason)) return null
    return {
        reason: value.reason,
        permissions: Array.isArray(value.permissions)
            ? value.permissions.filter(
                  (name): name is BotPermission =>
                      typeof name === "string" && isBotPermission(name)
              )
            : [],
    }
}

/**
 * The channel pre-check's missing permissions and the channel (L5-09), by
 * the shape of `PublicationPermissionError`.
 */
function publicationPermissionFailure(item: unknown) {
    if (!item || typeof item !== "object") return null
    const value = item as {
        missing?: unknown
        channelName?: unknown
        channelId?: unknown
    }
    if (!Array.isArray(value.missing) || typeof value.channelName !== "string")
        return null
    return {
        missing: value.missing.filter(
            (name): name is BotPermission =>
                typeof name === "string" && isBotPermission(name)
        ),
        channelName: value.channelName.trim(),
        channelId:
            typeof value.channelId === "string" ? value.channelId : undefined,
    }
}

const ID = /^\d{17,20}$/
const idOf = (value: string | null | undefined) =>
    value && ID.test(value) ? value : undefined

/** Server-level permissions; the rest are checked in the channel. */
const SERVER_PERMISSIONS: ReadonlySet<BotPermission> = new Set([
    "ManageRoles",
    "ManageEvents",
])

/** The channel an action needed, from the call site or the clan's settings. */
export function actionChannelId(
    source: BotErrorSource,
    input: Pick<ClanErrorReportInput, "channelId" | "details">,
    context: Pick<ErrorReportContext, "channels" | "event">
) {
    const explicit =
        idOf(input.channelId) ??
        idOf(input.details?.channelId) ??
        idOf(input.details?.forumChannelId)
    if (explicit) return explicit
    const channels = context.channels
    switch (source) {
        case "announcement":
            return (
                idOf(context.event?.announcementChannelId) ??
                idOf(channels.announcements)
            )
        case "roster":
            return idOf(channels.eventInfo) ?? idOf(channels.announcements)
        case "scheduledEventCreate":
        case "scheduledEventUpdate":
            return (
                idOf(context.event?.meetingChannelId) ?? idOf(channels.meeting)
            )
        case "ticketPanel":
            return idOf(channels.ticketPanel)
        case "applicationPanel":
            return idOf(channels.applicationPanel)
        case "calendarPanel":
            return idOf(channels.calendar)
        case "ticketOpen":
        case "ticketSupport":
        case "ticketIntro":
        case "ticketRename":
        case "ticketCloseCard":
        case "ticketCloseThread":
        case "playerReport":
            return idOf(channels.ticketThreads)
        case "applicationOpen":
        case "applicationRecruiters":
        case "applicationIntro":
        case "applicationRename":
            return idOf(channels.applicationThreads)
        default:
            return undefined
    }
}

/** What the bot still lacks for `required`, in the channel or on the server. */
export function missingPermissions(
    required: readonly BotPermission[],
    granted: (permission: bigint) => boolean
): BotPermission[] {
    return required.filter(
        (permission) => !granted(PermissionFlagsBits[permission])
    )
}

type DiscordLookups = {
    guild: Guild | null
    me: GuildMember | null
    channel(id: string | undefined): Promise<GuildBasedChannel | null>
}

/**
 * The facts of the card: the error class (fixed for a notice such as the
 * hidden panel password, else read from the error and what it wraps),
 * refined with the role positions and the bot's actual permissions, and the
 * channel, category and role as Discord shows them.
 */
export async function failureFacts(
    source: BotErrorSource,
    input: ClanErrorReportInput,
    context: ErrorReportContext,
    discord: DiscordLookups
): Promise<{ facts: BotErrorFacts; channelMention?: string }> {
    const spec = BOT_ERROR_SOURCE_SPECS[source]
    const found: { facts: BotErrorFacts; channelId?: string } = spec.failure
        ? { facts: { failure: spec.failure } }
        : errorFacts(input.error)
    let failure = found.facts.failure
    // The publication's own channel is the exact one that failed.
    const channelId =
        idOf(found.channelId) ?? actionChannelId(source, input, context)
    const channel = await discord.channel(channelId)
    const categoryId =
        idOf(input.categoryId) ??
        idOf(input.details?.forumCategoryId) ??
        (spec.area === "forum"
            ? idOf(context.channels.forumCategory)
            : undefined)
    const category = await discord.channel(categoryId)
    const roleId = idOf(input.roleId) ?? idOf(input.details?.roleId)
    const role = roleId
        ? (discord.guild?.roles.cache.get(roleId) ?? null)
        : null
    if (failure === "missingPermission" && roleId && discord.me) {
        if (!role) failure = "unknownRole"
        else if (
            role.position >= discord.me.roles.highest.position &&
            discord.me.permissions.has(PermissionFlagsBits.ManageRoles)
        )
            failure = "roleAbove"
    }
    const facts: BotErrorFacts = {
        failure,
        // A channel Discord no longer knows is never named after another one.
        channel:
            failure === "unknownChannel"
                ? undefined
                : channel
                  ? `<#${channel.id}>`
                  : found.facts.channel,
        category: category?.name,
        role: roleId ? `<@&${roleId}>` : undefined,
    }
    if (
        failure === "missingPermission" &&
        found.facts.missingPermissions?.length
    )
        // The channel pre-check already named what is missing (L5-09).
        facts.missingPermissions = found.facts.missingPermissions
    else if (failure === "missingPermission" && discord.me) {
        const required = spec.permissions
        const target = channel ?? category
        const inChannel = target
            ? required.filter(
                  (permission) => !SERVER_PERMISSIONS.has(permission)
              )
            : []
        const permissions = target?.permissionsFor(discord.me)
        const missingInChannel = permissions
            ? missingPermissions(inChannel, (flag) => permissions.has(flag))
            : []
        const missingOnServer = missingPermissions(
            target
                ? required.filter((permission) =>
                      SERVER_PERMISSIONS.has(permission)
                  )
                : required,
            (flag) => discord.me!.permissions.has(flag)
        )
        if (missingInChannel.length) {
            facts.missingPermissions = missingInChannel
            if (!channel && category) facts.channel = `<#${category.id}>`
        } else if (missingOnServer.length) {
            facts.missingPermissions = missingOnServer
            facts.serverWide = true
        }
    }
    return { facts, channelMention: facts.channel }
}

/** Display names of members, at most five, never IDs. */
async function memberNames(guild: Guild | null, ids: readonly string[]) {
    const valid = ids.filter((id) => ID.test(id))
    if (!valid.length) return []
    const fetched = guild
        ? await guild.members
              .fetch({ user: valid.slice(0, 5) })
              .catch(() => null)
        : null
    return valid.map((id) => {
        const name = fetched?.get(id)?.displayName?.trim()
        return name ? escapeMarkdownText(name) : `<@${id}>`
    })
}

/** The links of an entry to the clan's pages in Logi. */
export function errorReportLinks(
    context: Pick<ErrorReportContext, "serverId" | "language" | "event">,
    siteUrl: string
): BotErrorLinks {
    if (!context.serverId || !/^[A-Za-z0-9_-]{1,64}$/.test(context.serverId))
        return {}
    const base = `/${resolveClanLanguage(context.language)}/dashboard/servers/${context.serverId}`
    const page = (path: string) => new URL(`${base}${path}`, siteUrl).toString()
    return {
        ...(context.event
            ? {
                  match: page(
                      `/${context.event.kind === "training" ? "trainings" : "matches"}/${encodeURIComponent(context.event.id)}`
                  ),
              }
            : {}),
        channels: page("/settings/channels"),
        tickets: page("/settings/tickets"),
        roles: page("/settings/roles"),
        membership: page("/settings/membership"),
        panels: page("/settings/discord-panels"),
        seed: page("/settings/discord-seed"),
        managed: page("/settings/messages"),
    }
}

/** The card for one failure, or null when it does not belong in the channel. */
export async function buildErrorReport(
    input: ClanErrorReportInput,
    context: ErrorReportContext,
    discord: DiscordLookups,
    siteUrl: string
): Promise<MessageCreateOptions | null> {
    const source = isBotErrorSource(input.source)
        ? input.source
        : inferErrorSource(input)
    if (!source) return null
    const copy = getSystemMessages(context.language)
    const { facts } = await failureFacts(source, input, context, discord)
    const memberIds = input.memberIds ?? []
    const user = idOf(input.userId)
        ? `<@${input.userId}>`
        : input.details?.user?.trim()
          ? `@${escapeMarkdownText(input.details.user.trim())}`
          : undefined
    const area = BOT_ERROR_SOURCE_SPECS[source].area
    // Older ticket and application calls name the category as their target.
    const label =
        input.categoryLabel?.trim() ||
        (source === "ticketOpen" || source === "applicationOpen"
            ? input.target?.trim()
            : undefined)
    const errorContext: BotErrorContext = {
        event: context.event
            ? {
                  title: context.event.title,
                  category: context.event.category ?? undefined,
                  gameStart: context.event.gameStart,
              }
            : undefined,
        channel:
            area === "scheduledEvent" ||
            area === "panels" ||
            area === "seed" ||
            source === "general"
                ? facts.channel
                : undefined,
        category: label && !ID.test(label) ? label : undefined,
        role: facts.role,
        members: await memberNames(discord.guild, memberIds),
        user,
        number: input.number,
        players: input.players,
        panel: input.panel?.trim() || undefined,
    }
    return messagePayload(
        botErrorReportView({
            copy: copy.errorsChannel,
            locale: copy.locale,
            timeZone: context.timeZone,
            source,
            facts,
            context: errorContext,
            links: errorReportLinks(context, siteUrl),
        }),
        { language: context.language, style: context.messageStyle }
    )
}

/**
 * Posts a failure to the clan's errors channel (board L5 1.1) in the clan
 * language, with the neutral grey bar. Nothing happens without a client or
 * an errors channel; a failed report is logged and never thrown.
 */
export async function reportClanDiscordError(input: ClanErrorReportInput) {
    if (!input.client) return
    const eventId = input.eventId ?? input.details?.eventId
    const context = (await convex
        .query(contextReference, {
            secret: env.internalSecret,
            guildId: input.guildId,
            ...(eventId ? { eventId } : {}),
        })
        .catch(() => null)) as ErrorReportContext | null
    if (!context?.errorsChannelId) return

    const guild = await input.client.guilds
        .fetch(input.guildId)
        .catch(() => null)
    if (!guild) return
    const errorsChannel = await guild.channels
        .fetch(context.errorsChannelId)
        .catch(() => null)
    if (
        !errorsChannel?.isTextBased() ||
        (errorsChannel.type !== ChannelType.GuildText &&
            errorsChannel.type !== ChannelType.GuildAnnouncement)
    )
        return
    const me = await guild.members.fetchMe().catch(() => null)
    try {
        const message = await buildErrorReport(
            input,
            context,
            {
                guild,
                me,
                channel: async (id) =>
                    id
                        ? await guild.channels.fetch(id).catch(() => null)
                        : null,
            },
            env.appSiteUrl
        )
        if (message) await errorsChannel.send(message)
    } catch (error) {
        logWarn("error-reporting", "Failed to post clan error report", {
            guildId: input.guildId,
            source: input.source ?? input.scope,
            error,
        })
    }
}
