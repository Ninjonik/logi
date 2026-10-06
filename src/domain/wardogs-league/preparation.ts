import type { LeagueMatch } from "./contracts"

/**
 * "Preparation" of a League fixture is the League's own match preparation
 * shown on its page, not the clan's sign-ups: rules agreed by the teams, the
 * map vote, a moderator and the ready check (P6-25, P6-31). Green = done,
 * orange = running, grey = not yet. The clan's own sign-up and roster stay in
 * the match channels (P6-14).
 */
export const PREPARATION_TONES = ["done", "running", "pending"] as const
export type PreparationTone = (typeof PREPARATION_TONES)[number]

// `preparationChipSchema` lives in `preparation.schema.ts`; its type is
// re-exported here for the chip builders below.
export type { PreparationChip } from "./preparation.schema"
import type { PreparationChip } from "./preparation.schema"

const step = (match: LeagueMatch, label: string) =>
    match.progress?.find(
        (entry) => entry.label.toLowerCase() === label.toLowerCase()
    ) ?? null

/** "0 of 3 picked" (rules summary) or "0/3" (progress detail). */
function pickedOf(...texts: Array<string | null | undefined>) {
    for (const text of texts) {
        const match = /^(\d{1,2})\s*(?:of|\/)\s*(\d{1,2})\b/i.exec(
            text?.trim() ?? ""
        )
        if (match && Number(match[1]) <= Number(match[2]))
            return { picked: Number(match[1]), total: Number(match[2]) }
    }
    return { picked: null, total: null }
}

function rulesChip(match: LeagueMatch): PreparationChip {
    const progress = step(match, "Rules agreed")
    const { picked, total } = pickedOf(match.rules?.summary, progress?.detail)
    return {
        kind: "rules",
        tone:
            progress?.state === "done" ||
            (picked !== null && total !== null && total > 0 && picked >= total)
                ? "done"
                : picked !== null && picked > 0
                  ? "running"
                  : "pending",
        picked,
        total,
    }
}

function mapVoteChip(match: LeagueMatch, now: number): PreparationChip {
    const status = match.mapVote?.status?.toLowerCase() ?? ""
    const closesAt = match.mapVote?.closesAt ?? null
    const done =
        step(match, "Map vote")?.state === "done" ||
        /^(closed|decided|done|final|locked)\b/.test(status) ||
        // A vote closes at its deadline even if the stored page still says Open.
        (/^open\b/.test(status) &&
            closesAt !== null &&
            Date.parse(closesAt) <= now)
    return {
        kind: "mapVote",
        tone: done ? "done" : /^open\b/.test(status) ? "running" : "pending",
        closesAt: done ? null : closesAt,
        // No captured page shows when a future vote opens; kept for that page.
        opensAt: null,
    }
}

function moderatorChip(match: LeagueMatch): PreparationChip {
    const claimed = step(match, "Moderator claimed")?.state === "done"
    const text = match.moderator?.trim() ?? ""
    const named =
        text !== "" &&
        !/^(awaiting|none|tbd|unassigned|not assigned|—|-)$/i.test(text)
    return { kind: "moderator", tone: claimed || named ? "done" : "pending" }
}

function readyCheckChip(match: LeagueMatch): PreparationChip {
    const progress = step(match, "Ready check")
    const detail = (progress?.detail ?? match.readyCheck ?? "").toLowerCase()
    return {
        kind: "readyCheck",
        tone:
            progress?.state === "done" ||
            /^(done|complete|passed)\b/.test(detail)
                ? "done"
                : progress?.state === "current" ||
                    /^(running|open|in progress)\b/.test(detail)
                  ? "running"
                  : "pending",
    }
}

/**
 * Preparation chips of an upcoming fixture, in board order: rules, map vote,
 * moderator, ready check. When none of them has started, one chip
 * "Příprava ještě nezačala" replaces them (P6-29).
 */
export function preparationChips(
    match: LeagueMatch,
    now: number
): PreparationChip[] {
    const chips = [
        rulesChip(match),
        mapVoteChip(match, now),
        moderatorChip(match),
        readyCheckChip(match),
    ]
    return chips.every((chip) => chip.tone === "pending")
        ? [{ kind: "notStarted", tone: "pending" }]
        : chips
}
