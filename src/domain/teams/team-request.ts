import {
    imageAssetIdSchema,
    teamDescriptionSchema,
    teamGameSchema,
    teamIdSchema,
    teamIdempotencyKeySchema,
    teamLinksSchema,
    teamNameSchema,
    teamRevisionSchema,
    teamShortCodeSchema,
    type TeamGame,
} from "./team"
import { z } from "zod"

/** Pending requests one workspace may hold at a time. */
export const TEAM_REQUEST_PENDING_LIMIT = 20
export const TEAM_REQUEST_NOTE_MAX = 500
export const TEAM_REQUEST_REASON_MAX = 500
export const TEAM_REQUEST_PAGE_MAX = 50

export const TEAM_REQUEST_KINDS = ["create", "update"] as const
export type TeamRequestKind = (typeof TEAM_REQUEST_KINDS)[number]
export const TEAM_REQUEST_STATUSES = [
    "pending",
    "approved",
    "merged",
    "rejected",
    "cancelled",
] as const
export type TeamRequestStatus = (typeof TEAM_REQUEST_STATUSES)[number]
export const teamRequestStatusSchema = z.enum(TEAM_REQUEST_STATUSES)

const noteSchema = z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : value),
    z
        .string()
        .min(1)
        .max(TEAM_REQUEST_NOTE_MAX)
        .refine(
            (value) => !/[\p{Cc}\p{Zl}\p{Zp}]/u.test(value.replace(/\n/g, "")),
            { message: "Notes may not contain control characters." }
        )
)

/** The presentation a requester proposes; every field is reviewed by a global administrator. */
export const teamProposalSchema = z.strictObject({
    name: teamNameSchema,
    shortCode: teamShortCodeSchema.nullable().default(null),
    logoAssetId: imageAssetIdSchema.nullable().default(null),
    description: teamDescriptionSchema.nullable().default(null),
    links: teamLinksSchema.default([]),
})
export type TeamProposal = z.infer<typeof teamProposalSchema>

/** What a workspace administrator submits. A change request names an existing team. */
export const teamRequestSubmitSchema = z.discriminatedUnion("kind", [
    z.strictObject({
        kind: z.literal("create"),
        gameId: teamGameSchema,
        proposal: teamProposalSchema,
        note: noteSchema.nullable().default(null),
        idempotencyKey: teamIdempotencyKeySchema,
    }),
    z.strictObject({
        kind: z.literal("update"),
        teamId: teamIdSchema,
        proposal: teamProposalSchema,
        note: noteSchema.nullable().default(null),
        idempotencyKey: teamIdempotencyKeySchema,
    }),
])
export type TeamRequestSubmit = z.infer<typeof teamRequestSubmitSchema>

/** Administrator decisions. `proposal` replaces the requested fields when edited before approval. */
export const teamRequestDecisionSchema = z.discriminatedUnion("decision", [
    z.strictObject({
        decision: z.literal("approve"),
        proposal: teamProposalSchema.optional(),
        /** Current revision of the target team for a change request. */
        targetRevision: teamRevisionSchema.optional(),
    }),
    z.strictObject({
        decision: z.literal("merge"),
        targetTeamId: teamIdSchema,
    }),
    z.strictObject({
        decision: z.literal("reject"),
        reason: noteSchema.pipe(z.string().max(TEAM_REQUEST_REASON_MAX)),
    }),
])
export type TeamRequestDecision = z.infer<typeof teamRequestDecisionSchema>

export type TeamRequestError =
    | "invalid_request"
    | "not_found"
    | "not_pending"
    | "limit_reached"
    | "idempotency_conflict"
    | "team_archived"
    | "team_game_mismatch"
    | "invalid_decision"

/** Persistence-independent view of a request. */
export type TeamRequestEntity = {
    id: string
    guildId: string
    requestedBy: string
    kind: TeamRequestKind
    gameId: TeamGame
    teamId: string | null
    proposal: TeamProposal
    note: string | null
    status: TeamRequestStatus
    reason: string | null
    resultTeamId: string | null
    decidedBy: string | null
    decidedAt: string | null
    createdAt: string
    updatedAt: string
}

/** Only pending requests can be decided or cancelled. */
export function requestTransitionError(
    request: Pick<TeamRequestEntity, "status">
): TeamRequestError | null {
    return request.status === "pending" ? null : "not_pending"
}

/** A change request may only target an active team; its game is the team's game. */
export function changeRequestTargetError(
    team: { gameId: TeamGame; archivedAt: string | null } | null
): TeamRequestError | null {
    if (!team) return "not_found"
    if (team.archivedAt) return "team_archived"
    return null
}

/** Stable JSON that detects a reused submit idempotency key with another payload. */
export function teamRequestFingerprint(input: TeamRequestSubmit): string {
    return JSON.stringify({
        kind: input.kind,
        gameId: input.kind === "create" ? input.gameId : null,
        teamId: input.kind === "update" ? input.teamId : null,
        proposal: input.proposal,
        note: input.note,
    })
}

export const TEAM_REQUEST_NOTIFICATION_ATTEMPTS = 5
/** Retry backoff for decision DMs: 1, 5, 15 and 60 minutes, then failed. */
export function notificationRetryDelayMs(attempt: number): number | null {
    const delays = [60_000, 300_000, 900_000, 3_600_000]
    return attempt >= TEAM_REQUEST_NOTIFICATION_ATTEMPTS
        ? null
        : (delays[Math.min(attempt - 1, delays.length - 1)] ?? null)
}

/** Dashboard projection of a request; the requester's subject is shown only to administrators. */
export const teamRequestRecordSchema = z.strictObject({
    id: z.string(),
    guildId: z.string(),
    workspaceName: z.string().nullable(),
    requestedBy: z.string().nullable(),
    kind: z.enum(TEAM_REQUEST_KINDS),
    gameId: teamGameSchema,
    teamId: z.string().nullable(),
    teamName: z.string().nullable(),
    proposal: z.strictObject({
        name: z.string(),
        shortCode: z.string().nullable(),
        logoAssetId: z.string().nullable(),
        logoUrl: z.string().nullable(),
        description: z.string().nullable(),
        links: z.array(z.string()),
    }),
    note: z.string().nullable(),
    status: teamRequestStatusSchema,
    reason: z.string().nullable(),
    resultTeamId: z.string().nullable(),
    decidedAt: z.string().nullable(),
    createdAt: z.string(),
    notification: z.enum(["none", "pending", "sent", "failed"]),
})
export type TeamRequestRecord = z.infer<typeof teamRequestRecordSchema>
export const teamRequestPageSchema = z.strictObject({
    items: z.array(teamRequestRecordSchema).max(TEAM_REQUEST_PAGE_MAX),
    nextCursor: z.string().nullable(),
})
