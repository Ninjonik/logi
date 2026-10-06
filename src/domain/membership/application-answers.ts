import {
    APPLICATION_LIMITS,
    type ApplicationQuestion,
} from "./application-form"

/**
 * Parsing one answer of the application form (L6-B07): what a window field
 * accepts and how a stored answer is shown. Values arrive as the strings a
 * Discord modal or the web form submits.
 */

const STEAM_ID = /^7656119\d{10}$/
const STEAM_PROFILE =
    /^(?:https?:\/\/)?(?:www\.)?steamcommunity\.com\/profiles\/(7656119\d{10})\/?(?:[?#].*)?$/i

/**
 * A Steam64 ID from what the applicant typed: 17 digits starting 7656119,
 * or a `steamcommunity.com/profiles/…` link. Null for anything else; vanity
 * links (`/id/name`) cannot be resolved without Steam's API.
 */
export function parseSteamId(input: string): string | null {
    const value = input.trim()
    if (STEAM_ID.test(value)) return value
    return value.match(STEAM_PROFILE)?.[1] ?? null
}

const NUMBER = /^-?\d+(?:[.,]\d+)?$/
const DISCORD_ID = /^\d{15,25}$/

export type AnswerIssue =
    | "required"
    | "number"
    | "too-long"
    | "choice"
    | "too-few"
    | "too-many"
    | "member"

export type ParsedAnswer =
    { ok: true; values: string[] } | { ok: false; issue: AnswerIssue }

/** Validates the raw values of one question; an empty optional answer is `[]`. */
export function parseQuestionAnswer(
    question: ApplicationQuestion,
    raw: readonly string[]
): ParsedAnswer {
    const values = raw.map((value) => value.trim()).filter(Boolean)
    if (!values.length)
        return question.required
            ? { ok: false, issue: "required" }
            : { ok: true, values: [] }
    switch (question.type) {
        case "short_text":
        case "long_text": {
            const max =
                question.type === "long_text"
                    ? APPLICATION_LIMITS.longAnswer
                    : APPLICATION_LIMITS.shortAnswer
            const text = values.join(" ")
            return text.length > max
                ? { ok: false, issue: "too-long" }
                : { ok: true, values: [text] }
        }
        case "number": {
            const text = values[0]!.replace(/\s+/g, "")
            return NUMBER.test(text)
                ? { ok: true, values: [text.replace(",", ".")] }
                : { ok: false, issue: "number" }
        }
        case "yes_no":
            return values.length === 1 &&
                (values[0] === "yes" || values[0] === "no")
                ? { ok: true, values: [values[0]] }
                : { ok: false, issue: "choice" }
        case "member":
            return values.length === 1 && DISCORD_ID.test(values[0]!)
                ? { ok: true, values: [values[0]!] }
                : { ok: false, issue: "member" }
        case "select":
        case "multi_select": {
            const known = new Set(
                (question.options ?? []).map((option) => option.id)
            )
            const unique = [...new Set(values)]
            if (unique.some((value) => !known.has(value)))
                return { ok: false, issue: "choice" }
            if (question.type === "select")
                return unique.length === 1
                    ? { ok: true, values: unique }
                    : { ok: false, issue: "choice" }
            const min = question.minValues ?? (question.required ? 1 : 0)
            const max = question.maxValues ?? known.size
            if (unique.length < min) return { ok: false, issue: "too-few" }
            if (unique.length > max) return { ok: false, issue: "too-many" }
            return { ok: true, values: unique }
        }
    }
}

/** The words an answer is shown with. */
export type AnswerDisplayCopy = {
    yes: string
    no: string
}

/**
 * An answer as text: option labels joined with ", ", "Ano"/"Ne", a member
 * mention, or the typed text. Unknown option IDs (an option removed after
 * the draft was saved) are skipped.
 */
export function formatAnswer(
    question: ApplicationQuestion,
    values: readonly string[],
    copy: AnswerDisplayCopy
): string {
    switch (question.type) {
        case "yes_no":
            return values[0] === "yes"
                ? copy.yes
                : values[0] === "no"
                  ? copy.no
                  : ""
        case "member":
            return values[0] ? `<@${values[0]}>` : ""
        case "select":
        case "multi_select":
            return values
                .map(
                    (value) =>
                        question.options?.find((option) => option.id === value)
                            ?.label
                )
                .filter((label): label is string => Boolean(label))
                .join(", ")
        default:
            return values.join(" ")
    }
}
