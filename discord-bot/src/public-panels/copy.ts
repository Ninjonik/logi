import type { ClanLanguage } from "../types"

type Freshness = "fresh" | "stale" | "unavailable"

/**
 * Copy for the public score panels, reviewed results and private player
 * pages in the clan's Discord language. English is the historical wording.
 */
export type PanelCopy = {
    freshness: (value: string) => string
    liveInProgress: string
    lastKnownData: (age: string) => string
    paused: string
    serverLive: string
    playerCount: (current: string, max: string) => string
    points: string
    kills: string
    deaths: string
    cash: string
    factionScore: string
    factionScoreAndLeaders: string
    teamScore: string
    scoresUnavailable: string
    scoreObserved: (at: string) => string
    statusObserved: (at: string) => string
    liveLeaders: (freshness: string) => string
    currentPlayersObserved: (at: string) => string
    topKills: string
    topCash: string
    noPlayers: string
    noConnectedPlayers: string
    playerDataUnavailable: string
    detailsUnavailable: string
    panelChanged: string
    playersButton: string
    reportButton: string
    unknownTime: string
    gameArtwork: string
    panelBanner: string
    playersPage: (freshness: string, page: number, pages: number) => string
    observed: (at: string) => string
    previous: string
    next: string
    result: (corrected: boolean, version: number) => string
    reviewed: (at: string) => string
    hllRemaining: (time: string) => string
    hllCurrentRound: (freshness: string) => string
    hllAllies: string
    hllAxis: string
    hllUnknownTeam: string
    hllNoLeader: string
    hllPlayersFooter: (freshness: string, at: string) => string
    hllPlayersTitle: string
    hllPlayersSummary: (
        freshness: string,
        at: string,
        page: number,
        pages: number
    ) => string
    hllPlayerStats: (stats: {
        combat: string
        offense: string
        defense: string
        support: string
    }) => string
}

const en: PanelCopy = {
    freshness: (value) => value,
    liveInProgress: "Live · score in progress",
    lastKnownData: (age) => `${age} · last known data`,
    paused: "Paused · automatic updates disabled",
    serverLive: "SERVER LIVE",
    playerCount: (current, max) => `👥 **${current} / ${max}** players`,
    points: "pts",
    kills: "kills",
    deaths: "deaths",
    cash: "cash",
    factionScore: "FACTION SCORE",
    factionScoreAndLeaders: "FACTION SCORE & TEAM LEADERS",
    teamScore: "TEAM SCORE",
    scoresUnavailable: "Scores unavailable",
    scoreObserved: (at) => `Score observed ${at}`,
    statusObserved: (at) => `Status observed ${at}`,
    liveLeaders: (freshness) => `LIVE LEADERS · ${freshness}`,
    currentPlayersObserved: (at) =>
        `Current connected players · observed ${at}`,
    topKills: "⚔ TOP 3 · Kills",
    topCash: "💵 TOP 3 · Cash",
    noPlayers: "No players reported.",
    noConnectedPlayers: "No connected players reported.",
    playerDataUnavailable: "Player data unavailable.",
    detailsUnavailable: "Player details unavailable. Please try again later.",
    panelChanged:
        "Player details unavailable or this panel changed. Open the current panel in its channel.",
    playersButton: "Players · private details",
    reportButton: "Report Player",
    unknownTime: "unknown",
    gameArtwork: "Game artwork",
    panelBanner: "Panel banner",
    playersPage: (freshness, page, pages) =>
        `Players · ${freshness} · ${page}/${pages}`,
    observed: (at) => `Observed ${at}`,
    previous: "Previous",
    next: "Next",
    result: (corrected, version) =>
        `${corrected ? "Corrected" : "Confirmed"} result · v${version}`,
    reviewed: (at) => `Reviewed ${at}`,
    hllRemaining: (time) => `⏱ **${time}** remaining`,
    hllCurrentRound: (freshness) => `${freshness} · current round`,
    hllAllies: "Allies",
    hllAxis: "Axis",
    hllUnknownTeam: "Unknown team",
    hllNoLeader: "No connected leader reported",
    hllPlayersFooter: (freshness, at) =>
        `Players: ${freshness} · observed ${at} · current round only`,
    hllPlayersTitle: "HELL LET LOOSE · Connected players",
    hllPlayersSummary: (freshness, at, page, pages) =>
        `Players: **${freshness}** · observed ${at}\nCurrent round only · page ${page}/${pages}`,
    hllPlayerStats: ({ combat, offense, defense, support }) =>
        `Combat ${combat} · Attack ${offense} · Defence ${defense} · Support ${support}`,
}

const csFreshness: Record<Freshness, string> = {
    fresh: "aktuální",
    stale: "zastaralé",
    unavailable: "nedostupné",
}

const cs: PanelCopy = {
    freshness: (value) => csFreshness[value as Freshness] ?? value,
    liveInProgress: "Živě · skóre se počítá",
    lastKnownData: (age) => `${age} · poslední známá data`,
    paused: "Pozastaveno · automatické obnovování je vypnuté",
    serverLive: "ŽIVĚ ZE SERVERU",
    playerCount: (current, max) => `👥 **${current} / ${max}** hráčů`,
    points: "b.",
    kills: "zabití",
    deaths: "smrtí",
    cash: "peněz",
    factionScore: "SKÓRE FRAKCÍ",
    factionScoreAndLeaders: "SKÓRE FRAKCÍ A NEJLEPŠÍ HRÁČI",
    teamScore: "SKÓRE TÝMŮ",
    scoresUnavailable: "Skóre není k dispozici",
    scoreObserved: (at) => `Skóre zjištěno ${at}`,
    statusObserved: (at) => `Stav zjištěn ${at}`,
    liveLeaders: (freshness) => `NEJLEPŠÍ HRÁČI ŽIVĚ · ${freshness}`,
    currentPlayersObserved: (at) => `Připojení hráči · zjištěno ${at}`,
    topKills: "⚔ TOP 3 · Zabití",
    topCash: "💵 TOP 3 · Peníze",
    noPlayers: "Žádní hráči nejsou hlášeni.",
    noConnectedPlayers: "Žádní připojení hráči nejsou hlášeni.",
    playerDataUnavailable: "Data o hráčích nejsou k dispozici.",
    detailsUnavailable:
        "Podrobnosti o hráčích teď nejsou k dispozici. Zkus to prosím později.",
    panelChanged:
        "Podrobnosti o hráčích nejsou k dispozici nebo se panel změnil. Otevři aktuální panel v jeho kanálu.",
    playersButton: "Hráči (jen pro tebe)",
    reportButton: "Nahlásit hráče",
    unknownTime: "neznámo",
    gameArtwork: "Obrázek hry",
    panelBanner: "Banner panelu",
    playersPage: (freshness, page, pages) =>
        `Hráči · ${freshness} · ${page}/${pages}`,
    observed: (at) => `Zjištěno ${at}`,
    previous: "Předchozí",
    next: "Další",
    result: (corrected, version) =>
        `${corrected ? "Opravený" : "Potvrzený"} výsledek · v${version}`,
    reviewed: (at) => `Potvrzeno ${at}`,
    hllRemaining: (time) => `⏱ zbývá **${time}**`,
    hllCurrentRound: (freshness) => `${freshness} · aktuální kolo`,
    hllAllies: "Spojenci",
    hllAxis: "Osa",
    hllUnknownTeam: "Neznámý tým",
    hllNoLeader: "Žádný připojený nejlepší hráč",
    hllPlayersFooter: (freshness, at) =>
        `Hráči: ${freshness} · zjištěno ${at} · jen aktuální kolo`,
    hllPlayersTitle: "HELL LET LOOSE · Připojení hráči",
    hllPlayersSummary: (freshness, at, page, pages) =>
        `Hráči: **${freshness}** · zjištěno ${at}\nJen aktuální kolo · strana ${page}/${pages}`,
    hllPlayerStats: ({ combat, offense, defense, support }) =>
        `Boj ${combat} · Útok ${offense} · Obrana ${defense} · Podpora ${support}`,
}

const deFreshness: Record<Freshness, string> = {
    fresh: "aktuell",
    stale: "veraltet",
    unavailable: "nicht verfügbar",
}

const de: PanelCopy = {
    freshness: (value) => deFreshness[value as Freshness] ?? value,
    liveInProgress: "Live · Punktestand läuft",
    lastKnownData: (age) => `${age} · zuletzt bekannte Daten`,
    paused: "Pausiert · automatische Updates deaktiviert",
    serverLive: "SERVER LIVE",
    playerCount: (current, max) => `👥 **${current} / ${max}** Spieler`,
    points: "Pkt.",
    kills: "Kills",
    deaths: "Tode",
    cash: "Geld",
    factionScore: "FRAKTIONSPUNKTE",
    factionScoreAndLeaders: "FRAKTIONSPUNKTE & TEAMBESTE",
    teamScore: "TEAMPUNKTE",
    scoresUnavailable: "Punktestand nicht verfügbar",
    scoreObserved: (at) => `Punktestand erfasst ${at}`,
    statusObserved: (at) => `Status erfasst ${at}`,
    liveLeaders: (freshness) => `LIVE-BESTENLISTE · ${freshness}`,
    currentPlayersObserved: (at) => `Verbundene Spieler · erfasst ${at}`,
    topKills: "⚔ TOP 3 · Kills",
    topCash: "💵 TOP 3 · Geld",
    noPlayers: "Keine Spieler gemeldet.",
    noConnectedPlayers: "Keine verbundenen Spieler gemeldet.",
    playerDataUnavailable: "Spielerdaten nicht verfügbar.",
    detailsUnavailable:
        "Spielerdetails sind gerade nicht verfügbar. Bitte versuche es später erneut.",
    panelChanged:
        "Spielerdetails nicht verfügbar oder das Panel hat sich geändert. Öffne das aktuelle Panel in seinem Kanal.",
    playersButton: "Spieler (nur für dich)",
    reportButton: "Spieler melden",
    unknownTime: "unbekannt",
    gameArtwork: "Spielbild",
    panelBanner: "Panel-Banner",
    playersPage: (freshness, page, pages) =>
        `Spieler · ${freshness} · ${page}/${pages}`,
    observed: (at) => `Erfasst ${at}`,
    previous: "Zurück",
    next: "Weiter",
    result: (corrected, version) =>
        `${corrected ? "Korrigiertes" : "Bestätigtes"} Ergebnis · v${version}`,
    reviewed: (at) => `Bestätigt ${at}`,
    hllRemaining: (time) => `⏱ noch **${time}**`,
    hllCurrentRound: (freshness) => `${freshness} · aktuelle Runde`,
    hllAllies: "Alliierte",
    hllAxis: "Achsenmächte",
    hllUnknownTeam: "Unbekanntes Team",
    hllNoLeader: "Kein verbundener Bester gemeldet",
    hllPlayersFooter: (freshness, at) =>
        `Spieler: ${freshness} · erfasst ${at} · nur aktuelle Runde`,
    hllPlayersTitle: "HELL LET LOOSE · Verbundene Spieler",
    hllPlayersSummary: (freshness, at, page, pages) =>
        `Spieler: **${freshness}** · erfasst ${at}\nNur aktuelle Runde · Seite ${page}/${pages}`,
    hllPlayerStats: ({ combat, offense, defense, support }) =>
        `Kampf ${combat} · Angriff ${offense} · Verteidigung ${defense} · Unterstützung ${support}`,
}

const copies: Record<ClanLanguage, PanelCopy> = { en, cs, de }

/** Panel copy for a clan language; unknown or missing languages use English. */
export function panelCopy(language?: string | null): PanelCopy {
    return language === "cs" || language === "de" ? copies[language] : en
}
