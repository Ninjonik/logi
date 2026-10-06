/**
 * The decision DM of a team request (boards L5 1.3 and L2-57..58): after
 * the Logi global administrators decide, the requester gets a card in the
 * language of the clan the request came from, with the clan colour, the
 * result as a chip and the team shown by its code. Pure; names, links and
 * the clan's DM frame come in.
 */

import {
    escapeMarkdownText,
    type MessageBlock,
    type MessageChip,
    type MessageView,
} from "./message-view"
import { fillTemplate } from "./format"

export type TeamRequestDmCopy = {
    /** "Katalog týmů Logi · {game}". */
    label: string
    approvedTitle: string
    mergedTitle: string
    rejectedTitle: string
    approvedChip: string
    mergedChip: string
    rejectedChip: string
    /** "nový tým". */
    newTeam: string
    /** For an approved change request. */
    changedTeam: string
    /** "žádal(a) jsi „{name}“". */
    requested: string
    approvedCreateBody: string
    approvedUpdateBody: string
    mergedBody: string
    /** "Žádost o nový tým". */
    kindCreate: string
    /** "Žádost o změnu". */
    kindUpdate: string
    /** "{kind} · tým {name}". */
    requestLine: string
    /** "Opravenou žádost pošleš v Logi → Týmy." */
    rejectedNext: string
    /** "Otevřít tým v Logi". */
    openTeam: string
    /** "Otevřít Týmy v Logi". */
    openTeams: string
}

export type TeamRequestDecision = "approved" | "merged" | "rejected"

export function isTeamRequestDecision(
    value: unknown
): value is TeamRequestDecision {
    return value === "approved" || value === "merged" || value === "rejected"
}

const oneLine = (value: string) => value.replace(/[\s\p{Cc}]+/gu, " ").trim()

/** The team's code as Discord shows a short tag, "`VLK`"; none without one. */
function teamCode(code: string | null | undefined) {
    const clean = oneLine(code ?? "").replace(/`/g, "")
    return clean ? `\`${clean.slice(0, 12)}\`` : undefined
}

/** "`VLK` **Vlci**", the team as the card names it. */
function teamText(team: { name: string; code?: string | null }) {
    const code = teamCode(team.code)
    const name = `**${escapeMarkdownText(oneLine(team.name))}**`
    return code ? `${code} ${name}` : name
}

export type TeamRequestDmInput = {
    copy: TeamRequestDmCopy
    /** "Hell Let Loose", "Wardogs". */
    gameLabel: string
    status: TeamRequestDecision
    kind: "create" | "update"
    /** The name the requester asked for. */
    requestedName: string
    /** The catalogue team the request ended in, if any. */
    team: { name: string; code?: string | null } | null
    /** The deciding administrator's reason; always quoted. */
    reason: string | null
    /** The team in the clan's Logi (approved, merged). */
    teamUrl?: string
    /** The clan's Teams page in Logi (rejected). */
    teamsUrl?: string
    /** "Klan Vlci · Nastavit zprávy". */
    frame: { clanName: string; settingsUrl?: string }
}

const httpUrl = (value: string | undefined) =>
    value && /^https?:\/\//.test(value) ? value : undefined

/**
 * "Tým je v katalogu" (Schváleno), "Tým už v katalogu byl" (Sloučeno) or
 * "Žádost o tým nebyla přijata" (Zamítnuto) with the decider's reason as a
 * quote and one link back to Logi.
 */
export function teamRequestDecisionView(
    input: TeamRequestDmInput
): MessageView {
    const { copy, status } = input
    const requested = escapeMarkdownText(oneLine(input.requestedName))
    const chip: MessageChip =
        status === "approved"
            ? { label: copy.approvedChip, tone: "success" }
            : status === "merged"
              ? { label: copy.mergedChip, tone: "info" }
              : { label: copy.rejectedChip, tone: "danger" }
    const title =
        status === "approved"
            ? copy.approvedTitle
            : status === "merged"
              ? copy.mergedTitle
              : copy.rejectedTitle
    const team = input.team ?? { name: input.requestedName }
    const blocks: MessageBlock[] = []
    if (status === "approved") {
        blocks.push({
            kind: "text",
            markdown: `${teamText(team)} · ${input.kind === "create" ? copy.newTeam : copy.changedTeam}`,
        })
        blocks.push({
            kind: "text",
            markdown:
                input.kind === "create"
                    ? copy.approvedCreateBody
                    : copy.approvedUpdateBody,
        })
    } else if (status === "merged") {
        blocks.push({
            kind: "text",
            markdown: `${teamText(team)} · ${fillTemplate(copy.requested, { name: requested })}`,
        })
        blocks.push({ kind: "text", markdown: copy.mergedBody })
    } else {
        blocks.push({
            kind: "text",
            markdown: fillTemplate(copy.requestLine, {
                kind:
                    input.kind === "create" ? copy.kindCreate : copy.kindUpdate,
                name: escapeMarkdownText(
                    oneLine(input.team?.name ?? input.requestedName)
                ),
            }),
        })
    }
    const reason = oneLine(input.reason ?? "")
    if (reason)
        blocks.push({
            kind: "text",
            markdown: `> ${escapeMarkdownText(reason).slice(0, 1000)}`,
        })
    if (status === "rejected")
        blocks.push({ kind: "text", markdown: copy.rejectedNext })
    const url =
        status === "rejected" ? httpUrl(input.teamsUrl) : httpUrl(input.teamUrl)
    if (url)
        blocks.push({
            kind: "buttons",
            buttons: [
                {
                    kind: "link",
                    url,
                    label:
                        status === "rejected" ? copy.openTeams : copy.openTeam,
                },
            ],
        })
    blocks.push({ kind: "separator", divider: true, spacing: "small" })
    return {
        accent: "clan",
        header: {
            label: fillTemplate(copy.label, { game: input.gameLabel }),
            title,
            chips: [chip],
        },
        blocks,
        footer: {
            kind: "dm",
            clanName: input.frame.clanName.trim() || "Logi",
            ...(input.frame.settingsUrl
                ? { settingsUrl: input.frame.settingsUrl }
                : {}),
        },
    }
}
