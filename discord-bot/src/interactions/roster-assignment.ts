import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    escapeMarkdown,
} from "discord.js"

import {
    discordTimestamp,
    fillTemplate,
    findSquadLeader,
    resolveMessageAccentColor,
} from "../../../src/domain/discord-messages/format"
import { getClanDiscordMessages } from "../../../src/lib/clan-language"
import type { DiscordConfig, EventRecord, Roster } from "../types"

type Messages = ReturnType<typeof getClanDiscordMessages>
type RosterPlayer = Roster["squads"][number]["players"][number]

export type RosterAssignmentReply = {
    content?: string
    embeds?: EmbedBuilder[]
    components?: Array<ActionRowBuilder<ButtonBuilder>>
    allowedMentions: { parse: [] }
}

function capitalize(value: string, locale: string) {
    return value ? value[0]!.toLocaleUpperCase(locale) + value.slice(1) : value
}

function singleLine(value: string) {
    return value.replace(/[\s\p{Cc}]+/gu, " ").trim()
}

/** Inline code that survives backticks inside the password. */
function inlineCode(value: string) {
    return value.includes("`") ? `\`\` ${value} \`\`` : `\`${value}\``
}

function playerLabel(player: RosterPlayer) {
    if (player.id) return `<@${player.id}>`
    const customName = player.customName?.trim()
    return customName ? escapeMarkdown(singleLine(customName)) : undefined
}

function meetingLine(
    config: DiscordConfig,
    event: EventRecord,
    messages: Messages
) {
    const time = discordTimestamp(event.meetingStart, "t")
    if (!time) return undefined
    const relative = discordTimestamp(event.meetingStart, "R")
    const channelId =
        event.meetingChannelId?.trim() || config.meetingChannelId?.trim()
    const values = {
        time: relative ? `${time} (${relative})` : time,
        channel: channelId ? `<#${channelId}>` : "",
    }
    return fillTemplate(
        channelId
            ? messages.assignment.meetingInChannel
            : messages.assignment.meeting,
        values
    )
}

/**
 * Server line for a rostered player. This private reply is the only bot
 * message that may carry the server password.
 */
function serverLine(event: EventRecord, messages: Messages) {
    const server = event.server?.trim()
    const password = event.serverPassword?.trim()
    const parts = [
        server
            ? fillTemplate(messages.assignment.server, {
                  server: escapeMarkdown(singleLine(server)),
              })
            : undefined,
        password
            ? fillTemplate(messages.assignment.serverPassword, {
                  password: inlineCode(password),
              })
            : undefined,
    ].filter((part): part is string => Boolean(part))
    return parts.length
        ? capitalize(parts.join(" · "), messages.locale)
        : undefined
}

/**
 * The private "My assignment" reply: squad and role, squad leader, meeting
 * time and channel, then the server and its password. Only players on the
 * published roster (squads or reserves) see any of it.
 */
export function buildRosterAssignmentReply(input: {
    config: DiscordConfig
    event: EventRecord
    roster: Roster | null
    userId: string
}): RosterAssignmentReply {
    const { config, event, roster, userId } = input
    const messages = getClanDiscordMessages(config.defaultLanguage)
    if (!roster?.published) {
        return {
            content: messages.interaction.rosterNotPublished,
            allowedMentions: { parse: [] },
        }
    }

    const squad = roster.squads.find((item) =>
        item.players.some((player) => player.id === userId)
    )
    const player = squad?.players.find((item) => item.id === userId)
    const isReserve = !player && roster.reservePlayerIds.includes(userId)
    if (!squad || !player) {
        if (!isReserve) {
            return {
                content: messages.embed.assignmentUnassigned,
                allowedMentions: { parse: [] },
            }
        }
    }

    const role = player?.roleName?.trim()
    const title =
        squad && player
            ? [singleLine(squad.name), role ? singleLine(role) : undefined]
                  .filter(Boolean)
                  .join(" · ")
            : messages.assignment.reserveTitle
    const leader = squad ? findSquadLeader(squad.players) : undefined
    const leaderName =
        leader && leader !== player ? playerLabel(leader) : undefined
    const meeting = meetingLine(config, event, messages)
    const lines = [
        isReserve ? messages.embed.assignmentReserve : undefined,
        capitalize(
            [
                leaderName
                    ? `${messages.assignment.squadLeader}: ${leaderName}`
                    : undefined,
                meeting,
            ]
                .filter(Boolean)
                .join(" · "),
            messages.locale
        ),
        player?.note?.trim() ? escapeMarkdown(player.note.trim()) : undefined,
        serverLine(event, messages),
    ].filter((line): line is string => Boolean(line))

    const embed = new EmbedBuilder()
        .setTitle(title.slice(0, 256) || messages.embed.myAssignment)
        .setColor(
            resolveMessageAccentColor({
                messageStyle: config.messageStyle,
            })
        )
    if (lines.length) embed.setDescription(lines.join("\n").slice(0, 4096))
    if (event.serverPassword?.trim()) {
        embed.setFooter({ text: messages.assignment.passwordNotice })
    }

    const acknowledged = player
        ? player.ack
        : Boolean(
              roster.reserveAttendances?.find(
                  (attendance) => attendance.userId === userId
              )?.ack
          )
    // Attendance buttons only work while the event is starting.
    const buttons =
        event.status === "starting"
            ? [
                  ...(acknowledged
                      ? []
                      : [
                            new ButtonBuilder()
                                .setCustomId(`attendance:${event.id}:ack`)
                                .setStyle(ButtonStyle.Success)
                                .setLabel(
                                    messages.buttons.acknowledgeAttendance
                                ),
                        ]),
                  new ButtonBuilder()
                      .setCustomId(`attendance-late:${event.id}`)
                      .setStyle(ButtonStyle.Secondary)
                      .setLabel(messages.embed.runningLate),
              ]
            : []

    return {
        embeds: [embed],
        components: buttons.length
            ? [new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)]
            : [],
        allowedMentions: { parse: [] },
    }
}
