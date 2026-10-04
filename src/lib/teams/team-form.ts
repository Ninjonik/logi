import type { TeamCommandRequest } from "@/lib/teams/team-client"
import type { TeamGame, TeamRecord } from "@/domain/teams/team"

/** The editable inputs of the team dialog, as typed. */
export type TeamFormValues = {
    name: string
    shortCode: string
    logo: { assetId: string | null; url: string | null }
}

export function teamFormValues(
    team: TeamRecord | null | undefined
): TeamFormValues {
    return {
        name: team?.name ?? "",
        shortCode: team?.shortCode ?? "",
        logo: {
            assetId: team?.logoAssetId ?? null,
            url: team?.logoUrl ?? null,
        },
    }
}

/** The name as the directory stores it: trimmed with whitespace collapsed. */
export function teamFormName(raw: string): string {
    return raw.trim().replace(/\s+/g, " ")
}
export function teamFormShortCode(raw: string): string | null {
    return raw.trim() || null
}

export type TeamFormCommand =
    | { kind: "invalid" }
    | { kind: "unchanged" }
    | { kind: "send"; request: TeamCommandRequest }

/**
 * Builds the create, or an update carrying only the fields that differ from
 * `base`, the record the inputs were last synchronized with.
 */
export function teamFormCommand(input: {
    base: TeamRecord | null
    values: TeamFormValues
    gameId: TeamGame
    idempotencyKey: string
}): TeamFormCommand {
    const { base, values } = input
    const name = teamFormName(values.name),
        shortCode = teamFormShortCode(values.shortCode),
        logoAssetId = values.logo.assetId
    if (!name) return { kind: "invalid" }
    if (!base)
        return {
            kind: "send",
            request: {
                action: "create",
                input: {
                    gameId: input.gameId,
                    name,
                    shortCode,
                    logoAssetId,
                    idempotencyKey: input.idempotencyKey,
                },
            },
        }
    const changes = {
        ...(name !== base.name ? { name } : {}),
        ...(shortCode !== base.shortCode ? { shortCode } : {}),
        ...(logoAssetId !== base.logoAssetId ? { logoAssetId } : {}),
    }
    if (Object.keys(changes).length === 0) return { kind: "unchanged" }
    return {
        kind: "send",
        request: {
            action: "update",
            teamId: base.id,
            input: { expectedRevision: base.revision, ...changes },
        },
    }
}

/**
 * After a stale-revision rejection: every field the user left as it was in
 * `previous` follows `latest`, so retrying cannot revert a concurrent change;
 * fields the user edited are kept.
 */
export function rebaseTeamFormValues(
    values: TeamFormValues,
    previous: TeamRecord,
    latest: TeamRecord
): TeamFormValues {
    return {
        name:
            teamFormName(values.name) === previous.name
                ? latest.name
                : values.name,
        shortCode:
            teamFormShortCode(values.shortCode) === previous.shortCode
                ? (latest.shortCode ?? "")
                : values.shortCode,
        logo:
            values.logo.assetId === previous.logoAssetId
                ? { assetId: latest.logoAssetId, url: latest.logoUrl }
                : values.logo,
    }
}
