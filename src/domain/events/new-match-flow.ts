import type { TemplateReminderStatus } from "./match-templates"

/** The five steps of the new-match flow (design D2), in order. */
export const NEW_MATCH_STEPS = [
    "match",
    "time",
    "signups",
    "discord",
    "review",
] as const
export type NewMatchStep = (typeof NEW_MATCH_STEPS)[number]

/**
 * The name the flow suggests: "VLK vs ROG · Friendly" for a match with both
 * teams, the template name alone when no opponent is chosen yet, and the
 * template name for a training.
 */
export function suggestedEventName(input: {
    kind: "match" | "training"
    ownCode?: string | null
    opponentCode?: string | null
    templateName?: string | null
}): string {
    const template = input.templateName?.trim() || ""
    if (input.kind === "training") return template
    const own = input.ownCode?.trim()
    const opponent = input.opponentCode?.trim()
    const teams =
        own && opponent ? `${own} vs ${opponent}` : opponent ? opponent : ""
    return [teams, template].filter(Boolean).join(" · ")
}

/** A short code for a team chip: its code, else the initials of its name. */
export function teamChipCode(name: string, shortCode?: string | null) {
    const code = shortCode?.trim()
    if (code) return code.slice(0, 4).toUpperCase()
    const words = name.trim().split(/\s+/).filter(Boolean)
    const initials =
        words.length > 1
            ? words.map((word) => word[0]).join("")
            : (words[0] ?? "").slice(0, 3)
    return initials.slice(0, 4).toUpperCase()
}

export type ReminderAudience = "off" | "member" | "memberRecruit" | "all"

/** How the sign-up reminder statuses read in the flow and the templates page. */
export function reminderAudience(
    statuses: readonly TemplateReminderStatus[]
): ReminderAudience {
    if (!statuses.length) return "off"
    if (statuses.includes("reserve_member")) return "all"
    if (statuses.includes("recruit")) return "memberRecruit"
    return "member"
}

export function reminderStatusesFor(
    audience: ReminderAudience
): TemplateReminderStatus[] {
    switch (audience) {
        case "off":
            return []
        case "member":
            return ["member"]
        case "memberRecruit":
            return ["member", "recruit"]
        case "all":
            return ["member", "recruit", "reserve_member"]
    }
}

/** Local date ("2026-10-11") and time ("20:00") parts of a `datetime-local` value. */
export function splitLocalDateTime(value: string) {
    const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value)
    return match ? { date: match[1], time: match[2] } : { date: "", time: "" }
}
