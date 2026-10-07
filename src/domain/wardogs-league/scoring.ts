/**
 * League points awarded per finishing place. Index 0 is first place; a place
 * the rule does not list earns no points. The League publishes the rule on
 * each match page ("1st 3 · 2nd 2 · 3rd 1") and Logi uses that published rule.
 */
export type PointsRule = readonly number[]

/** The League rule from the design (1st 3, 2nd 2, 3rd 1), used when a page omits it. */
export const LEAGUE_POINTS_RULE: PointsRule = [3, 2, 1]

const ORDINAL = /^(\d{1,2})(?:st|nd|rd|th)\s+(\d{1,3})$/i

/**
 * Reads the published scoring rule. Places must be listed in order starting
 * at 1st; anything else is unrecognised and returns null, so a changed wording
 * on the League site never awards points silently.
 */
export function parseScoringRule(text: string | null): PointsRule | null {
    if (!text) return null
    const parts = text
        .split("·")
        .map((part) => part.replace(/\s+/g, " ").trim())
        .filter(Boolean)
    if (!parts.length || parts.length > 20) return null
    const points: number[] = []
    for (const [index, part] of parts.entries()) {
        const match = ORDINAL.exec(part)
        if (!match || Number(match[1]) !== index + 1) return null
        const value = Number(match[2])
        if (!Number.isSafeInteger(value) || value > 100) return null
        points.push(value)
    }
    return points
}

/** Points for one finishing place under a rule. */
export function pointsForPlace(rule: PointsRule, place: number) {
    return Number.isInteger(place) && place >= 1 ? (rule[place - 1] ?? 0) : 0
}

export function samePointsRule(a: PointsRule, b: PointsRule) {
    return a.length === b.length && a.every((value, i) => value === b[i])
}
