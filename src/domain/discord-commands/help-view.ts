import type {
    MessageBlock,
    MessageView,
} from "../discord-messages/message-view"
import type { HelpCommandList, StaffReason } from "./permissions"
import { fillTemplate } from "../discord-messages/format"
import type { LogiCommand } from "./catalog"
import { channelMention } from "./text"

/** The `/help` copy of the commands module (`clan-language/commands.ts`). */
export type HelpCopy = {
    label: string
    title: string
    lines: Record<Exclude<LogiCommand, "help">, string>
    channelsAll: string
    recruitmentLine: string
    ticketsLine: string
    signupLine: string
    staffTitle: string
    staffReason: Record<StaffReason, string>
    guide: string
    nothing: string
}

/** The channels with the clan's buttons (M2-07); IDs, any may be missing. */
export type HelpChannels = {
    recruitment?: string | null
    tickets?: string | null
    announcements?: string | null
}

function commandLines(commands: readonly LogiCommand[], copy: HelpCopy) {
    return commands
        .filter((command): command is Exclude<LogiCommand, "help"> =>
            Boolean(command !== "help")
        )
        .map((command) => `\`/${command}\`\n${copy.lines[command]}`)
        .join("\n")
}

/** "Přihláška do klanu, tickety a přihlašování na zápasy jsou tlačítka v kanálech …". */
export function helpChannelsLine(copy: HelpCopy, channels: HelpChannels) {
    const recruitment = channelMention(channels.recruitment)
    const tickets = channelMention(channels.tickets)
    const announcements = channelMention(channels.announcements)
    if (recruitment && tickets && announcements)
        return fillTemplate(copy.channelsAll, {
            recruitment,
            tickets,
            announcements,
        })
    const lines = [
        recruitment
            ? fillTemplate(copy.recruitmentLine, { channel: recruitment })
            : undefined,
        tickets
            ? fillTemplate(copy.ticketsLine, { channel: tickets })
            : undefined,
        announcements
            ? fillTemplate(copy.signupLine, { channel: announcements })
            : undefined,
    ].filter((line): line is string => Boolean(line))
    return lines.length ? lines.join(" ") : undefined
}

/**
 * The private `/help` card (M2-05..09): the commands this person may use in
 * the clan language, the channels with the clan's buttons, a "Pro správce"
 * part when they may use staff commands, and "Návod na webu". It never posts
 * to a channel and has no options.
 */
export function buildHelpView(input: {
    copy: HelpCopy
    clanName: string
    list: HelpCommandList
    channels: HelpChannels
    guideUrl: string
}): MessageView {
    const { copy, list } = input
    const blocks: MessageBlock[] = []
    if (list.members.length)
        blocks.push({
            kind: "text",
            markdown: commandLines(list.members, copy),
        })
    const channels = helpChannelsLine(copy, input.channels)
    if (channels) blocks.push({ kind: "text", markdown: channels })
    if (list.staff.length) {
        blocks.push({ kind: "separator", divider: true, spacing: "small" })
        blocks.push({
            kind: "text",
            markdown: [
                `**${copy.staffTitle.toLocaleUpperCase()}**`,
                ...(list.staffReason
                    ? [`-# ${copy.staffReason[list.staffReason]}`]
                    : []),
            ].join("\n"),
        })
        blocks.push({ kind: "text", markdown: commandLines(list.staff, copy) })
    }
    if (!list.members.length && !list.staff.length)
        blocks.push({ kind: "text", markdown: copy.nothing })
    blocks.push({ kind: "separator", divider: true, spacing: "small" })
    blocks.push({
        kind: "buttons",
        buttons: [{ kind: "link", url: input.guideUrl, label: copy.guide }],
    })
    return {
        accent: "clan",
        ephemeral: true,
        header: {
            label: fillTemplate(copy.label, { clan: input.clanName }),
            title: copy.title,
        },
        blocks,
    }
}
