import { fetchMutation, fetchQuery } from "convex/nextjs"
import { makeFunctionReference } from "convex/server"

import { rosterUpdateNotificationsHandler } from "@/lib/api/roster-update-notifications-route"
import { resolveRosterUpdateChannelIds } from "@/domain/rosters/roster-update-channel"
import { getServerContextUncached } from "@/lib/read-models/server-context"
import { getEventMetadata, getGuildMetadata } from "@/lib/server-metadata"
import { getDiscordConfigByGuild } from "@/lib/server-discord-settings"
import { currentDashboardActor } from "@/lib/gateways/dashboard-actor"
import { summarizeRosterUpdates } from "@/lib/roster-update-summary"
import { getInternalAuthSecret, getSiteUrl } from "@/lib/env"
import { getUsersByIds } from "@/lib/server-user-management"
import { getClanDiscordMessages } from "@/lib/clan-language"
import { sendDiscordBotDm } from "@/lib/discord"
import { getDiscordBotToken } from "@/lib/env"
import type { Roster } from "@/types/domain"

export const runtime = "nodejs"

const getEventSyncContextReference = makeFunctionReference<"query">(
    "discordSync:getEventSyncContext"
)
const updateRosterUpdateMessageReference = makeFunctionReference<"mutation">(
    "discordSync:updateRosterUpdateMessage"
)

class DiscordChannelMessageError extends Error {
    constructor(
        readonly status: number,
        readonly code?: number,
        readonly details?: string
    ) {
        super(
            `Unable to post roster update message to Discord (HTTP ${status}${code ? `, code ${code}` : ""}${details ? `: ${details}` : ""}).`
        )
    }
}

async function postDiscordChannelMessage(
    channelId: string,
    content: string,
    messageId?: string
) {
    const botToken = getDiscordBotToken()
    if (!botToken) {
        throw new Error("Discord bot token is missing.")
    }

    const response = await fetch(
        `https://discord.com/api/v10/channels/${channelId}/messages${messageId ? `/${messageId}` : ""}`,
        {
            method: messageId ? "PATCH" : "POST",
            headers: {
                Authorization: `Bot ${botToken}`,
                "content-type": "application/json",
            },
            body: JSON.stringify({
                flags: 32768,
                // Squad and role names are free text; they must never ping.
                allowed_mentions: { parse: [] },
                components: [
                    {
                        type: 17,
                        accent_color: 0x5865f2,
                        components: [{ type: 10, content }],
                    },
                ],
            }),
            cache: "no-store",
        }
    )

    if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
            code?: number
            message?: string
        } | null
        throw new DiscordChannelMessageError(
            response.status,
            payload?.code,
            payload?.message
        )
    }
    return (await response.json()) as { id: string }
}

function formatAnnouncementMessage(input: {
    eventName: string
    messages: ReturnType<typeof getClanDiscordMessages>
    summary: ReturnType<typeof summarizeRosterUpdates>
    rosterUrl?: string
}) {
    const lines = [`📋 **${input.messages.rosterUpdate.announcementTitle}**`]

    if (input.summary.addedLines.length) {
        lines.push(
            "",
            `🟢 **${input.messages.rosterUpdate.addedLabel}**`,
            ...input.summary.addedLines
        )
    }
    if (input.summary.removedLines.length) {
        lines.push(
            "",
            `🔴 **${input.messages.rosterUpdate.removedLabel}**`,
            ...input.summary.removedLines
        )
    }
    if (input.summary.movedLines.length) {
        lines.push(
            "",
            `🔁 **${input.messages.rosterUpdate.movedLabel}**`,
            ...input.summary.movedLines
        )
    }
    if (input.summary.roleChangedLines.length) {
        lines.push(
            "",
            `🔄 **${input.messages.rosterUpdate.roleChangedLabel}**`,
            ...input.summary.roleChangedLines
        )
    }

    return lines.join("\n").slice(0, 1900)
}

function formatDmMessage(input: {
    eventName: string
    playerName: string
    messages: ReturnType<typeof getClanDiscordMessages>
    userId: string
    summary: ReturnType<typeof summarizeRosterUpdates>
    rosterUrl?: string
}) {
    const lines = [
        input.messages.rosterUpdate.dmIntro
            .replace("{name}", input.playerName)
            .replace("{event}", input.eventName),
    ]

    if (input.summary.addedUserIds.includes(input.userId)) {
        lines.push(input.messages.rosterUpdate.dmAdded)
    }
    if (input.summary.removedUserIds.includes(input.userId)) {
        lines.push(input.messages.rosterUpdate.dmRemoved)
    }
    if (input.summary.movedUserIds.includes(input.userId)) {
        lines.push(input.messages.rosterUpdate.dmMoved)
    }
    if (input.summary.roleChangedUserIds.includes(input.userId)) {
        const change = input.summary.roleChanges[input.userId]
        lines.push(
            `${input.messages.rosterUpdate.dmRoleChanged}: ${change?.previous ?? "Unassigned"} → ${change?.next ?? "Unassigned"}`
        )
    }

    if (input.rosterUrl) lines.push("", input.rosterUrl)

    return lines.join("\n")
}

async function notifyRosterUpdate(input: {
    serverId: string
    previousRoster: Roster
    roster: Roster
    memberIds: ReadonlySet<string>
    postAnnouncement: boolean
    notifyPlayers: boolean
}) {
    const { serverId, previousRoster, roster: nextRoster, memberIds } = input

    const [guild, event, discordConfig] = await Promise.all([
        getGuildMetadata(serverId),
        getEventMetadata(nextRoster.eventId),
        getDiscordConfigByGuild(serverId),
    ])

    if (!guild || !event) throw new Error("Roster context not found.")

    const changedUserIds = [
        ...new Set([
            ...previousRoster.squads.flatMap(
                (squad) =>
                    squad.players
                        .map((player) => player.id)
                        .filter(Boolean) as string[]
            ),
            ...nextRoster.squads.flatMap(
                (squad) =>
                    squad.players
                        .map((player) => player.id)
                        .filter(Boolean) as string[]
            ),
        ]),
    ]
    const users = await getUsersByIds(changedUserIds, guild.discordId)
    const summary = summarizeRosterUpdates(previousRoster, nextRoster, users)

    if (!summary.hasChanges) {
        return { ok: true, hasChanges: false, dmSentUserIds: [] }
    }

    const messages = getClanDiscordMessages(discordConfig?.defaultLanguage)
    const channelIds = resolveRosterUpdateChannelIds({
        eventAnnouncementChannelId: event.announcementChannelId,
        eventInfoChannelId: event.eventInfoChannelId,
        configuredAnnouncementChannelId: discordConfig?.announcementsChannelId,
        configuredEventInfoChannelId: discordConfig?.eventInfoChannelId,
    })
    // The roster link is useful context, but a temporary Convex read failure must
    // never prevent the actual DM notification from being sent.
    const syncContext = (await fetchQuery(getEventSyncContextReference, {
        secret: getInternalAuthSecret(),
        eventId: event.id as never,
    }).catch(() => null)) as {
        syncState: {
            eventInfoMessageId?: string
            announcementMessageId?: string
            rosterUpdateChannelId?: string
            rosterUpdateMessageId?: string
        } | null
    } | null
    const rosterMessageId =
        syncContext?.syncState?.eventInfoMessageId ??
        syncContext?.syncState?.announcementMessageId
    const rosterChannelId = syncContext?.syncState?.eventInfoMessageId
        ? channelIds.eventInfoChannelId
        : channelIds.announcementChannelId
    const rosterUrl =
        rosterChannelId && rosterMessageId
            ? `https://discord.com/channels/${guild.discordId}/${rosterChannelId}/${rosterMessageId}`
            : undefined
    // Only the clan's members are ever sent a direct message.
    const changedRecipients = [
        ...new Set([
            ...summary.addedUserIds,
            ...summary.removedUserIds,
            ...summary.movedUserIds,
            ...summary.roleChangedUserIds,
        ]),
    ].filter((userId) => memberIds.has(userId))
    const usersById = new Map(users.map((user) => [user.discordId, user]))
    const dmSentUserIds: string[] = []
    const dmFailedUserIds: string[] = []

    if (input.notifyPlayers)
        await Promise.all(
            changedRecipients.map(async (userId) => {
                const user = usersById.get(userId)

                try {
                    await sendDiscordBotDm(
                        userId,
                        formatDmMessage({
                            eventName: event.name,
                            playerName: user?.name ?? userId,
                            messages,
                            userId,
                            summary,
                            rosterUrl,
                        })
                    )
                    dmSentUserIds.push(userId)
                } catch {
                    dmFailedUserIds.push(userId)
                }
            })
        )

    const rosterUpdateChannelId = channelIds.rosterUpdateChannelId
    if (input.postAnnouncement && rosterUpdateChannelId) {
        const existingDigestId =
            syncContext?.syncState?.rosterUpdateChannelId ===
            rosterUpdateChannelId
                ? syncContext.syncState.rosterUpdateMessageId
                : undefined
        const content = formatAnnouncementMessage({
            eventName: event.name,
            messages,
            summary,
        })
        let digest: { id: string }
        try {
            digest = await postDiscordChannelMessage(
                rosterUpdateChannelId,
                content,
                existingDigestId
            )
        } catch (error) {
            // Discord returns 10008 when the previously stored digest was
            // deleted. Post a replacement instead of failing the update.
            if (
                existingDigestId &&
                error instanceof DiscordChannelMessageError &&
                error.code === 10008
            ) {
                digest = await postDiscordChannelMessage(
                    rosterUpdateChannelId,
                    content
                )
            } else {
                throw error
            }
        }
        await fetchMutation(updateRosterUpdateMessageReference, {
            secret: getInternalAuthSecret(),
            eventId: event.id as never,
            guildId: guild.discordId,
            channelId: rosterUpdateChannelId,
            messageId: digest.id,
        })
    }

    return {
        ok: true,
        hasChanges: true,
        dmSentUserIds,
        dmFailedUserIds,
        postedAnnouncement: Boolean(
            input.postAnnouncement && rosterUpdateChannelId
        ),
    }
}

const handler = rosterUpdateNotificationsHandler({
    origin: new URL(getSiteUrl()).origin,
    access: async (serverId, rosterId) => {
        const [context, actor] = await Promise.all([
            getServerContextUncached(serverId),
            currentDashboardActor(),
        ])
        if (!context?.canAdmin || !actor) return null
        const roster = context.rosters.find((item) => item.id === rosterId)
        if (!roster) return "not_found"
        return {
            roster,
            memberIds: new Set(
                context.assignments.map((assignment) => assignment.userId)
            ),
        }
    },
    notify: notifyRosterUpdate,
})

/** Tells players about changes to a published roster; clan admins only. */
export async function POST(
    request: Request,
    context: { params: Promise<{ serverId: string; rosterId: string }> }
) {
    return handler(request, await context.params)
}
