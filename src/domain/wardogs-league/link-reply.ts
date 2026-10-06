import type { LeagueMatch } from "./contracts"

/**
 * Reply to a human who posts a League match link (L3-56, L3-57, now pointing
 * to the WD League panel instead of a per-match card): "Logi zápas sleduje …
 * najdeš v #liga" with links to the panel and the League page. A match the
 * scanner finds on its own gets no reply; neither does a link posted in the
 * panel channel itself.
 */
/** Only links posted this recently are answered, so a deploy never replies to old posts. */
export const LINK_REPLY_WINDOW_MS = 24 * 3600_000

export type LeagueLinkReplyView = {
    matchId: string
    sourceUrl: string
    fixtureNumber: number | null
    teamCodes: string[]
    scheduledAt: string | null
    panelChannelId: string
    /** "Otevřít kartu": the "nejbližší zápasy" message, when it exists. */
    panelMessageUrl: string | null
}

export type LeagueLinkReplyDecision =
    | {
          reply: false
          reason:
              | "not_human"
              | "not_accepted"
              | "no_panel"
              | "same_channel"
              | "already_replied"
              | "waiting_for_data"
      }
    | { reply: true; view: LeagueLinkReplyView }

export function leagueLinkReply(input: {
    source: "human" | "scanner" | "admin"
    accepted: boolean
    alreadyReplied: boolean
    inputChannelId: string
    panelChannelId: string | null
    panelMessageUrl: string | null
    match: Pick<
        LeagueMatch,
        "id" | "sourceUrl" | "fixtureNumber" | "teams" | "scheduledAt"
    > | null
}): LeagueLinkReplyDecision {
    if (input.source !== "human") return { reply: false, reason: "not_human" }
    if (!input.accepted) return { reply: false, reason: "not_accepted" }
    if (input.alreadyReplied) return { reply: false, reason: "already_replied" }
    if (!input.panelChannelId) return { reply: false, reason: "no_panel" }
    if (input.panelChannelId === input.inputChannelId)
        return { reply: false, reason: "same_channel" }
    if (!input.match || !input.match.teams?.length)
        return { reply: false, reason: "waiting_for_data" }
    return {
        reply: true,
        view: {
            matchId: input.match.id,
            sourceUrl: input.match.sourceUrl,
            fixtureNumber: input.match.fixtureNumber,
            teamCodes: input.match.teams.map((team) => team.code),
            scheduledAt: input.match.scheduledAt,
            panelChannelId: input.panelChannelId,
            panelMessageUrl: input.panelMessageUrl,
        },
    }
}
