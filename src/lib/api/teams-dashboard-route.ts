import {
    TEAM_PAGE_DEFAULT,
    TEAM_PAGE_MAX,
    TEAM_SEARCH_MAX,
    teamCreateSchema,
    teamGameSchema,
    teamIdSchema,
    teamLifecycleSchema,
    teamUpdateSchema,
    type TeamGame,
} from "@/domain/teams/team"
import { z } from "zod"

/** A dashboard directory read: one record by ID, or a page of one game's entries. */
export type TeamsQuery =
    | { kind: "get"; teamId: string }
    | {
          kind: "list"
          gameId: TeamGame
          archived: boolean
          search?: string
          cursor: string | null
          limit: number
      }

const flag = z.enum(["true", "false"]).transform((value) => value === "true")
const listQuerySchema = z.object({
    game: teamGameSchema,
    archived: flag.default(false),
    search: z
        .string()
        .trim()
        .max(TEAM_SEARCH_MAX)
        .optional()
        .transform((value) => value || undefined),
    cursor: z.string().min(1).max(4096).optional(),
    limit: z.coerce
        .number()
        .int()
        .min(1)
        .max(TEAM_PAGE_MAX)
        .default(TEAM_PAGE_DEFAULT),
})

/** `null` means the request is malformed; a bad `game` or an out-of-range limit is rejected, not clamped. */
export function parseTeamsQuery(params: URLSearchParams): TeamsQuery | null {
    const teamId = params.get("teamId")
    if (teamId !== null) {
        const parsed = teamIdSchema.safeParse(teamId)
        return parsed.success ? { kind: "get", teamId: parsed.data } : null
    }
    const parsed = listQuerySchema.safeParse({
        game: params.get("game") ?? undefined,
        archived: params.get("archived") ?? undefined,
        search: params.get("search") ?? undefined,
        cursor: params.get("cursor") ?? undefined,
        limit: params.get("limit") ?? undefined,
    })
    if (!parsed.success) return null
    return {
        kind: "list",
        gameId: parsed.data.game,
        archived: parsed.data.archived,
        ...(parsed.data.search ? { search: parsed.data.search } : {}),
        cursor: parsed.data.cursor ?? null,
        limit: parsed.data.limit,
    }
}

/** Dashboard write commands; each `input` is validated with the domain schema before Convex sees it. */
export const teamCommandSchema = z.discriminatedUnion("action", [
    z.strictObject({ action: z.literal("create"), input: teamCreateSchema }),
    z.strictObject({
        action: z.literal("update"),
        teamId: teamIdSchema,
        input: teamUpdateSchema,
    }),
    z.strictObject({
        action: z.literal("archive"),
        teamId: teamIdSchema,
        input: teamLifecycleSchema,
    }),
    z.strictObject({
        action: z.literal("restore"),
        teamId: teamIdSchema,
        input: teamLifecycleSchema,
    }),
])
export type TeamCommand = z.infer<typeof teamCommandSchema>

export const TEAM_MUTATION_FOR = {
    create: "teams:create",
    update: "teams:update",
    archive: "teams:archive",
    restore: "teams:restore",
} as const satisfies Record<TeamCommand["action"], string>

const CONFLICTS = new Set([
    "duplicate_name",
    "revision_conflict",
    "idempotency_conflict",
    "archived",
    "not_archived",
])

/** Maps a `TeamCommandError` to an HTTP status: conflicts 409, missing 404, everything else 400. */
export function teamErrorStatus(error: string): number {
    if (CONFLICTS.has(error)) return 409
    if (error === "not_found") return 404
    return 400
}

/** Turns a Convex command result into a response body and status, passing `existingId` through. */
export function teamCommandResponse(result: unknown): {
    body: unknown
    status: number
} {
    const record =
        result && typeof result === "object"
            ? (result as { error?: unknown; existingId?: unknown })
            : {}
    if (typeof record.error === "string") {
        return {
            body: {
                error: record.error,
                ...(typeof record.existingId === "string"
                    ? { existingId: record.existingId }
                    : {}),
            },
            status: teamErrorStatus(record.error),
        }
    }
    return { body: result, status: 200 }
}
