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

type LeagueCopy = {
    match: (number: string) => string
    teamsUnavailable: string
    map: string
    preparation: string
    vote: string
    rules: string
    ready: string
    host: string
    stale: string
    paused: string
    archived: string
    checked: string
    verification: string
    viewMatch: string
    fixtureUnavailable: string
}
/** League card copy in the clan language; English is the historical wording. */
const leagueCopy: Record<"en" | "cs" | "de", LeagueCopy> = {
    en: {
        match: (number) => `Match #${number}`,
        teamsUnavailable: "Teams unavailable",
        map: "Map",
        preparation: "Preparation",
        vote: "Vote",
        rules: "Rules",
        ready: "Ready",
        host: "Host",
        stale: "Stale source data",
        paused: "Refresh paused",
        archived: "Archived snapshot",
        checked: "Source checked",
        verification: "results require source verification",
        viewMatch: "View match",
        fixtureUnavailable: "League fixture unavailable",
    },
    cs: {
        match: (number) => `Zápas ${number}`,
        teamsUnavailable: "Týmy nejsou k dispozici",
        map: "Mapa",
        preparation: "Příprava",
        vote: "Hlasování",
        rules: "Pravidla",
        ready: "Kontrola připravenosti",
        host: "Hostitel",
        stale: "Zastaralá data ze zdroje",
        paused: "Obnovování pozastaveno",
        archived: "Archivovaný stav",
        checked: "Zdroj ověřen",
        verification: "výsledky je třeba ověřit u zdroje",
        viewMatch: "Otevřít na webu ligy",
        fixtureUnavailable: "Ligový zápas není k dispozici",
    },
    de: {
        match: (number) => `Spiel ${number}`,
        teamsUnavailable: "Teams nicht verfügbar",
        map: "Karte",
        preparation: "Vorbereitung",
        vote: "Abstimmung",
        rules: "Regeln",
        ready: "Bereitschaftscheck",
        host: "Host",
        stale: "Veraltete Quelldaten",
        paused: "Aktualisierung pausiert",
        archived: "Archivierter Stand",
        checked: "Quelle geprüft",
        verification: "Ergebnisse müssen an der Quelle geprüft werden",
        viewMatch: "Auf der Liga-Website öffnen",
        fixtureUnavailable: "Ligaspiel nicht verfügbar",
    },
}
/** Copy for a clan language; unknown or missing languages use English. */
export function leagueCardCopy(language?: string | null) {
    return language === "cs" || language === "de"
        ? leagueCopy[language]
        : leagueCopy.en
}
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
    icons: Record<string, string> = {},
    language?: string
): MessageCreateOptions {
    const copy = leagueCardCopy(language)
    const match = fixture.snapshot
    const teams =
        match.teams
            ?.slice(0, 3)
            .map(
                (team) =>
                    `${icons[(team.faction ?? "").toLowerCase()] ?? "▸"} **${clean(team.code, 30)}** · ${clean(team.faction, 40)}`
            )
            .join("\n") ?? copy.teamsUnavailable
    const embed = new EmbedBuilder()
        .setColor(fixture.stale ? 0xd29922 : 0xf1c40f)
        .setTitle(
            `${copy.match(String(match.fixtureNumber ?? "—"))} · ${clean(match.teams?.map((t) => t.code).join(" / ") ?? match.title, 170)}`
        )
        .setURL(match.sourceUrl)
        .setDescription(
            `**${clean(match.type)} · ${clean(match.status)}**\n${at(match.scheduledAt)}\n\n${teams}`
        )
        .addFields(
            {
                name: copy.map,
                value: [match.map?.name, match.map?.zone, match.map?.lighting]
                    .map((v) => clean(v, 80))
                    .join(" · "),
            },
            {
                name: copy.preparation,
                value: `${copy.vote}: ${clean(match.mapVote?.status, 80)} · ${copy.rules}: ${clean(match.rules?.summary, 80)}\n${copy.ready}: ${clean(match.readyCheck, 80)}\n${copy.host}: ${clean(match.hosting?.teamCode ?? match.hosting?.mode, 80)}`,
            }
        )
        .setFooter({
            text: `Wardogs League · ${fixture.stale ? copy.stale : fixture.state === "paused" ? copy.paused : fixture.state === "archived" ? copy.archived : copy.checked} · ${copy.verification}`,
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
                    .setLabel(copy.viewMatch)
            ),
        ],
        allowedMentions: { parse: [] },
    }
}
