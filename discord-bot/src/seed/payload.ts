import {
    MessageFlags,
    TextDisplayBuilder,
    type MessageCreateOptions,
} from "discord.js"

import type { MessageView } from "../../../src/domain/discord-messages/message-view"
import { renderMessageView, type MessageKitOptions } from "../ui/message-kit"

/**
 * A seed message payload from the shared kit. The call's "@Seed" line sits
 * above the card as a normal message line (P5-07) and is the only mention
 * Discord may deliver; the managed publisher sends it on create and edits
 * with no mentions at all, so progress edits ping nobody (P5-03, P5-12).
 */
export function seedMessagePayload(
    view: MessageView,
    options: MessageKitOptions,
    lead: { roleId: string; markdown: string } | null = null
): MessageCreateOptions {
    const { container } = renderMessageView(view, options)
    return {
        components: lead
            ? [new TextDisplayBuilder().setContent(lead.markdown), container]
            : [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: lead
            ? { parse: [], roles: [lead.roleId] }
            : { parse: [] },
    }
}
