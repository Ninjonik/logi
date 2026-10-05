import type {
    MessageButton,
    MessageView,
} from "../discord-messages/message-view"
import { fillTemplate } from "../discord-messages/format"
import { channelMention } from "./text"

/**
 * The private cards around "Sdílet" (M2-25, M2-26), shared by `/stats` and
 * `/player`. Their titles name the channel as a mention, which a plain
 * header title cannot hold, so the title is a markdown heading.
 */
function titledCard(input: {
    title: string
    body?: string
    action?: MessageButton
}): MessageView {
    return {
        accent: "clan",
        ephemeral: true,
        blocks: [
            {
                kind: "text",
                markdown: [`### ${input.title}`, input.body]
                    .filter(Boolean)
                    .join("\n"),
            },
            ...(input.action
                ? [{ kind: "buttons" as const, buttons: [input.action] }]
                : []),
        ],
    }
}

const channelOrFallback = (channelId: string) =>
    channelMention(channelId) ?? "#?"

/** "Sdíleno do #statistiky" with "Zobrazit zprávu" (M2-25). */
export function sharedDoneCard(input: {
    title: string
    viewMessage: string
    channelId: string
    messageUrl?: string
}): MessageView {
    return titledCard({
        title: fillTemplate(input.title, {
            channel: channelOrFallback(input.channelId),
        }),
        action:
            input.messageUrl && /^https:\/\//.test(input.messageUrl)
                ? {
                      kind: "link",
                      url: input.messageUrl,
                      label: input.viewMessage,
                  }
                : undefined,
    })
}

/**
 * "Do #obecne teď sdílet nejde": the person or the bot lacks the right to
 * post there (M2-26). The optional action is "Vybrat jiný kanál".
 */
export function shareDeniedCard(input: {
    title: string
    body: string
    channelId: string
    action?: MessageButton
}): MessageView {
    return titledCard({
        title: fillTemplate(input.title, {
            channel: channelOrFallback(input.channelId),
        }),
        body: input.body,
        action: input.action,
    })
}

/** The URL of a posted message, for "Zobrazit zprávu". */
export function discordMessageUrl(
    guildId: string,
    channelId: string,
    messageId: string
) {
    return `https://discord.com/channels/${guildId}/${channelId}/${messageId}`
}
