import type { HllScoreImage, WardogsScoreImage } from "./panel-image-model"

/**
 * The P7 board's sample data. The dashboard shows these in the style choice
 * (P8-04) and the renderer tests and screenshots use them.
 */

/** Vlci #1 · Public: Foy, 78/100, Spojenci 3 : 2 Osa. */
export const hllSample: HllScoreImage = {
    version: 1,
    game: "hell_let_loose",
    language: "cs",
    timeZone: "Europe/Prague",
    renderedAt: "2026-10-05T18:41:12.000Z",
    accentColor: "#e8a33d",
    serverName: "Vlci #1 · Public",
    state: "live",
    newMap: false,
    map: { name: "Foy", key: "foy" },
    background: { kind: "builtin", game: "hell_let_loose", mapKey: "foy" },
    players: { count: 78, capacity: 100, queue: 3 },
    scoreboard: true,
    seedTarget: null,
    leaders: [
        { name: "Rex_CZ", value: 31, side: "allies" },
        { name: "Hans_88", value: 28, side: "axis" },
        { name: "Bizon", value: 27, side: "allies" },
    ],
    mode: "warfare",
    lighting: "day",
    timeLeftSeconds: 47 * 60,
    nextMap: { name: "Carentan", lighting: "night" },
    allies: { nation: "us", score: 3 },
    axis: { nation: "ger", score: 2 },
}
/** Vlci WD: Zestafona, 17/98, Valkyra 23 · Manticore 12 · Lonestar 7. */
export const wardogsSample: WardogsScoreImage = {
    version: 1,
    game: "wardogs",
    language: "cs",
    timeZone: "Europe/Prague",
    renderedAt: "2026-10-05T18:41:12.000Z",
    accentColor: "#e8a33d",
    serverName: "Vlci WD",
    state: "live",
    newMap: false,
    map: { name: "Zestafona", key: "zestafona" },
    background: { kind: "builtin", game: "wardogs", mapKey: "zestafona" },
    players: { count: 17, capacity: 98, queue: null },
    scoreboard: true,
    seedTarget: null,
    leaders: [
        { name: "Hráč 17", value: 48, side: null },
        { name: "Hráč 16", value: 45, side: null },
        { name: "Hráč 15", value: 42, side: null },
    ],
    joinCode: "WD-7F3K",
    factions: [
        { faction: "valkyra", points: 23 },
        { faction: "manticore", points: 12 },
        { faction: "lonestar", points: 7 },
    ],
    topCash: { name: "Hráč 1", value: 3655 },
}
