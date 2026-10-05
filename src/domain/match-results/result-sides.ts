/** Factions a result participant can stand for; the score board names them. */
export type ResultFaction =
    "allies" | "axis" | "valkyra" | "manticore" | "lonestar"

const FACTION_NAMES: Record<ResultFaction, readonly string[]> = {
    allies: ["allies", "allied", "spojenci", "alliierte"],
    axis: ["axis", "osa", "achse"],
    valkyra: ["valkyra"],
    manticore: ["manticore"],
    lonestar: ["lonestar"],
}

/** The faction a participant ID, label or side names, if any. */
export function resultFaction(
    value: string | null | undefined
): ResultFaction | null {
    const normalized = value?.trim().toLowerCase()
    if (!normalized) return null
    for (const [faction, names] of Object.entries(FACTION_NAMES) as Array<
        [ResultFaction, readonly string[]]
    >) {
        if (names.includes(normalized)) return faction
    }
    return null
}

/**
 * The Axis/Allies score of a reviewed Hell Let Loose result, in the shape of
 * an imported result (`sideA` Axis, `sideB` Allies), so a confirmed result
 * fills a linked competition fixture like an import does. Null unless both
 * factions have a known score.
 */
export function axisAlliesScore(
    participants: ReadonlyArray<{
        id: string
        label: string
        score: number | null
    }>
): { sideA: number; sideB: number } | null {
    const scoreOf = (faction: ResultFaction) => {
        const matches = participants.filter(
            (participant) =>
                resultFaction(participant.id) === faction ||
                resultFaction(participant.label) === faction
        )
        return matches.length === 1 ? matches[0]!.score : null
    }
    const axis = scoreOf("axis")
    const allies = scoreOf("allies")
    return axis !== null && allies !== null
        ? { sideA: axis, sideB: allies }
        : null
}

export type ResultOutcome = "win" | "loss" | "draw"

/**
 * Orders the participants of a result for the score board (design E2): the
 * clan's own side first, found by the faction the match was played on, and
 * the outcome from the clan's point of view. Without a known side the order
 * stays and there is no outcome.
 */
export function arrangeResultSides<
    T extends { id: string; label: string; score: number | null },
>(
    participants: readonly T[],
    ourSide: string | null | undefined
): { ordered: T[]; oursIndex: number | null; outcome: ResultOutcome | null } {
    const faction = resultFaction(ourSide)
    const index = faction
        ? participants.findIndex(
              (participant) =>
                  resultFaction(participant.id) === faction ||
                  resultFaction(participant.label) === faction
          )
        : -1
    if (index < 0) {
        return { ordered: [...participants], oursIndex: null, outcome: null }
    }
    const ours = participants[index]!
    const ordered = [ours, ...participants.filter((_, i) => i !== index)]
    const others = ordered.slice(1)
    if (
        ours.score === null ||
        others.length === 0 ||
        others.some((participant) => participant.score === null)
    ) {
        return { ordered, oursIndex: 0, outcome: null }
    }
    const best = Math.max(...others.map((participant) => participant.score!))
    return {
        ordered,
        oursIndex: 0,
        outcome:
            ours.score > best ? "win" : ours.score < best ? "loss" : "draw",
    }
}
