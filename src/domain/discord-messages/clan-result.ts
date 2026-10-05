/**
 * A reviewed result as the clan's cards say it: "Výhra 4 : 1" with the
 * clan's score first, and the data source's provider name for the recap's
 * "Data ze serveru … (CRCON)". Provisional results are not shown; an
 * uncertain outcome gives nothing rather than a wrong claim.
 */

import { resolveClanOutcome, type ClanOutcome } from "./match-result"

export type ReviewedResultHead = {
    status: "provisional" | "confirmed" | "corrected"
    participants: ReadonlyArray<{ label: string; score: number | null }>
    provenance?: { sources?: ReadonlyArray<{ provider: string }> }
}

export type ClanResultSummary = { outcome: ClanOutcome; score: string }

/** The clan's outcome and score of a confirmed result, clan score first. */
export function clanResultSummary(input: {
    result: ReviewedResultHead | null | undefined
    clanSide?: string | null
    imported?: {
        outcome: "victory" | "defeat" | "draw"
        score: { sideA: number; sideB: number }
    } | null
}): ClanResultSummary | null {
    const result = input.result
    if (!result || result.status === "provisional") return null
    const resolved = resolveClanOutcome({
        participants: result.participants,
        clanSide: input.clanSide,
        imported: input.imported,
    })
    if (!resolved) return null
    const scores = result.participants.map((item) => item.score)
    if (scores.some((score) => score === null)) return null
    const values = scores as number[]
    let score: string
    if (resolved.clanIndex !== null) {
        const clan = values[resolved.clanIndex]!
        const others = values.filter((_, index) => index !== resolved.clanIndex)
        score = `${clan} : ${Math.max(...others)}`
    } else {
        score = values.join(" : ")
    }
    return { outcome: resolved.outcome, score }
}

const PROVIDER_NAMES: Record<string, string> = {
    hll_crcon: "CRCON",
    wardogs_rcon: "RCON",
    wardogs_warcon: "Warcon",
    wardogs_public_directory: "Wardogs",
}

/** The name of a result's data source ("CRCON"), if it has one. */
export function resultProviderName(
    result: ReviewedResultHead | null | undefined
) {
    const provider = result?.provenance?.sources?.[0]?.provider
    return provider ? (PROVIDER_NAMES[provider] ?? undefined) : undefined
}
