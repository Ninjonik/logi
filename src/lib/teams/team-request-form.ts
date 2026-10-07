import {
    normalizeTeamName,
    TEAM_LINKS_MAX,
    TEAM_NAME_MAX,
    teamDescriptionSchema,
    teamLinkSchema,
    teamNameSchema,
    teamShortCodeSchema,
    type TeamGame,
    type TeamRecord,
} from "@/domain/teams/team"
import {
    teamRequestSubmitSchema,
    type TeamRequestSubmit,
} from "@/domain/teams/team-request"
import {
    formatImageUploadMessage,
    type ImageUploadError,
} from "@/lib/image-asset-upload"

/** What a request dialog proposes: a new team in a game, or a change to an existing active team. */
export type TeamRequestTarget =
    { kind: "create"; gameId: TeamGame } | { kind: "update"; team: TeamRecord }

/** The editable inputs of the request dialog, as typed. */
export type TeamRequestFormValues = {
    name: string
    shortCode: string
    logo: { assetId: string | null; url: string | null }
    description: string
    /** Link rows as typed; blank rows are ignored when the request is built. */
    links: string[]
    note: string
}

const collapse = (value: string) => value.trim().replace(/\s+/g, " ")

/**
 * Initial inputs: a change request starts from the team's current details; a
 * new-team request starts empty, or with the name typed in the match picker.
 */
export function teamRequestFormValues(
    target: TeamRequestTarget,
    initialName = ""
): TeamRequestFormValues {
    if (target.kind === "update") {
        const { team } = target
        return {
            name: team.name,
            shortCode: team.shortCode ?? "",
            logo: { assetId: team.logoAssetId, url: team.logoUrl },
            description: team.description ?? "",
            links: [...team.links],
            note: "",
        }
    }
    return {
        name: [...collapse(initialName)].slice(0, TEAM_NAME_MAX).join(""),
        shortCode: "",
        logo: { assetId: null, url: null },
        description: "",
        links: [],
        note: "",
    }
}

/** A new link row, while fewer than the maximum exist. */
export function addTeamLinkRow(links: readonly string[]): string[] {
    return links.length >= TEAM_LINKS_MAX ? [...links] : [...links, ""]
}
export function setTeamLinkRow(
    links: readonly string[],
    index: number,
    value: string
): string[] {
    return links.map((link, at) => (at === index ? value : link))
}
export function removeTeamLinkRow(
    links: readonly string[],
    index: number
): string[] {
    return links.filter((_, at) => at !== index)
}

export type TeamRequestField =
    "name" | "shortCode" | "description" | "links" | "note" | "form"
/** Each issue has a localized message under `teamRequests.validation`. */
export type TeamRequestFieldIssue =
    | "nameRequired"
    | "nameInvalid"
    | "shortCodeInvalid"
    | "descriptionInvalid"
    | "linksInvalid"
    | "linksDuplicate"
    | "linksTooMany"
    | "noteInvalid"
    | "invalid"
export type TeamRequestFieldErrors = Partial<
    Record<TeamRequestField, TeamRequestFieldIssue>
>
export type TeamRequestFormResult =
    | {
          kind: "invalid"
          errors: TeamRequestFieldErrors
          /** Link rows (by index in the typed list) to mark invalid. */
          invalidLinks: number[]
      }
    | { kind: "unchanged" }
    | { kind: "send"; input: TeamRequestSubmit }

function sameLinks(left: readonly string[], right: readonly string[]) {
    return (
        left.length === right.length &&
        left.every((link, index) => link === right[index])
    )
}

/**
 * Validates the inputs field by field and builds the submit payload the route
 * accepts. A change request carries every proposed field and must differ from
 * the team's current details; the note alone is not a change. The dialog's
 * idempotency key is passed through unchanged, so a retry of the same inputs
 * produces the same payload and replays the stored request.
 */
export function teamRequestFormInput(input: {
    target: TeamRequestTarget
    values: TeamRequestFormValues
    idempotencyKey: string
}): TeamRequestFormResult {
    const { target, values } = input
    const errors: TeamRequestFieldErrors = {}
    const invalidLinks: number[] = []

    const name = teamNameSchema.safeParse(values.name)
    if (!collapse(values.name)) errors.name = "nameRequired"
    else if (!name.success) errors.name = "nameInvalid"

    const shortCodeText = values.shortCode.trim()
    const shortCode = shortCodeText
        ? teamShortCodeSchema.safeParse(shortCodeText)
        : null
    if (shortCode && !shortCode.success) errors.shortCode = "shortCodeInvalid"

    const descriptionText = values.description.trim()
    const description = descriptionText
        ? teamDescriptionSchema.safeParse(descriptionText)
        : null
    if (description && !description.success)
        errors.description = "descriptionInvalid"

    const links: string[] = []
    let malformed = false
    values.links.forEach((raw, index) => {
        if (!raw.trim()) return
        const link = teamLinkSchema.safeParse(raw)
        if (!link.success) malformed = true
        if (!link.success || links.includes(link.data)) invalidLinks.push(index)
        else links.push(link.data)
    })
    if (malformed) errors.links = "linksInvalid"
    else if (invalidLinks.length) errors.links = "linksDuplicate"
    else if (links.length > TEAM_LINKS_MAX) errors.links = "linksTooMany"

    if (Object.keys(errors).length)
        return { kind: "invalid", errors, invalidLinks }

    const note = values.note.trim() || null
    const proposal = {
        name: name.success ? name.data : "",
        shortCode: shortCode?.success ? shortCode.data : null,
        logoAssetId: values.logo.assetId,
        description: description?.success ? description.data : null,
        links,
    }
    const parsed = teamRequestSubmitSchema.safeParse(
        target.kind === "create"
            ? {
                  kind: "create",
                  gameId: target.gameId,
                  proposal,
                  note,
                  idempotencyKey: input.idempotencyKey,
              }
            : {
                  kind: "update",
                  teamId: target.team.id,
                  proposal,
                  note,
                  idempotencyKey: input.idempotencyKey,
              }
    )
    if (!parsed.success) {
        const noteIssue = parsed.error.issues.some(
            (issue) => issue.path[0] === "note"
        )
        return {
            kind: "invalid",
            errors: noteIssue ? { note: "noteInvalid" } : { form: "invalid" },
            invalidLinks: [],
        }
    }
    if (target.kind === "update") {
        const { team } = target,
            next = parsed.data.proposal
        if (
            next.name === team.name &&
            next.shortCode === team.shortCode &&
            next.logoAssetId === team.logoAssetId &&
            next.description === team.description &&
            sameLinks(next.links, team.links)
        )
            return { kind: "unchanged" }
    }
    return { kind: "send", input: parsed.data }
}

/** The active catalogue team a new-team request would duplicate, by the catalogue's name identity. */
export function catalogueDuplicate(
    items: readonly TeamRecord[],
    name: string
): TeamRecord | null {
    const wanted = normalizeTeamName(name)
    return (
        items.find(
            (team) =>
                !team.archivedAt && normalizeTeamName(team.name) === wanted
        ) ?? null
    )
}

/** The localized message for a failed logo upload; a rate-limited one names the wait in seconds. */
export function teamLogoUploadMessage(
    messages: Readonly<Record<ImageUploadError, string>>,
    failure: { error: ImageUploadError; retryAfterMs: number | null }
): string {
    return formatImageUploadMessage(
        messages[failure.error],
        failure.retryAfterMs
    )
}
