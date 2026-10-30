import type { PerformanceSnapshot } from "@/lib/read-models/performance-history"
/** Fictional fixtures. No record identifiers, external avatars or live requests. */
export const examplePlayers = [
    {
        name: "Atlas",
        group: "Alpha",
        kills: 42,
        deaths: 18,
        color: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    },
    {
        name: "Echo",
        group: "Bravo",
        kills: 36,
        deaths: 20,
        color: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    },
    {
        name: "Kestrel",
        group: "Alpha",
        kills: 31,
        deaths: 16,
        color: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
    },
    {
        name: "Nova",
        group: "Bravo",
        kills: 28,
        deaths: 22,
        color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    },
]
export const examplePerformance: PerformanceSnapshot[] = [
    35, 42, 28, 38, 31, 25, 30, 22,
].map((kills, index) => ({
    eventId: `example-${index}`,
    gameId: "hell_let_loose",
    playedAt: `2026-10-${String(28 - index).padStart(2, "0")}T18:00:00Z`,
    label: `NOVA vs WOLF · ${index + 1}`,
    combat: kills * 10,
    offense: kills * 7,
    support: 180 + index * 20,
    kills,
    deaths: 18,
    points: 50 + index * 3,
    kd: kills / 18,
}))
