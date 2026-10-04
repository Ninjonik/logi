import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    type MessageCreateOptions,
} from "discord.js"
import { extractMatchUrls } from "../../../src/domain/wardogs-league/discovery"
import type { LeagueFixture } from "../../../src/domain/wardogs-league/fixture"
const clean = (text: string | null | undefined, max = 150) =>
    (text ?? "—")
        .replace(/[@<>]/g, "")
        .replace(/[\\`*_~|]/g, "\\$&")
        .replace(/[\r\n]/g, " ")
        .slice(0, max)
const at = (value: string | null) =>
    value ? `<t:${Math.floor(Date.parse(value) / 1000)}:f>` : "—"
export function humanLeagueInput(
    message: {
        guildId: string | null
        channelId: string
        bot: boolean
        webhookId: string | null
        content: string
    },
    inputChannelId: string | null,
    receivedEdit = false
) {
    return !message.guildId ||
        message.bot ||
        message.webhookId ||
        (!receivedEdit && message.channelId !== inputChannelId)
        ? null
        : extractMatchUrls(message.content)
}
export function renderLeagueCard(
    fixture: LeagueFixture,
    artworkUrl?: string,
    icons: Record<string, string> = {}
): MessageCreateOptions {
    const match = fixture.snapshot
    const teams =
        match.teams
            ?.slice(0, 3)
            .map(
                (team) =>
                    `${icons[(team.faction ?? "").toLowerCase()] ?? "▸"} **${clean(team.code, 30)}** · ${clean(team.faction, 40)}`
            )
            .join("\n") ?? "Teams unavailable"
    const embed = new EmbedBuilder()
        .setColor(fixture.stale ? 0xd29922 : 0xf1c40f)
        .setTitle(
            `Match #${match.fixtureNumber ?? "—"} · ${clean(match.teams?.map((t) => t.code).join(" / ") ?? match.title, 170)}`
        )
        .setURL(match.sourceUrl)
        .setDescription(
            `**${clean(match.type)} · ${clean(match.status)}**\n${at(match.scheduledAt)}\n\n${teams}`
        )
        .addFields(
            {
                name: "Map",
                value: [match.map?.name, match.map?.zone, match.map?.lighting]
                    .map((v) => clean(v, 80))
                    .join(" · "),
            },
            {
                name: "Preparation",
                value: `Vote: ${clean(match.mapVote?.status, 80)} · Rules: ${clean(match.rules?.summary, 80)}\nReady: ${clean(match.readyCheck, 80)}\nHost: ${clean(match.hosting?.teamCode ?? match.hosting?.mode, 80)}`,
            }
        )
        .setFooter({
            text: `Wardogs League · ${fixture.stale ? "Stale source data" : fixture.state === "paused" ? "Refresh paused" : fixture.state === "archived" ? "Archived snapshot" : "Source checked"} · results require source verification`,
        })
        .setTimestamp(new Date(match.fetchedAt))
    if (artworkUrl) embed.setThumbnail(artworkUrl)
    return {
        embeds: [embed],
        components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setStyle(ButtonStyle.Link)
                    .setURL(match.sourceUrl)
                    .setLabel("View match")
            ),
        ],
        allowedMentions: { parse: [] },
    }
}
