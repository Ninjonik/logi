import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
} from "discord.js"
import type { Client } from "discord.js"

import {
    getClanDiscordMessages,
    type ClanLanguage,
} from "../../../src/lib/clan-language"
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

function replaceValues(template: string, values: Record<string, string>) {
    return Object.entries(values).reduce(
        (message, [key, value]) => message.split(`{${key}}`).join(value),
        template
    )
}

export function buildMatchRecapCopy(language: ClanLanguage, recap: MatchRecap) {
    const messages = getClanDiscordMessages(language).matchRecap
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
    })) as MatchRecap[]
    for (const recap of recaps) {
        const user = await client.users.fetch(recap.userId).catch(() => null)
        if (!user) continue
        const link = `${env.appSiteUrl}/${language}/players/${recap.userId}/matches/${eventId}`
        const image = `${env.appSiteUrl}/api/og/player-match/${recap.userId}/${eventId}`
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
                eventId: eventId as never,
                userId: recap.userId,
            })
    }
}
