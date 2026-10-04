import {
    historyRecordSchema,
    type HistoryRecord,
} from "../../domain/game-data/history"

/** Entirely synthetic; safe for docs and local UI acceptance. */
export function historyRecord(id = "game-1"): HistoryRecord {
    return historyRecordSchema.parse({
        schemaVersion: 1,
        id,
        guildId: "guild-a",
        gameId: "wardogs",
        provider: "wardogs_warcon",
        sourceId: "a".repeat(64),
        serverName: "Synthetic Wardogs",
        revision: "1",
        collectedAt: "2026-10-03T12:00:00.000Z",
        updatedAt: "2026-10-03T12:00:00.000Z",
        session: {
            externalId: id,
            startedAt: "2026-10-03T10:00:00.000Z",
            endedAt: "2026-10-03T11:00:00.000Z",
            complete: true,
            map: "Bakurani",
            sourceDigest: "b".repeat(64),
            participants: [
                { id: "Valkyra", label: "Valkyra", score: 100 },
                { id: "Manticore", label: "Manticore", score: 40 },
            ],
            warcon: {
                schemaVersion: 1,
                winner: "Valkyra",
                outcome: "decided",
                hasFeed: false,
                mode: "KingOfTheHill",
                lighting: "Day",
                factions: [
                    { name: "Valkyra", colorHex: "#FA503E" },
                    { name: "Manticore", colorHex: "#1DD65C" },
                ],
            },
            players: [
                {
                    platform: "steam",
                    platformId: "synthetic-player",
                    name: "Synthetic player",
                    faction: "Valkyra",
                    result: "win",
                    metrics: {
                        seconds: 3600,
                        kills: 12,
                        deaths: 0,
                        cashDelta: -20,
                        headshots: null,
                    },
                },
            ],
        },
    })
}
