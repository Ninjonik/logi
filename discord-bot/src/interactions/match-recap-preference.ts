import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    type ButtonInteraction,
} from "discord.js"
import { getEventMessages } from "../../../src/lib/clan-language/events"
import { convex, references } from "../convex"
import { env } from "../environment"

export function buildMatchRecapPreferenceUpdate(
    enabled: boolean,
    language: string
) {
    const messages = getEventMessages(language).matchRecap
    return {
        content: enabled ? messages.subscribed : messages.unsubscribed,
        components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setStyle(ButtonStyle.Secondary)
                    .setLabel(
                        enabled ? messages.unsubscribe : messages.subscribe
                    )
                    .setCustomId(
                        `match-recap:${enabled ? "unsubscribe" : "subscribe"}`
                    )
            ),
        ],
    }
}

export async function handleMatchRecapPreference(
    interaction: ButtonInteraction
) {
    const enabled =
        interaction.customId === "match-recap:subscribe"
            ? true
            : interaction.customId === "match-recap:unsubscribe"
              ? false
              : null
    if (enabled === null) {
        await interaction.reply({
            content: getEventMessages(interaction.locale).matchRecap
                .invalidAction,
            flags: MessageFlags.Ephemeral,
        })
        return
    }
    await convex.mutation(references.setMatchRecapNotifications, {
        secret: env.internalSecret,
        userId: interaction.user.id,
        enabled,
    })
    await interaction.update(
        buildMatchRecapPreferenceUpdate(enabled, interaction.locale)
    )
}
