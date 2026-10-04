import { z } from "zod"

/** Directory games; Hell Let Loose: Vietnam is deliberately excluded from this feature. */
export const TEAM_GAMES = ["hell_let_loose", "wardogs"] as const
export type TeamGame = (typeof TEAM_GAMES)[number]
export const teamGameSchema = z.enum(TEAM_GAMES)

/** Control characters, line and paragraph separators can never be part of a label. */
const FORBIDDEN = /[\p{Cc}\p{Zl}\p{Zp}]/u
const collapse = (value: unknown) =>
    typeof value === "string"
        ? value
              .normalize("NFKC")
              .trim()
              .replace(/[ \t]+/g, " ")
        : value
function labelSchema(max: number) {
    return z.preprocess(
        collapse,
        z
            .string()
            .min(1)
            .max(max)
            .refine((value) => !FORBIDDEN.test(value), {
                message: "Labels may not contain control characters.",
            })
    )
}
export const TEAM_NAME_MAX = 120
export const TEAM_SHORT_CODE_MAX = 16
export const teamNameSchema = labelSchema(TEAM_NAME_MAX)
export const teamShortCodeSchema = labelSchema(TEAM_SHORT_CODE_MAX)
export const teamIdSchema = z.string().min(1).max(64)
export const imageAssetIdSchema = z.string().min(1).max(64)
export const teamRevisionSchema = z.number().int().min(1)
/** Client-generated retry token; the same key with the same payload returns the original result. */
export const teamIdempotencyKeySchema = z
    .string()
    .regex(/^[A-Za-z0-9_-]{8,128}$/)

/**
 * Uniqueness identity within a workspace and game: NFKC, trimmed/collapsed
 * whitespace and Unicode lowercase. Accents remain significant.
 */
export function normalizeTeamName(name: string): string {
    return name.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase()
}

export const teamCreateSchema = z.strictObject({
    gameId: teamGameSchema,
    name: teamNameSchema,
    shortCode: teamShortCodeSchema.nullable().default(null),
    logoAssetId: imageAssetIdSchema.nullable().default(null),
    idempotencyKey: teamIdempotencyKeySchema,
})
export type TeamCreateInput = z.infer<typeof teamCreateSchema>

export const teamUpdateSchema = z
    .strictObject({
        expectedRevision: teamRevisionSchema,
        name: teamNameSchema.optional(),
        shortCode: teamShortCodeSchema.nullable().optional(),
        logoAssetId: imageAssetIdSchema.nullable().optional(),
    })
    .refine(
        (value) =>
            value.name !== undefined ||
            value.shortCode !== undefined ||
            value.logoAssetId !== undefined,
        { message: "An update must change at least one field." }
    )
export type TeamUpdateInput = z.infer<typeof teamUpdateSchema>

export const teamLifecycleSchema = z.strictObject({
    expectedRevision: teamRevisionSchema,
})
export type TeamLifecycleInput = z.infer<typeof teamLifecycleSchema>

export type TeamCommandError =
    | "invalid_team"
    | "game_disabled"
    | "duplicate_name"
    | "revision_conflict"
    | "idempotency_conflict"
    | "not_found"
    | "archived"
    | "not_archived"
    | "asset_unavailable"
    | "limit_reached"

/** Persistence-independent view of a directory record. */
export type TeamEntity = {
    id: string
    guildId: string
    gameId: TeamGame
    name: string
    shortCode: string | null
    logoAssetId: string | null
    normalizedName: string
    archivedAt: string | null
    revision: number
    createdAt: string
    updatedAt: string
}

/** Website DTO: minimized, actor identifiers excluded, absent optional values null. */
export const teamDtoSchema = z.strictObject({
    id: z.string(),
    gameId: teamGameSchema,
    name: z.string(),
    shortCode: z.string().nullable(),
    logoUrl: z.string().nullable(),
    revision: z.number().int().min(1),
    updatedAt: z.string(),
})
export type TeamDto = z.infer<typeof teamDtoSchema>
export const teamPageSchema = z.strictObject({
    items: z.array(teamDtoSchema).max(100),
    nextCursor: z.string().nullable(),
})
export type TeamPage = z.infer<typeof teamPageSchema>

/** Dashboard projection adds lifecycle and the attached asset reference. */
export const teamRecordSchema = teamDtoSchema.extend({
    logoAssetId: z.string().nullable(),
    archivedAt: z.string().nullable(),
    createdAt: z.string(),
})
export type TeamRecord = z.infer<typeof teamRecordSchema>
export const teamRecordPageSchema = z.strictObject({
    items: z.array(teamRecordSchema).max(100),
    nextCursor: z.string().nullable(),
})
export const TEAM_PAGE_DEFAULT = 50
export const TEAM_PAGE_MAX = 100
export const TEAM_SEARCH_MAX = 64
/** Bounded directory size per workspace and game. */
export const TEAM_DIRECTORY_LIMIT = 500

export function projectTeam(team: TeamEntity, logoUrl: string | null): TeamDto {
    return teamDtoSchema.parse({
        id: team.id,
        gameId: team.gameId,
        name: team.name,
        shortCode: team.shortCode,
        logoUrl: team.logoAssetId ? logoUrl : null,
        revision: team.revision,
        updatedAt: team.updatedAt,
    })
}
export function projectTeamRecord(
    team: TeamEntity,
    logoUrl: string | null
): TeamRecord {
    return teamRecordSchema.parse({
        ...projectTeam(team, logoUrl),
        logoAssetId: team.logoAssetId,
        archivedAt: team.archivedAt,
        createdAt: team.createdAt,
    })
}

/** Text shown where no logo exists: the short code, else up to two word initials. */
export function teamInitials(name: string, shortCode: string | null): string {
    if (shortCode) return [...shortCode].slice(0, 4).join("").toUpperCase()
    const words = name.split(" ").filter(Boolean)
    return words
        .slice(0, 2)
        .map((word) => [...word][0] ?? "")
        .join("")
        .toUpperCase()
}

/** Search text indexed for scoped name/short-code lookup. */
export function teamSearchText(name: string, shortCode: string | null) {
    return [name, shortCode].filter(Boolean).join(" ")
}

export type TeamCreateDecision =
    | { ok: true; team: Omit<TeamEntity, "id"> }
    | { ok: false; error: TeamCommandError; existingId?: string }

/** Decides a create against the workspace's enabled games and the exact-name index. */
export function decideTeamCreate(input: {
    guildId: string
    enabledGames: readonly string[]
    input: TeamCreateInput
    existing: { id: string; archivedAt: string | null } | null
    count: number
    now: string
}): TeamCreateDecision {
    if (!input.enabledGames.includes(input.input.gameId))
        return { ok: false, error: "game_disabled" }
    if (input.existing)
        return {
            ok: false,
            error: "duplicate_name",
            existingId: input.existing.id,
        }
    if (input.count >= TEAM_DIRECTORY_LIMIT)
        return { ok: false, error: "limit_reached" }
    return {
        ok: true,
        team: {
            guildId: input.guildId,
            gameId: input.input.gameId,
            name: input.input.name,
            shortCode: input.input.shortCode,
            logoAssetId: input.input.logoAssetId,
            normalizedName: normalizeTeamName(input.input.name),
            archivedAt: null,
            revision: 1,
            createdAt: input.now,
            updatedAt: input.now,
        },
    }
}

export type TeamPatch = Pick<
    TeamEntity,
    | "name"
    | "shortCode"
    | "logoAssetId"
    | "normalizedName"
    | "revision"
    | "updatedAt"
>
export type TeamUpdateDecision =
    | { ok: true; patch: TeamPatch }
    | { ok: false; error: TeamCommandError; existingId?: string }

/** Applies an update when the caller holds the current revision; renames re-check uniqueness. */
export function decideTeamUpdate(input: {
    team: TeamEntity
    input: TeamUpdateInput
    conflicting: { id: string } | null
    now: string
}): TeamUpdateDecision {
    if (input.team.revision !== input.input.expectedRevision)
        return { ok: false, error: "revision_conflict" }
    if (input.team.archivedAt) return { ok: false, error: "archived" }
    const name = input.input.name ?? input.team.name
    const normalizedName = normalizeTeamName(name)
    if (input.conflicting && input.conflicting.id !== input.team.id)
        return {
            ok: false,
            error: "duplicate_name",
            existingId: input.conflicting.id,
        }
    return {
        ok: true,
        patch: {
            name,
            normalizedName,
            shortCode:
                input.input.shortCode === undefined
                    ? input.team.shortCode
                    : input.input.shortCode,
            logoAssetId:
                input.input.logoAssetId === undefined
                    ? input.team.logoAssetId
                    : input.input.logoAssetId,
            revision: input.team.revision + 1,
            updatedAt: input.now,
        },
    }
}

export type TeamLifecycleDecision =
    | {
          ok: true
          patch: Pick<TeamEntity, "archivedAt" | "revision" | "updatedAt">
      }
    | { ok: false; error: TeamCommandError }

export function decideTeamArchive(input: {
    team: TeamEntity
    input: TeamLifecycleInput
    now: string
}): TeamLifecycleDecision {
    if (input.team.revision !== input.input.expectedRevision)
        return { ok: false, error: "revision_conflict" }
    if (input.team.archivedAt) return { ok: false, error: "archived" }
    return {
        ok: true,
        patch: {
            archivedAt: input.now,
            revision: input.team.revision + 1,
            updatedAt: input.now,
        },
    }
}

export function decideTeamRestore(input: {
    team: TeamEntity
    input: TeamLifecycleInput
    now: string
}): TeamLifecycleDecision {
    if (input.team.revision !== input.input.expectedRevision)
        return { ok: false, error: "revision_conflict" }
    if (!input.team.archivedAt) return { ok: false, error: "not_archived" }
    return {
        ok: true,
        patch: {
            archivedAt: null,
            revision: input.team.revision + 1,
            updatedAt: input.now,
        },
    }
}

/** Stable JSON used to detect a reused idempotency key with a different payload. */
export function teamCreateFingerprint(input: TeamCreateInput): string {
    return JSON.stringify({
        gameId: input.gameId,
        name: input.name,
        shortCode: input.shortCode,
        logoAssetId: input.logoAssetId,
    })
}

export const TEAM_AUDIT_OPERATIONS = [
    "create",
    "update",
    "archive",
    "restore",
    "snapshot_refresh",
] as const
export type TeamAuditOperation = (typeof TEAM_AUDIT_OPERATIONS)[number]
