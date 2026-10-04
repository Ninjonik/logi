export type PlayerMetrics = {
    name: string
    faction: string | null
    kills: number
    cash: number
}

/** Cash is the current provider value, not inferred match earnings. */
export function playerLeaders<P extends PlayerMetrics>(
    players: readonly P[],
    metric: "kills" | "cash",
    faction?: string
): P[] {
    return players
        .filter(
            (p) =>
                Number.isFinite(p[metric]) &&
                (faction === undefined ||
                    p.faction?.trim().toLowerCase() ===
                        faction.trim().toLowerCase())
        )
        .sort(
            (a, b) =>
                b[metric] - a[metric] || a.name.localeCompare(b.name, "en")
        )
        .slice(0, 3)
}
