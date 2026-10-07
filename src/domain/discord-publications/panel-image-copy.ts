import type { HllNation, PanelServerState, WardogsSign } from "./panel-emblems"
import type { HllLighting, HllMode } from "./panel-graphics"

/**
 * Text drawn into the generated panel images and their alt text, in the clan
 * language. Czech follows the P7 board verbatim; English and German use the
 * same keys and the informal tone of bot messages.
 */
export const PANEL_IMAGE_LANGUAGES = ["cs", "en", "de"] as const
export type PanelImageLanguage = (typeof PANEL_IMAGE_LANGUAGES)[number]

export type PanelImageCopy = {
    locale: string
    game: { hell_let_loose: string; wardogs: string }
    state: Record<PanelServerState, string>
    /** The state word of a server-status panel that is up (L3-43). */
    online: string
    newMap: string
    players(count: number, capacity: number): string
    queue(count: number): string
    /** Gauge caption: "78 / 100 · fronta 3", "12 / 100 · seed do 40", "9 / 98" (P7-27, P8-27). */
    gauge(
        count: number,
        capacity: number,
        extra?: { queue?: number | null; seedTarget?: number | null }
    ): string
    timeLeft(minutes: number): string
    /** "seed do 40" after the player count while a seed runs (P8-27). */
    seedTo(target: number): string
    /** Under the seed progress: "živý od 40 hráčů" (P4-18). */
    seedCaption(target: number): string
    /** The empty state's sentence (P4-16). */
    emptyTitle: string
    /** Under the big player count of a server-status image (L3-43). */
    statusPlayers: string
    joinCode(code: string): string
    topKills: string
    allies: string
    axis: string
    sectors: string
    score: string
    nextMap(name: string): string
    factionPoints: string
    topCashNow(name: string, value: string): string
    stamp(time: string): string
    mode: Record<HllMode, string>
    lighting: Record<HllLighting, string>
    /** Full nation names (P8-21 "Velká Británie"). */
    nation: Record<HllNation, string>
    /** Short legend labels (P7-28 "Británie", "SSSR"). */
    nationShort: Record<HllNation, string>
    wardogs: Record<WardogsSign, string>
    alt: {
        score(parts: string[]): string
        banner(name: string): string
        map(name: string): string
        minutes(minutes: number): string
        playersOf(count: number, capacity: number): string
        queue(count: number): string
        topKills(players: string): string
        points(value: string): string
    }
}

/** Czech "z"/"ze" before a number, by how the number is spoken. */
export function czechFrom(value: number): "z" | "ze" {
    const n = Math.abs(Math.trunc(value))
    if (n >= 100 && n < 200) return "ze"
    if ([2, 3, 4, 7, 12, 13, 14, 17].includes(n)) return "ze"
    if (n >= 20 && n < 50) return "ze"
    if (n >= 60 && n < 80) return "ze"
    if ((n >= 200 && n < 500) || (n >= 600 && n < 800)) return "ze"
    return "z"
}
function czechMinutes(n: number) {
    return n === 1 ? "minuta" : n >= 2 && n <= 4 ? "minuty" : "minut"
}

function gauge(
    count: number,
    capacity: number,
    extra: { queue?: number | null; seedTarget?: number | null } | undefined,
    queue: string,
    seed: string
) {
    return [
        `${count} / ${capacity}`,
        ...(extra?.queue ? [`${queue} ${extra.queue}`] : []),
        ...(extra?.seedTarget ? [`${seed} ${extra.seedTarget}`] : []),
    ].join(" · ")
}

const shared = {
    game: { hell_let_loose: "Hell Let Loose", wardogs: "Wardogs" },
    mode: { warfare: "Warfare", offensive: "Offensive", skirmish: "Skirmish" },
    stamp: (time: string) => `Logi · ${time}`,
}

const cs: PanelImageCopy = {
    ...shared,
    locale: "cs-CZ",
    state: {
        live: "Živě",
        seeding: "Seedujeme",
        empty: "Prázdný",
        offline: "Nedostupný",
    },
    online: "Online",
    newMap: "Nová mapa",
    players: (count, capacity) => `${count} / ${capacity} hráčů`,
    queue: (count) => `fronta ${count}`,
    gauge: (count, capacity, extra) =>
        gauge(count, capacity, extra, "fronta", "seed do"),
    timeLeft: (minutes) => `zbývá ${minutes} min`,
    seedTo: (target) => `seed do ${target}`,
    seedCaption: (target) => `živý od ${target} hráčů`,
    emptyTitle: "Na serveru teď nikdo nehraje.",
    statusPlayers: "hráčů na serveru",
    joinCode: (code) => `join kód ${code}`,
    topKills: "Nejvíc zabití",
    allies: "Spojenci",
    axis: "Osa",
    sectors: "sektory",
    score: "skóre",
    nextMap: (name) => `další mapa ${name}`,
    factionPoints: "body frakcí",
    topCashNow: (name, value) => `nejvíc peněz teď: ${name} · ${value}`,
    lighting: {
        day: "Den",
        night: "Noc",
        dawn: "Úsvit",
        dusk: "Soumrak",
        morning: "Ráno",
        evening: "Večer",
        rain: "Déšť",
        overcast: "Zataženo",
    },
    nationShort: {
        us: "USA",
        gb: "Británie",
        sov: "SSSR",
        cw: "Commonwealth",
        ger: "Německo",
        dak: "Afrikakorps",
        allies: "Spojenci",
        axis: "Osa",
    },
    nation: {
        us: "USA",
        gb: "Velká Británie",
        sov: "Sovětský svaz",
        cw: "Commonwealth",
        ger: "Německo",
        dak: "Afrikakorps",
        allies: "Spojenci",
        axis: "Osa",
    },
    wardogs: {
        valkyra: "Valkyra",
        manticore: "Manticore",
        lonestar: "Lonestar",
        wardogs: "Wardogs",
    },
    alt: {
        score: (parts) => `Obrázek skóre: ${parts.join(", ")}.`,
        banner: (name) => `Banner serveru ${name}`,
        map: (name) => `Mapa ${name}`,
        minutes: (n) => `zbývá ${n} ${czechMinutes(n)}`,
        playersOf: (count, capacity) =>
            `${count} ${czechFrom(capacity)} ${capacity} hráčů`,
        queue: (count) => `fronta ${count}`,
        topKills: (players) => `nejvíc zabití ${players}`,
        points: (value) => `${value} bodů`,
    },
}

const en: PanelImageCopy = {
    ...shared,
    locale: "en-GB",
    state: {
        live: "Live",
        seeding: "Seeding",
        empty: "Empty",
        offline: "Offline",
    },
    online: "Online",
    newMap: "New map",
    players: (count, capacity) => `${count} / ${capacity} players`,
    queue: (count) => `queue ${count}`,
    gauge: (count, capacity, extra) =>
        gauge(count, capacity, extra, "queue", "seed to"),
    timeLeft: (minutes) => `${minutes} min left`,
    seedTo: (target) => `seed to ${target}`,
    seedCaption: (target) => `live from ${target} players`,
    emptyTitle: "Nobody is playing on the server right now.",
    statusPlayers: "players on the server",
    joinCode: (code) => `join code ${code}`,
    topKills: "Most kills",
    allies: "Allies",
    axis: "Axis",
    sectors: "sectors",
    score: "score",
    nextMap: (name) => `next map ${name}`,
    factionPoints: "faction points",
    topCashNow: (name, value) => `most money now: ${name} · ${value}`,
    lighting: {
        day: "Day",
        night: "Night",
        dawn: "Dawn",
        dusk: "Dusk",
        morning: "Morning",
        evening: "Evening",
        rain: "Rain",
        overcast: "Overcast",
    },
    nationShort: {
        us: "USA",
        gb: "Britain",
        sov: "USSR",
        cw: "Commonwealth",
        ger: "Germany",
        dak: "Afrikakorps",
        allies: "Allies",
        axis: "Axis",
    },
    nation: {
        us: "USA",
        gb: "Great Britain",
        sov: "Soviet Union",
        cw: "Commonwealth",
        ger: "Germany",
        dak: "Afrikakorps",
        allies: "Allies",
        axis: "Axis",
    },
    wardogs: {
        valkyra: "Valkyra",
        manticore: "Manticore",
        lonestar: "Lonestar",
        wardogs: "Wardogs",
    },
    alt: {
        score: (parts) => `Score image: ${parts.join(", ")}.`,
        banner: (name) => `Server banner ${name}`,
        map: (name) => `Map ${name}`,
        minutes: (n) => `${n} ${n === 1 ? "minute" : "minutes"} left`,
        playersOf: (count, capacity) => `${count} of ${capacity} players`,
        queue: (count) => `queue ${count}`,
        topKills: (players) => `most kills ${players}`,
        points: (value) => `${value} points`,
    },
}

const de: PanelImageCopy = {
    ...shared,
    locale: "de-DE",
    state: {
        live: "Live",
        seeding: "Seeding",
        empty: "Leer",
        offline: "Nicht erreichbar",
    },
    online: "Online",
    newMap: "Neue Karte",
    players: (count, capacity) => `${count} / ${capacity} Spieler`,
    queue: (count) => `Warteschlange ${count}`,
    gauge: (count, capacity, extra) =>
        gauge(count, capacity, extra, "Warteschlange", "Seed bis"),
    timeLeft: (minutes) => `noch ${minutes} Min.`,
    seedTo: (target) => `Seed bis ${target}`,
    seedCaption: (target) => `live ab ${target} Spielern`,
    emptyTitle: "Gerade spielt niemand auf dem Server.",
    statusPlayers: "Spieler auf dem Server",
    joinCode: (code) => `Join-Code ${code}`,
    topKills: "Meiste Kills",
    allies: "Alliierte",
    axis: "Achse",
    sectors: "Sektoren",
    score: "Punktestand",
    nextMap: (name) => `nächste Karte ${name}`,
    factionPoints: "Fraktionspunkte",
    topCashNow: (name, value) => `meistes Geld gerade: ${name} · ${value}`,
    lighting: {
        day: "Tag",
        night: "Nacht",
        dawn: "Morgendämmerung",
        dusk: "Abenddämmerung",
        morning: "Morgen",
        evening: "Abend",
        rain: "Regen",
        overcast: "Bewölkt",
    },
    nationShort: {
        us: "USA",
        gb: "Britannien",
        sov: "UdSSR",
        cw: "Commonwealth",
        ger: "Deutschland",
        dak: "Afrikakorps",
        allies: "Alliierte",
        axis: "Achse",
    },
    nation: {
        us: "USA",
        gb: "Großbritannien",
        sov: "Sowjetunion",
        cw: "Commonwealth",
        ger: "Deutschland",
        dak: "Afrikakorps",
        allies: "Alliierte",
        axis: "Achse",
    },
    wardogs: {
        valkyra: "Valkyra",
        manticore: "Manticore",
        lonestar: "Lonestar",
        wardogs: "Wardogs",
    },
    alt: {
        score: (parts) => `Punktestand-Bild: ${parts.join(", ")}.`,
        banner: (name) => `Server-Banner ${name}`,
        map: (name) => `Karte ${name}`,
        minutes: (n) => `noch ${n} ${n === 1 ? "Minute" : "Minuten"}`,
        playersOf: (count, capacity) => `${count} von ${capacity} Spielern`,
        queue: (count) => `Warteschlange ${count}`,
        topKills: (players) => `meiste Kills ${players}`,
        points: (value) => `${value} Punkte`,
    },
}

const copies: Record<PanelImageLanguage, PanelImageCopy> = { cs, en, de }
export function panelImageCopy(
    language: string | null | undefined
): PanelImageCopy {
    return (PANEL_IMAGE_LANGUAGES as readonly string[]).includes(language ?? "")
        ? copies[language as PanelImageLanguage]
        : copies.cs
}

/**
 * A status icon is never shown alone (P7-26): "<:logi_live_…> Živě", or just
 * the word while the application emoji is not installed yet.
 */
export function panelStateText(
    state: PanelServerState,
    language: string | null | undefined,
    icon?: string | null
): string {
    const word = panelImageCopy(language).state[state]
    return icon ? `${icon} ${word}` : word
}
