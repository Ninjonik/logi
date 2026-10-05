/**
 * Facts a reviewed-result card shows besides the scores: the match category,
 * the clan's side and the teams' short codes, who confirmed the result and
 * whether a public match page exists. Every value is null or empty when the
 * event does not record it, so the card never shows invented data.
 */
export type ResultCardFacts = {
    category: string | null
    side: string | null
    teams: Array<{ code: string; side: string | null }>
    reviewer: string | null
    publicMatch: boolean
    imported: {
        outcome: "victory" | "defeat" | "draw"
        score: { sideA: number; sideB: number }
    } | null
}

const SLOT_ORDER: Record<string, number> = { a: 0, b: 1, c: 2 }
const text = (value: string | null | undefined) => value?.trim() || null

export function buildResultCardFacts(input: {
    event: {
        matchType?: string
        side?: string
        matchTeams?: Array<{
            slot: string
            side: string | null
            snapshot: { name: string; shortCode: string | null }
        }>
        eventResult?: {
            outcome: "victory" | "defeat" | "draw"
            score: { sideA: number; sideB: number }
        }
    }
    categories?: ReadonlyArray<{ id: string; label: string }>
    /** The confirming admin's user record, if one exists. */
    reviewer?: { name?: string; nicknames?: Record<string, string> } | null
    /** Discord guild whose nickname names the reviewer. */
    guildDiscordId: string
    publicMatch: boolean
}): ResultCardFacts {
    const matchType = input.event.matchType?.trim().toLowerCase()
    const category = matchType
        ? (input.categories?.find(
              (item) => item.id.trim().toLowerCase() === matchType
          )?.label ?? input.event.matchType)
        : null
    return {
        category: text(category),
        side: text(input.event.side),
        teams: [...(input.event.matchTeams ?? [])]
            .sort(
                (left, right) =>
                    (SLOT_ORDER[left.slot] ?? 9) - (SLOT_ORDER[right.slot] ?? 9)
            )
            .map((team) => ({
                code:
                    text(team.snapshot.shortCode) ??
                    text(team.snapshot.name) ??
                    "",
                side: text(team.side),
            }))
            .filter((team) => team.code),
        reviewer:
            text(input.reviewer?.nicknames?.[input.guildDiscordId]) ??
            text(input.reviewer?.name),
        publicMatch: input.publicMatch,
        imported: input.event.eventResult
            ? {
                  outcome: input.event.eventResult.outcome,
                  score: input.event.eventResult.score,
              }
            : null,
    }
}
