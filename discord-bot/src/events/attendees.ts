/**
 * "Zobrazit přihlášené" (board L1 1.9): everyone sees who signed up, by
 * group, with the reserves and who is not coming; leadership (the Logi admin
 * role or Discord's Administrator, checked fresh on every click) also sees
 * the reasons, "Bez odpovědi", "Připomenout bez odpovědi" and "Otevřít na
 * webu" (L1-B09). The list pages at 40 names (L1-B10); the group select and
 * the paging buttons redraw the same private card.
 */

import {
    PermissionFlagsBits,
    type ButtonInteraction,
    type Client,
    type StringSelectMenuInteraction,
} from "discord.js"
import { makeFunctionReference } from "convex/server"

import {
    ATTENDEES_FILTER_PREFIX,
    ATTENDEES_PREFIX,
    ATTENDEES_REMIND_PREFIX,
    buildAttendeesView,
    decodeSignupListFilter,
    parseAttendeesCustomId,
} from "../../../src/domain/discord-messages/match-attendees"
import {
    buildSignupList,
    type SignupListFilter,
    type SignupListMembership,
} from "../../../src/domain/events/signup-list"
import {
    errorCard,
    notAllowedCard,
    type MessageView,
} from "../../../src/domain/discord-messages/message-view"
import {
    fillTemplate,
    formatCount,
    discordTimestamp,
} from "../../../src/domain/discord-messages/format"
import { matchUnavailableView } from "../../../src/domain/discord-messages/match-signup-replies"
import type { ManualReminderUnavailable } from "../../../src/domain/events/manual-reminders"
import { getAnnouncementMessages } from "../../../src/lib/clan-language/announcements"
import { isClanLanguage } from "../../../src/lib/clan-language/core"
import { canAcceptSignups } from "../../../src/domain/events/status"
import type { DiscordConfig, EventRecord } from "../types"
import { interactionLanguage } from "../ui/replies"
import { matchCardEventOf } from "./announcement"
import { replyToClicker } from "./replies"
import { env } from "../environment"
import { convex } from "../convex"
import { logInfo } from "../log"

const ref = {
    getAttendees: makeFunctionReference<"query">(
        "eventAnnouncements:getAttendees"
    ),
    requestManual: makeFunctionReference<"mutation">(
        "eventReminders:requestManual"
    ),
}

export type AttendeesData = {
    config: DiscordConfig
    event: EventRecord
    category: { label: string; color: string | null } | null
    groups: Array<{ id: string; name: string }>
    memberships: Array<{ userId: string; membership: SignupListMembership }>
    signedUpAt: Array<{ userId: string; at: string }>
    names: Array<{ userId: string; name: string }>
    unanswered: {
        userIds: string[]
        unavailable: ManualReminderUnavailable | null
    }
}

type ListInteraction = ButtonInteraction | StringSelectMenuInteraction

async function loadAttendees(eventId: string, guildId: string | null) {
    return (await convex.query(ref.getAttendees, {
        secret: env.internalSecret,
        eventId: eventId as never,
        ...(guildId ? { guildId } : {}),
    })) as AttendeesData | null
}

/**
 * Leadership: the clan's Logi admin role or Discord's Administrator, read
 * fresh from Discord at the click; anything unreadable is not leadership.
 */
export async function isMatchLeadership(
    client: Pick<Client, "guilds">,
    guildId: string,
    userId: string,
    adminRoleId: string | null | undefined
) {
    try {
        const guild = await client.guilds.fetch(guildId)
        await guild.roles.fetch()
        const member = await guild.members.fetch({ user: userId, force: true })
        return (
            member.permissions.has(PermissionFlagsBits.Administrator) ||
            Boolean(adminRoleId && member.roles.cache.has(adminRoleId))
        )
    } catch {
        return false
    }
}

/** Display names: the member's current server name, else the stored one. */
function displayNames(
    client: Pick<Client, "guilds">,
    data: AttendeesData
): Map<string, string> {
    const names = new Map(data.names.map((entry) => [entry.userId, entry.name]))
    const guild = client.guilds.cache.get(data.event.guildId)
    if (guild)
        for (const userId of [
            ...data.event.participants.map((participant) => participant.userId),
            ...data.unanswered.userIds,
        ]) {
            const name = guild.members.cache.get(userId)?.displayName?.trim()
            if (name) names.set(userId, name)
        }
    return names
}

/** The match's attendance page in Logi (L1-85). */
function attendanceUrl(data: AttendeesData) {
    const language = isClanLanguage(data.config.defaultLanguage)
        ? data.config.defaultLanguage
        : "en"
    const section = data.event.kind === "training" ? "trainings" : "matches"
    const url = new URL(
        `/${language}/dashboard/servers/${encodeURIComponent(data.event.guildId)}/${section}/${encodeURIComponent(data.event.id)}`,
        env.appSiteUrl
    )
    url.searchParams.set("tab", "attendance")
    return url.toString()
}

/** The list card for one viewer, filter and page. */
export function attendeesViewFor(
    data: AttendeesData,
    input: {
        leadership: boolean
        filter: SignupListFilter
        page: number
        names: Map<string, string>
        now?: Date
    }
): MessageView {
    const copy = getAnnouncementMessages(data.config.defaultLanguage)
    const card = matchCardEventOf({
        config: data.config,
        event: data.event,
        category: data.category,
    })
    const filter =
        input.filter.kind === "unanswered" && !input.leadership
            ? ({ kind: "all" } as const)
            : input.filter
    const list = buildSignupList({
        kind: data.event.kind,
        groups: data.groups,
        offeredGroupIds: data.event.signupGroupIds ?? null,
        limits: new Map(
            (
                (
                    data.event as {
                        signupGroupLimits?: Array<{
                            groupId: string
                            max: number
                        }>
                    }
                ).signupGroupLimits ?? []
            ).map((limit) => [limit.groupId, limit.max])
        ),
        generalSignup: Boolean(data.event.useGeneralSignup),
        participants: data.event.participants,
        absenceNotices: data.event.absenceNotices ?? [],
        signedUpAt: new Map(
            data.signedUpAt.map((entry) => [entry.userId, entry.at])
        ),
        memberships: new Map(
            data.memberships.map((entry) => [entry.userId, entry.membership])
        ),
        leadership: input.leadership,
        unanswered: data.unanswered.userIds,
        names: input.names,
        locale: card.locale,
    })
    return buildAttendeesView({
        event: card,
        list,
        filter,
        page: input.page,
        leadership: input.leadership,
        registrationOpen: canAcceptSignups(data.event, input.now ?? new Date()),
        names: input.names,
        reminderAvailable:
            data.unanswered.unavailable === null &&
            data.unanswered.userIds.length > 0,
        webUrl: input.leadership ? attendanceUrl(data) : null,
        copy,
    }).view
}

async function showList(
    interaction: ListInteraction,
    eventId: string,
    filter: SignupListFilter,
    page: number
) {
    const data = await loadAttendees(eventId, interaction.guildId)
    if (!data) {
        const language = await interactionLanguage(interaction.guildId)
        await replyToClicker(
            interaction,
            matchUnavailableView(getAnnouncementMessages(language)),
            { language }
        )
        return
    }
    const leadership = await isMatchLeadership(
        interaction.client,
        data.event.guildId,
        interaction.user.id,
        data.config.dashboardAdminRoleId
    )
    await replyToClicker(
        interaction,
        attendeesViewFor(data, {
            leadership,
            filter,
            page,
            names: displayNames(interaction.client, data),
        }),
        {
            language: data.config.defaultLanguage,
            style: data.config.messageStyle,
            replaceCard: true,
        }
    )
}

/** "Zobrazit přihlášené" on the announcement: a new private card. */
export async function handleAttendeesButton(interaction: ButtonInteraction) {
    const eventId = interaction.customId.slice(ATTENDEES_PREFIX.length)
    await interaction.deferReply({ ephemeral: Boolean(interaction.guildId) })
    await showList(interaction, eventId, { kind: "all" }, 1)
}

/** "Skupina: …" narrows the same card to one group (L1-73, L1-86). */
export async function handleAttendeesFilter(
    interaction: StringSelectMenuInteraction
) {
    const eventId = interaction.customId.slice(ATTENDEES_FILTER_PREFIX.length)
    await interaction.deferUpdate()
    await showList(
        interaction,
        eventId,
        decodeSignupListFilter(interaction.values[0]),
        1
    )
}

/** "Předchozí" / "Další" (L1-83). */
export async function handleAttendeesPage(interaction: ButtonInteraction) {
    const { eventId, filter, page } = parseAttendeesCustomId(
        interaction.customId
    )
    await interaction.deferUpdate()
    await showList(interaction, eventId, filter, page)
}

function reminderReply(
    result:
        | { status: "queued"; queued: number }
        | { status: "rate_limited"; retryAt: string }
        | { status: "unavailable"; reason: ManualReminderUnavailable }
        | { status: "not_found" },
    language: string | undefined,
    locale: string
): MessageView {
    const copy = getAnnouncementMessages(language)
    const text = copy.attendees
    switch (result.status) {
        case "queued":
            return result.queued > 0
                ? errorCard({
                      title: text.remindQueuedTitle,
                      body: fillTemplate(text.remindQueuedBody, {
                          members: formatCount(
                              locale,
                              result.queued,
                              text.remindMembers
                          ),
                      }),
                  })
                : errorCard({
                      title: text.remindNobodyTitle,
                      body: text.remindNobodyBody,
                  })
        case "rate_limited":
            return errorCard({
                title: text.remindLimitedTitle,
                body: fillTemplate(text.remindLimitedBody, {
                    time: discordTimestamp(result.retryAt, "R") ?? "",
                }),
            })
        case "unavailable":
            return result.reason === "signups_closed"
                ? errorCard({
                      title: text.remindClosedTitle,
                      body: text.remindClosedBody,
                  })
                : matchUnavailableView(copy)
        case "not_found":
            return matchUnavailableView(copy)
    }
}

/**
 * "Připomenout bez odpovědi": the sign-up reminder DM to members without an
 * answer, at most once an hour per match (L1-84, L1-B11). The same queue as
 * the dashboard's "Připomenout"; the bot sends the DMs.
 */
export async function handleAttendeesRemind(interaction: ButtonInteraction) {
    const eventId = interaction.customId.slice(ATTENDEES_REMIND_PREFIX.length)
    await interaction.deferReply({ ephemeral: Boolean(interaction.guildId) })
    const data = await loadAttendees(eventId, interaction.guildId)
    const language = data?.config.defaultLanguage
    const options = { language, style: data?.config.messageStyle }
    if (!data) {
        await replyToClicker(
            interaction,
            matchUnavailableView(
                getAnnouncementMessages(
                    await interactionLanguage(interaction.guildId)
                )
            ),
            options
        )
        return
    }
    const copy = getAnnouncementMessages(language)
    const leadership = await isMatchLeadership(
        interaction.client,
        data.event.guildId,
        interaction.user.id,
        data.config.dashboardAdminRoleId
    )
    if (!leadership) {
        await replyToClicker(
            interaction,
            notAllowedCard({
                title: copy.attendees.remindNotAllowedTitle,
                whoMay: copy.attendees.remindNotAllowedWho,
            }),
            options
        )
        return
    }
    const result = (await convex.mutation(ref.requestManual, {
        secret: env.internalSecret,
        guildId: data.event.guildId,
        eventId,
        audience: "unanswered",
        requestedBy: interaction.user.id,
    })) as Parameters<typeof reminderReply>[0]
    logInfo("attendees", "Leadership asked for sign-up reminders", {
        eventId,
        guildId: data.event.guildId,
        status: result.status,
    })
    await replyToClicker(
        interaction,
        reminderReply(result, language, copy.locale),
        options
    )
}
