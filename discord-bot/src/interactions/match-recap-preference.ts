/**
 * "Vypnout shrnutí" / "Zapnout shrnutí" on a match recap DM (board L2-50,
 * L2-51): the choice applies to all of the player's clans and the same DM
 * is redrawn with the "Shrnutí vypnutá" chip, in the clan's language, not
 * the Discord client's. Older recap DMs carry no match; they still toggle
 * and are answered with a short card.
 */

import type { ButtonInteraction } from "discord.js"

import {
    buildMatchRecapView,
    loadRecapInputs,
    type MatchRecapData,
} from "../sync/match-recaps"
import { simpleReply } from "../../../src/domain/discord-messages/direct-message-views"
import { getDirectMessages } from "../../../src/lib/clan-language/direct-messages"
import { clanLanguageForGuild } from "../runtime/clan-language"
import type { InteractionFeature } from "./registry"
import { replyCard } from "./roster-assignment"
import { editPayload } from "../ui/message-kit"
import { convex, references } from "../convex"
import { env } from "../environment"

const PREFIX = "match-recap:"

/** `match-recap:<unsubscribe|subscribe>[:<eventId>]` → the wanted state. */
export function parseRecapAction(customId: string) {
    const [, action, eventId] = customId.split(":")
    const enabled =
        action === "subscribe" ? true : action === "unsubscribe" ? false : null
    return enabled === null ? null : { enabled, eventId: eventId || undefined }
}

/** A clan the player shares with the bot, for older recap DMs without a match. */
async function sharedClanLanguage(interaction: ButtonInteraction) {
    for (const guild of interaction.client.guilds.cache.values()) {
        const member = await guild.members
            .fetch(interaction.user.id)
            .catch(() => null)
        if (member) return await clanLanguageForGuild(guild.id)
    }
    return undefined
}

export async function handleMatchRecapPreference(
    interaction: ButtonInteraction
) {
    const parsed = parseRecapAction(interaction.customId)
    const inputs = parsed?.eventId
        ? await loadRecapInputs(parsed.eventId)
        : null
    const language =
        inputs?.context.config.defaultLanguage ??
        (await sharedClanLanguage(interaction))
    const copy = getDirectMessages(language)
    if (!parsed) {
        await replyCard(
            interaction,
            simpleReply({
                title: copy.replies.unavailableTitle,
                body: copy.replies.unavailableBody,
                dm: !interaction.guildId,
            }),
            { language }
        )
        return
    }
    await convex.mutation(references.setMatchRecapNotifications, {
        secret: env.internalSecret,
        userId: interaction.user.id,
        enabled: parsed.enabled,
    })
    const recap =
        inputs && parsed.eventId
            ? ((await convex
                  .query(references.getMatchRecapCard, {
                      secret: env.internalSecret,
                      eventId: parsed.eventId,
                      discordUserId: interaction.user.id,
                  })
                  .catch(() => null)) as MatchRecapData | null)
            : null
    if (inputs && recap) {
        await interaction.update(
            editPayload(
                buildMatchRecapView({
                    inputs,
                    recap,
                    discordUserId: interaction.user.id,
                    enabled: parsed.enabled,
                }),
                {
                    language,
                    style: inputs.context.config.messageStyle,
                }
            )
        )
        return
    }
    await replyCard(
        interaction,
        simpleReply({
            title: parsed.enabled ? copy.recap.turnOn : copy.recap.offChip,
            body: parsed.enabled ? undefined : copy.recap.offDetail,
            dm: !interaction.guildId,
        }),
        { language }
    )
}

export const matchRecapInteractions: InteractionFeature = {
    name: "match-recap",
    register(registry) {
        registry.button(PREFIX, handleMatchRecapPreference)
    },
}
