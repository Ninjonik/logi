import {
    linkedGuildIdSchema,
    TEAM_LINKS_MAX,
    teamDescriptionSchema,
    teamLinksSchema,
    teamNameSchema,
    teamShortCodeSchema,
    type TeamGame,
    type TeamRecord,
} from "@/domain/teams/team"
import {
    teamRequestDecisionSchema,
    type TeamRequestDecision,
    type TeamRequestRecord,
} from "@/domain/teams/team-request"
import type { AdminTeamCommand } from "./team-admin-client"

/** The editable inputs shared by the catalogue dialog and request approval, as typed. */
export type TeamEditorValues = {
    name: string
    shortCode: string
    description: string
    /** Always `TEAM_LINKS_MAX` inputs; blank ones are dropped when saving. */
    links: string[]
    logo: { assetId: string | null; url: string | null }
}
export type TeamEditorField = "name" | "shortCode" | "description" | "links"
/** The validated values in the shape the catalogue and proposals store. */
export type TeamEditorFields = {
    name: string
    shortCode: string | null
    description: string | null
    links: string[]
    logoAssetId: string | null
}

function slots(links: readonly string[]): string[] {
    return Array.from(
        { length: TEAM_LINKS_MAX },
        (_, index) => links[index] ?? ""
    )
}

export function editorValuesFromTeam(
    team: TeamRecord | null | undefined
): TeamEditorValues {
    return {
        name: team?.name ?? "",
        shortCode: team?.shortCode ?? "",
        description: team?.description ?? "",
        links: slots(team?.links ?? []),
        logo: {
            assetId: team?.logoAssetId ?? null,
            url: team?.logoUrl ?? null,
        },
    }
}

/** An editable copy of a request's proposal, including the requester's logo. */
export function editorValuesFromProposal(
    proposal: TeamRequestRecord["proposal"]
): TeamEditorValues {
    return {
        name: proposal.name,
        shortCode: proposal.shortCode ?? "",
        description: proposal.description ?? "",
        links: slots(proposal.links),
        logo: { assetId: proposal.logoAssetId, url: proposal.logoUrl },
    }
}

/** The non-blank, trimmed links in input order. */
export function editorLinks(values: Pick<TeamEditorValues, "links">): string[] {
    return values.links.map((link) => link.trim()).filter(Boolean)
}

/** Checks every field with the domain schemas; the first invalid field is named. */
export function validateEditorValues(
    values: TeamEditorValues
):
    | { ok: true; fields: TeamEditorFields }
    | { ok: false; field: TeamEditorField } {
    const name = teamNameSchema.safeParse(values.name)
    if (!name.success) return { ok: false, field: "name" }
    const rawCode = values.shortCode.trim()
    const shortCode = rawCode ? teamShortCodeSchema.safeParse(rawCode) : null
    if (shortCode && !shortCode.success)
        return { ok: false, field: "shortCode" }
    const rawDescription = values.description.trim()
    const description = rawDescription
        ? teamDescriptionSchema.safeParse(rawDescription)
        : null
    if (description && !description.success)
        return { ok: false, field: "description" }
    const links = teamLinksSchema.safeParse(editorLinks(values))
    if (!links.success) return { ok: false, field: "links" }
    return {
        ok: true,
        fields: {
            name: name.data,
            shortCode: shortCode?.data ?? null,
            description: description?.data ?? null,
            links: links.data,
            logoAssetId: values.logo.assetId,
        },
    }
}

const sameLinks = (left: readonly string[], right: readonly string[]) =>
    left.length === right.length &&
    left.every((link, index) => link === right[index])

export type CatalogueFormCommand =
    | { kind: "invalid"; field: TeamEditorField | "linkedGuildId" }
    | { kind: "unchanged" }
    | { kind: "send"; command: AdminTeamCommand }

/**
 * Builds the create, or an update carrying only the fields that differ from
 * `base` (the record the inputs were last synchronized with). An empty
 * `linkedGuildId` means no linked workspace.
 */
export function catalogueFormCommand(input: {
    base: TeamRecord | null
    values: TeamEditorValues
    linkedGuildId: string
    gameId: TeamGame
    idempotencyKey: string
}): CatalogueFormCommand {
    const checked = validateEditorValues(input.values)
    if (!checked.ok) return { kind: "invalid", field: checked.field }
    const rawLinked = input.linkedGuildId.trim()
    const linked = rawLinked ? linkedGuildIdSchema.safeParse(rawLinked) : null
    if (linked && !linked.success)
        return { kind: "invalid", field: "linkedGuildId" }
    const fields = checked.fields,
        linkedGuildId = linked?.data ?? null
    const { base } = input
    if (!base)
        return {
            kind: "send",
            command: {
                action: "create",
                input: {
                    gameId: input.gameId,
                    ...fields,
                    linkedGuildId,
                    idempotencyKey: input.idempotencyKey,
                },
            },
        }
    const changes = {
        ...(fields.name !== base.name ? { name: fields.name } : {}),
        ...(fields.shortCode !== base.shortCode
            ? { shortCode: fields.shortCode }
            : {}),
        ...(fields.description !== base.description
            ? { description: fields.description }
            : {}),
        ...(!sameLinks(fields.links, base.links)
            ? { links: fields.links }
            : {}),
        ...(fields.logoAssetId !== base.logoAssetId
            ? { logoAssetId: fields.logoAssetId }
            : {}),
        ...(linkedGuildId !== base.linkedGuildId ? { linkedGuildId } : {}),
    }
    if (Object.keys(changes).length === 0) return { kind: "unchanged" }
    return {
        kind: "send",
        command: {
            action: "update",
            teamId: base.id,
            input: { expectedRevision: base.revision, ...changes },
        },
    }
}

const label = (raw: string) =>
    raw
        .normalize("NFKC")
        .trim()
        .replace(/[ \t]+/g, " ")
const optional = (raw: string) => label(raw) || null

/**
 * After a stale-revision rejection: every field the user left as it was in
 * `previous` follows `latest`, so retrying cannot revert a concurrent change;
 * fields the user edited are kept.
 */
export function rebaseCatalogueForm(
    form: { values: TeamEditorValues; linkedGuildId: string },
    previous: TeamRecord,
    latest: TeamRecord
): { values: TeamEditorValues; linkedGuildId: string } {
    const { values } = form
    const description = values.description.trim() || null
    return {
        values: {
            name:
                label(values.name) === previous.name
                    ? latest.name
                    : values.name,
            shortCode:
                optional(values.shortCode) === previous.shortCode
                    ? (latest.shortCode ?? "")
                    : values.shortCode,
            description:
                description === previous.description
                    ? (latest.description ?? "")
                    : values.description,
            links: sameLinks(editorLinks(values), previous.links)
                ? slots(latest.links)
                : values.links,
            logo:
                values.logo.assetId === previous.logoAssetId
                    ? { assetId: latest.logoAssetId, url: latest.logoUrl }
                    : values.logo,
        },
        linkedGuildId:
            (form.linkedGuildId.trim() || null) === previous.linkedGuildId
                ? (latest.linkedGuildId ?? "")
                : form.linkedGuildId,
    }
}

export type ApproveDecisionResult =
    | { kind: "invalid"; field: TeamEditorField }
    /** A change request is approved against the current team's revision, which is not loaded. */
    | { kind: "needs_team" }
    | { kind: "send"; decision: TeamRequestDecision; edited: boolean }

/**
 * Builds an approval. The proposal is sent only when the administrator edited
 * it; a change request always carries the revision of the team as reviewed.
 */
export function approveDecision(input: {
    request: Pick<TeamRequestRecord, "kind" | "proposal">
    values: TeamEditorValues
    currentTeam: Pick<TeamRecord, "revision"> | null
}): ApproveDecisionResult {
    const checked = validateEditorValues(input.values)
    if (!checked.ok) return { kind: "invalid", field: checked.field }
    if (input.request.kind === "update" && !input.currentTeam)
        return { kind: "needs_team" }
    const fields = checked.fields,
        original = input.request.proposal
    const edited =
        fields.name !== original.name ||
        fields.shortCode !== original.shortCode ||
        fields.description !== original.description ||
        !sameLinks(fields.links, original.links) ||
        fields.logoAssetId !== original.logoAssetId
    return {
        kind: "send",
        edited,
        decision: {
            decision: "approve",
            ...(edited ? { proposal: fields } : {}),
            ...(input.request.kind === "update" && input.currentTeam
                ? { targetRevision: input.currentTeam.revision }
                : {}),
        },
    }
}

/** A rejection needs a reason of at most 500 characters (trimmed). */
export function rejectDecision(
    reason: string
): { kind: "invalid" } | { kind: "send"; decision: TeamRequestDecision } {
    const parsed = teamRequestDecisionSchema.safeParse({
        decision: "reject",
        reason,
    })
    return parsed.success
        ? { kind: "send", decision: parsed.data }
        : { kind: "invalid" }
}

/** Fields of a change request's proposal that differ from the team as it is now. */
export function proposalChanges(
    proposal: TeamRequestRecord["proposal"],
    team: Pick<
        TeamRecord,
        "name" | "shortCode" | "description" | "links" | "logoAssetId"
    >
): Set<TeamEditorField | "logo"> {
    const changed = new Set<TeamEditorField | "logo">()
    if (proposal.name !== team.name) changed.add("name")
    if (proposal.shortCode !== team.shortCode) changed.add("shortCode")
    if (proposal.description !== team.description) changed.add("description")
    if (!sameLinks(proposal.links, team.links)) changed.add("links")
    if (proposal.logoAssetId !== team.logoAssetId) changed.add("logo")
    return changed
}
