// Synthetic Warcon contract examples. No provider credentials or real player records.
export const warconServerId = "11111111-1111-4111-8111-111111111111"
export const warconTime = "2026-10-02T12:00:00.000Z"
export const warconSteamId = "76561198000000001"
export const warconPlayer = {
    name: "Synthetic Ranger",
    steamId: warconSteamId,
    faction: "Alpha",
    kills: 0,
    deaths: 2,
    cash: 350,
    ping: 42,
}
export function warconLive() {
    return {
        serverId: warconServerId,
        ok: true,
        error: "",
        tier: "watched" as const,
        build: "test-build",
        gameServerId: "22222222-2222-4222-8222-222222222222",
        startedAt: warconTime,
        reservedSlots: 5,
        throttledUntil: null,
        status: {
            serverName: "Synthetic Wardogs",
            map: "Bakurani",
            experiences: ["KingOfTheHill"],
            lighting: "Day",
            alternator: "Default",
            scoreTick: 1,
            scoreTickMin: 1,
            scoreTickMax: 10,
            scoreCap: null,
            matchSeconds: null,
            playerCount: 1,
            maxPlayers: 100,
            scores: [
                { name: "Alpha", colorHex: "#ff0000", score: 0 },
                { name: "Bravo", colorHex: "#00ff00", score: 12 },
                { name: "Charlie", colorHex: "#0000ff", score: 7 },
            ],
            rotationNow: 0,
            rotationNext: 1,
        },
        players: [{ ...warconPlayer }],
        statusAt: warconTime,
        playersAt: warconTime,
        observedAt: warconTime,
    }
}
export function warconMatch(id = 7, complete = true) {
    return {
        id,
        startedAt: "2026-10-02T11:00:00.000Z",
        endedAt: complete ? warconTime : null,
        map: "Bakurani",
        experiences: "KingOfTheHill",
        lighting: "Day",
        peakPlayers: 1,
        players: 1,
        finalScores: complete
            ? [
                  { name: "Alpha", score: 0 },
                  { name: "Bravo", score: 100 },
              ]
            : null,
        winner: complete ? "Bravo" : null,
    }
}
export function warconMatchDetail() {
    return {
        ok: true,
        match: warconMatch(),
        factions: [
            { name: "Alpha", colorHex: "#ff0000" },
            { name: "Bravo", colorHex: null },
        ],
        lines: [
            {
                steamId: warconSteamId,
                name: warconPlayer.name,
                faction: "Alpha",
                seconds: 60,
                kills: 0,
                deaths: 2,
                cashDelta: -10,
                headshots: 0,
                teamKills: 0,
                suicides: 0,
                vehicleKills: 0,
                longestM: null,
                killStreak: 0,
                deathStreak: 0,
                result: "loss",
            },
        ],
        timeline: [
            [0, 0, 0],
            [60, 0, 100],
        ],
        awards: [],
        kills: 0,
        hasFeed: false,
    }
}
