import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
} from "discord.js"
import type { Client } from "discord.js"

import { convex, references } from "../convex"
import { env } from "../environment"

export async function processMatchRecaps(client: Client, eventId: string) {
    const recaps = (await convex.query(references.getPendingMatchRecaps, {
        secret: env.internalSecret,
        eventId: eventId as never,
    })) as Array<{
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
    }>
    for (const recap of recaps) {
        const user = await client.users.fetch(recap.userId).catch(() => null)
        if (!user) continue
        const link = `${env.appSiteUrl}/en/players/${recap.userId}/matches/${eventId}`
        const image = `${env.appSiteUrl}/api/og/player-match/${recap.userId}/${eventId}`
        const comparison = recap.previousTen?.matches
            ? `Previous ${recap.previousTen.matches} matches avg: ${recap.previousTen.kills.toFixed(1)} kills / ${recap.previousTen.deaths.toFixed(1)} deaths / ${recap.previousTen.kd.toFixed(2)} K/D`
            : "No prior recorded matches to compare yet."
        const sent = await user
            .send({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x5865f2)
                        .setTitle(`Match recap - ${recap.eventName}`)
                        .setDescription(
                            `${recap.mapName ?? "Match"}\n**${recap.kills}** kills / **${recap.deaths}** deaths / **${recap.kd.toFixed(2)}** K/D`
                        )
                        .addFields({
                            name: "Compared with previous matches",
                            value: comparison,
                        })
                        .setImage(image)
                        .setURL(link),
                ],
                components: [
                    new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder()
                            .setStyle(ButtonStyle.Link)
                            .setLabel("View public match stats")
                            .setURL(link),
                        new ButtonBuilder()
                            .setStyle(ButtonStyle.Secondary)
                            .setLabel("Unsubscribe from recaps")
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
