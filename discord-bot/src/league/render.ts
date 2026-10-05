import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    type MessageCreateOptions,
} from "discord.js"
import { DEFAULT_MESSAGE_ACCENT_COLOR } from "../../../src/domain/discord-messages/format"
import { factionEmblem } from "../../../src/domain/discord-messages/faction-emblem"
import { extractMatchUrls } from "../../../src/domain/wardogs-league/discovery"
import type { LeagueFixture } from "../../../src/domain/wardogs-league/fixture"
import { getEventMessages } from "../../../src/lib/clan-language/events"
const clean = (text: string | null | undefined, max = 150) =>
    (text ?? "—")
        .replace(/[@<>]/g, "")
        .replace(/[\\`*_~|]/g, "\\$&")
        .replace(/[\r\n]/g, " ")
        .slice(0, max)
const at = (value: string | null) =>
    value ? `<t:${Math.floor(Date.parse(value) / 1000)}:F>` : "—"

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
/** Day/night labels the League site uses, in the clan language. */
function lightingLabel(value: string | null | undefined, language?: string) {
    const key = value?.trim().toLowerCase()
    const times = getEventMessages(language).mapLabels.times
    return key && Object.prototype.hasOwnProperty.call(times, key)
        ? times[key as keyof typeof times]
        : value
          ? clean(value, 40)
          : undefined
}
/**
 * League fixture card: a small "WARDOGS LEAGUE · MATCH 14" line, the teams as
 * the title, the scheduled time, one line per team with its faction emblem,
 * then map, lighting and the ready check. Provider type/status and any stale,
 * paused or archived state stay visible as a small last line.
 */
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
            .map((team) =>
                [
                    factionEmblem(team.faction, icons) ?? "▸",
                    `**${clean(team.code, 30)}**`,
                    team.faction ? `· ${clean(team.faction, 40)}` : undefined,
                ]
                    .filter(Boolean)
                    .join(" ")
            )
            .join("\n") ?? copy.teamsUnavailable
    const facts = [
        match.map?.name ? clean(match.map.name, 80) : undefined,
        match.map?.zone ? clean(match.map.zone, 80) : undefined,
        lightingLabel(match.map?.lighting, language),
        match.readyCheck
            ? `${copy.ready.toLocaleLowerCase()}: ${clean(match.readyCheck, 80)}`
            : undefined,
    ]
        .filter(Boolean)
        .join(" · ")
    const state = fixture.stale
        ? copy.stale
        : fixture.state === "paused"
          ? copy.paused
          : fixture.state === "archived"
            ? copy.archived
            : undefined
    const footnote = [
        match.type ? clean(match.type, 60) : undefined,
        match.status ? clean(match.status, 60) : undefined,
        state,
    ]
        .filter(Boolean)
        .join(" · ")
    const embed = new EmbedBuilder()
        .setColor(fixture.stale ? 0xd29922 : DEFAULT_MESSAGE_ACCENT_COLOR)
        .setAuthor({
            name: `Wardogs League · ${copy.match(String(match.fixtureNumber ?? "—"))}`.toUpperCase(),
        })
        .setTitle(
            clean(
                match.teams?.map((t) => t.code).join(" vs ") ?? match.title,
                200
            )
        )
        .setURL(match.sourceUrl)
        .setDescription(
            [
                match.scheduledAt ? `**${at(match.scheduledAt)}**` : undefined,
                teams,
                facts || undefined,
                footnote ? `-# ${footnote}` : undefined,
            ]
                .filter(Boolean)
                .join("\n")
        )
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
