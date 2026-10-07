export type ClanOutcome = "win" | "loss" | "draw"

type Participant = { label: string; score: number | null }

const normalize = (value: string | null | undefined) =>
    value?.trim().toLowerCase() ?? ""

/**
 * The clan's outcome of a reviewed result. The clan played the event's side
 * (HLL "Allies"/"Axis" or a Wardogs faction), which names one participant;
 * the outcome compares its score with the best other score. Older imports
 * carry the clan's outcome themselves and are used only while the reviewed
 * scores still equal the imported ones. Anything uncertain gives null, so a
 * card never claims a win it cannot prove.
 */
export function resolveClanOutcome(input: {
    participants: readonly Participant[]
    clanSide?: string | null
    imported?: {
        outcome: "victory" | "defeat" | "draw"
        score: { sideA: number; sideB: number }
    } | null
}): { outcome: ClanOutcome; clanIndex: number | null } | null {
    const side = normalize(input.clanSide)
    const clanIndex = side
        ? input.participants.findIndex(
              (participant) => normalize(participant.label) === side
          )
        : -1
    if (clanIndex >= 0 && input.participants.length >= 2) {
        const clanScore = input.participants[clanIndex]!.score
        const others = input.participants
            .filter((_, index) => index !== clanIndex)
            .map((participant) => participant.score)
        if (
            clanScore === null ||
            others.some((score) => score === null) ||
            !Number.isFinite(clanScore)
        )
            return null
        const best = Math.max(...(others as number[]))
        return {
            outcome:
                clanScore > best ? "win" : clanScore < best ? "loss" : "draw",
            clanIndex,
        }
    }
    const imported = input.imported
    const [first, second, ...rest] = input.participants
    if (
        imported &&
        !rest.length &&
        first?.score === imported.score.sideA &&
        second?.score === imported.score.sideB
    ) {
        return {
            outcome:
                imported.outcome === "victory"
                    ? "win"
                    : imported.outcome === "defeat"
                      ? "loss"
                      : "draw",
            clanIndex: null,
        }
    }
    return null
}
