import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
} from "discord.js"
import type { Client } from "discord.js"

import { getEventMessages } from "../../../src/lib/clan-language/events"
import { type ClanLanguage } from "../../../src/lib/clan-language/core"
import { convex, references } from "../convex"
import { env } from "../environment"

type MatchRecap = {
    userId: string
    eventName: string
    mapName?: string
    kills: number
    deaths: number
    kd: number
    previousTen?: {
        matches: number
        kills: number
        deaths: number
        kd: number
    }
}
type PendingMatchRecap = MatchRecap & { recapId: string; discordUserId: string }

function replaceValues(template: string, values: Record<string, string>) {
    return Object.entries(values).reduce(
        (message, [key, value]) => message.split(`{${key}}`).join(value),
        template
    )
}

export function buildMatchRecapCopy(language: ClanLanguage, recap: MatchRecap) {
    const messages = getEventMessages(language).matchRecap
    const comparison = recap.previousTen?.matches
        ? replaceValues(messages.comparisonWithPrevious, {
              matches: String(recap.previousTen.matches),
              kills: recap.previousTen.kills.toFixed(1),
              deaths: recap.previousTen.deaths.toFixed(1),
              kd: recap.previousTen.kd.toFixed(2),
          })
        : messages.noComparisonAvailable

    return {
        title: replaceValues(messages.title, { event: recap.eventName }),
        description: [
            recap.mapName ?? messages.fallbackMapName,
            replaceValues(messages.stats, {
                kills: String(recap.kills),
                deaths: String(recap.deaths),
                kd: recap.kd.toFixed(2),
            }),
        ].join("\n"),
        comparisonTitle: messages.comparisonTitle,
        comparison,
        viewStats: messages.viewStats,
        unsubscribe: messages.unsubscribe,
    }
}

export async function processMatchRecaps(
    client: Client,
    eventId: string,
    language: ClanLanguage
) {
    const recaps = (await convex.query(references.getPendingMatchRecaps, {
        secret: env.internalSecret,
        eventId: eventId as never,
        deliveryVersion: 2,
    })) as PendingMatchRecap[]
    for (const candidate of recaps) {
        if (!candidate.recapId || !/^\d{17,20}$/.test(candidate.discordUserId))
            continue
        const user = await client.users
            .fetch(candidate.discordUserId)
            .catch(() => null)
        if (!user) continue
        // Fetching Discord can take time. Re-read the binding and opt-out immediately before sending.
        const recap = (await convex.query(
            references.prepareMatchRecapDelivery,
            {
                secret: env.internalSecret,
                recapId: candidate.recapId,
                eventId,
                discordUserId: candidate.discordUserId,
            }
        )) as PendingMatchRecap | null
        if (
            !recap ||
            recap.recapId !== candidate.recapId ||
            recap.discordUserId !== candidate.discordUserId ||
            recap.userId !== candidate.userId
        )
            continue
        const playerPath = encodeURIComponent(recap.userId),
            eventPath = encodeURIComponent(eventId)
        const link = `${env.appSiteUrl}/${language}/players/${playerPath}/matches/${eventPath}`
        const image = `${env.appSiteUrl}/api/og/player-match/${playerPath}/${eventPath}`
        const copy = buildMatchRecapCopy(language, recap)
        const sent = await user
            .send({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x5865f2)
                        .setTitle(copy.title)
                        .setDescription(copy.description)
                        .addFields({
                            name: copy.comparisonTitle,
                            value: copy.comparison,
                        })
                        .setImage(image)
                        .setURL(link),
                ],
                components: [
                    new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder()
                            .setStyle(ButtonStyle.Link)
                            .setLabel(copy.viewStats)
                            .setURL(link),
                        new ButtonBuilder()
                            .setStyle(ButtonStyle.Secondary)
                            .setLabel(copy.unsubscribe)
                            .setCustomId("match-recap:unsubscribe")
                    ),
                ],
            })
            .then(() => true)
            .catch(() => false)
        if (sent)
            await convex.mutation(references.markMatchRecapSent, {
                secret: env.internalSecret,
                recapId: recap.recapId,
                discordUserId: recap.discordUserId,
            })
    }
}
