/**
 * Replies of the announcement's buttons (board L1 1.10, L1-87): private in
 * the server, a normal message in a DM (the sign-up reminder's buttons work
 * there too), and a reply card the clicker already sees is updated in place
 * rather than stacking a new one.
 */

import { MessageFlags } from "discord.js"

import {
    editPayload,
    interactionReplyPayload,
    type MessageKitOptions,
} from "../ui/message-kit"
import type { MessageView } from "../../../src/domain/discord-messages/message-view"
import type { PrivateReplyTarget } from "../ui/replies"

export type ClickerTarget = PrivateReplyTarget & {
    guildId: string | null
    message?: { flags: { has(flag: number): boolean } } | null
    update?: (options: ReturnType<typeof editPayload>) => Promise<unknown>
}

/** Whether the interaction came from one of our private reply cards. */
export function fromPrivateCard(interaction: ClickerTarget) {
    return Boolean(
        interaction.guildId &&
        interaction.message?.flags.has(MessageFlags.Ephemeral)
    )
}

/**
 * Answers the person who clicked: privately in a server, normally in a DM.
 * With `replaceCard`, a click on a private reply card turns that card into
 * the answer.
 */
export async function replyToClicker(
    interaction: ClickerTarget,
    view: MessageView,
    options: MessageKitOptions & { replaceCard?: boolean } = {}
) {
    const shown: MessageView = {
        ...view,
        ephemeral: Boolean(interaction.guildId),
    }
    if (
        options.replaceCard &&
        interaction.update &&
        !interaction.deferred &&
        !interaction.replied &&
        fromPrivateCard(interaction)
    ) {
        await interaction.update(editPayload(shown, options))
        return
    }
    if (interaction.deferred && !interaction.replied) {
        await interaction.editReply(editPayload(shown, options))
        return
    }
    const payload = interactionReplyPayload(shown, options)
    if (interaction.replied) await interaction.followUp(payload)
    else await interaction.reply(payload)
}
