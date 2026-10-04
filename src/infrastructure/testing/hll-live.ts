import type { HllLive } from "../../domain/game-data/hll-live"
export const hllLiveTime = "2026-10-04T00:00:00.000Z"
export function hllLiveFixture(): HllLive {
    return {
        fetchedAt: hllLiveTime,
        statusAt: hllLiveTime,
        playersAt: hllLiveTime,
        statusFreshness: "fresh",
        playersFreshness: "fresh",
        refreshAfterSeconds: 15,
        warnings: [],
        status: {
            serverName: "PR158 TEST · HLL synthetic",
            map: "Utah Beach Warfare",
            layerId: "utah_warfare",
            mode: "warfare",
            roundStartedAt: "2026-10-03T23:50:00.000Z",
            playerCount: 2,
            maxPlayers: 100,
            scores: [
                { team: "allies", score: 3 },
                { team: "axis", score: 2 },
            ],
            timeRemainingSeconds: 3060,
        },
        players: [
            {
                playerId: "76561198000000001",
                name: "Synthetic Allied",
                team: "allies",
                kills: 12,
                deaths: 3,
                combat: 120,
                offense: 20,
                defense: 60,
                support: null,
            },
            {
                playerId: "76561198000000002",
                name: "Synthetic Axis",
                team: "axis",
                kills: 8,
                deaths: 0,
                combat: 90,
                offense: 20,
                defense: 30,
                support: 10,
            },
        ],
    }
}
