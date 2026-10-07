import {
    TEAM_PAGE_DEFAULT,
    TEAM_PAGE_MAX,
    TEAM_SEARCH_MAX,
    teamCreateSchema,
    teamGameSchema,
    teamIdSchema,
    teamLifecycleSchema,
    teamMergeSchema,
    teamUpdateSchema,
    type TeamGame,
} from "@/domain/teams/team"
import {
    TEAM_USAGE_IDS_MAX,
    teamCatalogueStateSchema,
    type TeamCatalogueState,
} from "@/domain/teams/team-usage"
import {
    isSameOrigin,
    noStore,
    superadminCommandResponse,
    SUPERADMIN_JSON_LIMIT,
} from "./superadmin-route"
import { readBoundedJson } from "./request-json"
import { z } from "zod"

/**
 * A catalogue read: one record by ID, where listed teams are used, or a page
 * of one game's entries (by `state` when given, else the `archived` flag).
 */
export type SuperadminTeamsQuery =
    | { kind: "get"; teamId: string }
    | { kind: "usage"; teamIds: string[] }
    | {
          kind: "list"
          gameId: TeamGame
          archived: boolean
          state?: TeamCatalogueState
          search?: string
          cursor: string | null
          limit: number
      }
export type SuperadminTeamsListQuery = Extract<
    SuperadminTeamsQuery,
    { kind: "list" }
>

const flag = z.enum(["true", "false"]).transform((value) => value === "true")
const listQuerySchema = z.object({
    game: teamGameSchema,
    archived: flag.default(false),
    state: teamCatalogueStateSchema.optional(),
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

/** `?usage=` takes comma-separated catalogue IDs, one catalogue page at most. */
const usageSchema = z.array(teamIdSchema).min(1).max(TEAM_USAGE_IDS_MAX)

/** `null` means the query is malformed; a bad `game` or an out-of-range limit is rejected, not clamped. */
export function parseSuperadminTeamsQuery(
    params: URLSearchParams
): SuperadminTeamsQuery | null {
    const teamId = params.get("teamId")
    if (teamId !== null) {
        const parsed = teamIdSchema.safeParse(teamId)
        return parsed.success ? { kind: "get", teamId: parsed.data } : null
    }
    const usage = params.get("usage")
    if (usage !== null) {
        const parsed = usageSchema.safeParse(usage.split(","))
        return parsed.success
            ? { kind: "usage", teamIds: [...new Set(parsed.data)] }
            : null
    }
    const parsed = listQuerySchema.safeParse({
        game: params.get("game") ?? undefined,
        archived: params.get("archived") ?? undefined,
        state: params.get("state") ?? undefined,
        search: params.get("search") ?? undefined,
        cursor: params.get("cursor") ?? undefined,
        limit: params.get("limit") ?? undefined,
    })
    if (!parsed.success) return null
    return {
        kind: "list",
        gameId: parsed.data.game,
        archived: parsed.data.archived,
        ...(parsed.data.state ? { state: parsed.data.state } : {}),
        ...(parsed.data.search ? { search: parsed.data.search } : {}),
        cursor: parsed.data.cursor ?? null,
        limit: parsed.data.limit,
    }
}

/** Catalogue writes; each `input` is validated with the domain schema before Convex sees it. */
export const superadminTeamCommandSchema = z.discriminatedUnion("action", [
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
    z.strictObject({
        action: z.literal("merge"),
        teamId: teamIdSchema,
        input: teamMergeSchema,
    }),
])
export type SuperadminTeamCommand = z.infer<typeof superadminTeamCommandSchema>

export const SUPERADMIN_TEAM_MUTATION = {
    create: "teams:create",
    update: "teams:update",
    archive: "teams:archive",
    restore: "teams:restore",
    merge: "teams:merge",
} as const satisfies Record<SuperadminTeamCommand["action"], string>
export type SuperadminTeamMutation =
    (typeof SUPERADMIN_TEAM_MUTATION)[SuperadminTeamCommand["action"]]

export type SuperadminTeamsPorts<Access> = {
    /** The dashboard's public origin that writes must come from. */
    origin: string
    /** The attested global administrator, or null to deny the request. */
    access(): Promise<Access | null>
    get(access: Access, teamId: string): Promise<unknown>
    /** Competition registrations and pending requests of the listed teams. */
    usage(access: Access, teamIds: string[]): Promise<unknown>
    list(access: Access, query: SuperadminTeamsListQuery): Promise<unknown>
    command(
        access: Access,
        mutation: SuperadminTeamMutation,
        payload: Omit<SuperadminTeamCommand, "action">
    ): Promise<unknown>
}

/**
 * Global catalogue reads and writes for superadmins only. Writes are
 * same-origin, bounded and schema-checked before Convex re-authorizes them.
 */
export function superadminTeamsHandlers<Access>(
    ports: SuperadminTeamsPorts<Access>
) {
    return {
        /** `?teamId=` reads one record as `{ team }`, `?usage=` where teams are used; otherwise `?game=` pages one game's catalogue. */
        async GET(request: Request): Promise<Response> {
            try {
                const access = await ports.access()
                if (!access) return noStore({ error: "forbidden" }, 403)
                const query = parseSuperadminTeamsQuery(
                    new URL(request.url).searchParams
                )
                if (!query) return noStore({ error: "invalid_query" }, 400)
                if (query.kind === "get") {
                    const team = await ports.get(access, query.teamId)
                    return team
                        ? noStore({ team })
                        : noStore({ error: "not_found" }, 404)
                }
                if (query.kind === "usage")
                    return noStore(await ports.usage(access, query.teamIds))
                return noStore(await ports.list(access, query))
            } catch {
                return noStore({ error: "unavailable" }, 503)
            }
        },
        async POST(request: Request): Promise<Response> {
            if (!isSameOrigin(request, ports.origin))
                return noStore({ error: "forbidden" }, 403)
            try {
                const access = await ports.access()
                if (!access) return noStore({ error: "forbidden" }, 403)
                const command = superadminTeamCommandSchema.safeParse(
                    await readBoundedJson(request, SUPERADMIN_JSON_LIMIT)
                )
                if (!command.success)
                    return noStore({ error: "invalid_team" }, 400)
                const { action, ...payload } = command.data
                const result = superadminCommandResponse(
                    await ports.command(
                        access,
                        SUPERADMIN_TEAM_MUTATION[action],
                        payload
                    )
                )
                return noStore(result.body, result.status)
            } catch {
                return noStore({ error: "unavailable" }, 503)
            }
        },
    }
}
