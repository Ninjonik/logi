import { deriveEventStatus } from "./status"
import type { EventStatus } from "./types"
import { z } from "zod"

export const websiteEventGameSchema = z.enum(["hell_let_loose", "wardogs"])
export const websiteEventRevisionSchema = z
    .string()
    .regex(/^(0|[1-9][0-9]{0,127})$/)
export const websiteEventIdSchema = z
    .string()
    .regex(/^[A-Za-z0-9][A-Za-z0-9_:-]{0,199}$/)
export const websiteEventKeySchema = z.string().regex(/^[A-Za-z0-9_-]{16,128}$/)
const websitePolicyGame = z.strictObject({
    gameId: websiteEventGameSchema,
    roleIds: z
        .array(z.string().regex(/^\d{17,20}$/))
        .max(64)
        .refine((roles) => new Set(roles).size === roles.length),
})
export const websiteEventPolicySchema = z.strictObject({
    enabled: z.boolean(),
    games: z
        .array(websitePolicyGame)
        .max(2)
        .refine(
            (games) =>
                new Set(games.map((game) => game.gameId)).size === games.length
        ),
})
export const websiteEventPolicyInputSchema = z.strictObject({
    applicationRecordId: websiteEventIdSchema,
    apiKeyId: websiteEventIdSchema,
    policy: websiteEventPolicySchema,
})
export const websiteEventPolicyResultSchema = websiteEventPolicySchema.extend({
    version: websiteEventRevisionSchema,
})
export const websiteEventPolicyListSchema = z
    .array(
        websiteEventPolicyResultSchema.extend({
            apiKeyId: websiteEventIdSchema,
        })
    )
    .max(100)
export type WebsiteEventPolicyInput = z.infer<
    typeof websiteEventPolicyInputSchema
>
const instant = z.iso.datetime()
export const websiteEventFieldsSchema = z
    .strictObject({
        kind: z.enum(["match", "training"]),
        name: z.string().trim().min(1).max(160),
        matchType: z.string().trim().max(80).optional(),
        description: z.string().trim().max(2000).optional(),
        map: z.string().trim().max(200).optional(),
        side: z.string().trim().max(200).optional(),
        registrationStart: instant.optional(),
        registrationEnd: instant,
        meetingStart: instant,
        gameStart: instant,
        gameEnd: instant,
    })
    .refine(
        (event) =>
            (!event.registrationStart ||
                Date.parse(event.registrationStart) <=
                    Date.parse(event.registrationEnd)) &&
            Date.parse(event.registrationEnd) <=
                Date.parse(event.meetingStart) &&
            Date.parse(event.meetingStart) <= Date.parse(event.gameStart) &&
            Date.parse(event.gameStart) < Date.parse(event.gameEnd),
        { message: "Invalid event schedule." }
    )
export const websiteEventCommandSchema = z.discriminatedUnion("operation", [
    z.strictObject({
        operation: z.literal("create"),
        event: websiteEventFieldsSchema,
    }),
    z.strictObject({
        operation: z.literal("update"),
        eventId: websiteEventIdSchema,
        expectedRevision: websiteEventRevisionSchema,
        event: websiteEventFieldsSchema,
    }),
    z.strictObject({
        operation: z.literal("cancel"),
        eventId: websiteEventIdSchema,
        expectedRevision: websiteEventRevisionSchema,
    }),
])
export type WebsiteEventCommand = z.infer<typeof websiteEventCommandSchema>
export type WebsiteEventFields = z.infer<typeof websiteEventFieldsSchema>
export type WebsiteEventGame = z.infer<typeof websiteEventGameSchema>
export type WebsiteEventError =
    | "unauthorized"
    | "insufficient_scope"
    | "policy_denied"
    | "membership_denied"
    | "membership_stale"
    | "not_found"
    | "revision_conflict"
    | "idempotency_conflict"
    | "invalid_state"
    | "invalid_request"
export type WebsiteEventReceipt = {
    eventId: string
    guildId: string
    gameId: WebsiteEventGame
    revision: string
    operation: WebsiteEventCommand["operation"]
    receiptId: string
    replayed: boolean
}
export const websiteEventReceiptSchema = z.strictObject({
    eventId: websiteEventIdSchema,
    guildId: z.string().regex(/^\d{17,20}$/),
    gameId: websiteEventGameSchema,
    revision: websiteEventRevisionSchema,
    operation: z.enum(["create", "update", "cancel"]),
    receiptId: websiteEventIdSchema,
    replayed: z.boolean(),
})
export const websiteEventEditorSchema = z.strictObject({
    eventId: websiteEventIdSchema,
    guildId: z.string().regex(/^\d{17,20}$/),
    gameId: websiteEventGameSchema,
    revision: websiteEventRevisionSchema,
    event: websiteEventFieldsSchema,
    canEdit: z.boolean(),
    canCancel: z.boolean(),
})
export type WebsiteEventResult =
    { data: WebsiteEventReceipt } | { error: { code: WebsiteEventError } }
export type WebsiteEventActor = {
    subject: string
    clientId: string
    applicationRecordId: string
    apiKeyId: string
    guildId: string
}

export function canonicalWebsiteCommand(
    gameId: WebsiteEventGame,
    command: WebsiteEventCommand
): string {
    const sort = (value: unknown): unknown => {
        if (Array.isArray(value)) return value.map(sort)
        if (value && typeof value === "object")
            return Object.fromEntries(
                Object.entries(value)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .filter(([, child]) => child !== undefined)
                    .map(([key, child]) => [key, sort(child)])
            )
        return value
    }
    return JSON.stringify(sort({ gameId, command }))
}

/** No legacy full-access grant, global permission, login claim or assignment fallback. */
export function allowsWebsiteEventWrite(
    access: unknown,
    gameId: WebsiteEventGame
): boolean {
    const result = z
        .strictObject({
            resources: z.array(z.literal("event-commands")).length(1),
            gameIds: z.array(websiteEventGameSchema).min(1).max(2),
        })
        .safeParse(access)
    return (
        result.success &&
        new Set(result.data.gameIds).size === result.data.gameIds.length &&
        result.data.gameIds.includes(gameId)
    )
}

export function websiteEventMembershipError(input: {
    now: number
    epoch: string
    allowedRoles: readonly string[]
    observation: {
        state: string
        roleIds: readonly string[]
        observedAt: string | null
        epoch: string
        unavailable?: boolean
    } | null
}): "membership_stale" | "membership_denied" | null {
    const observation = input.observation
    const observedAt = observation?.observedAt
        ? Date.parse(observation.observedAt)
        : NaN
    if (
        !observation ||
        observation.epoch !== input.epoch ||
        observation.unavailable ||
        !Number.isFinite(observedAt) ||
        observedAt > input.now ||
        input.now - observedAt > 60_000
    )
        return "membership_stale"
    return observation.state === "present" &&
        input.allowedRoles.some((role) => observation.roleIds.includes(role))
        ? null
        : "membership_denied"
}

export function canEditWebsiteEvent(
    event: {
        registrationEnd: string
        meetingStart: string
        gameEnd: string
        status?: EventStatus
    },
    now: number
): boolean {
    return (
        Number.isFinite(Date.parse(event.meetingStart)) &&
        now < Date.parse(event.meetingStart) &&
        deriveEventStatus(event, new Date(now)) !== "concluded"
    )
}

/** Existing Logi pre-meeting conclusion semantics; no new cancelled status or result. */
export function websiteEventStateError(
    command: WebsiteEventCommand,
    existing: {
        kind?: string
        registrationEnd: string
        meetingStart: string
        gameEnd: string
        status?: EventStatus
    } | null,
    now: number
): "invalid_state" | null {
    if (command.operation === "create")
        return Date.parse(command.event.meetingStart) > now
            ? null
            : "invalid_state"
    if (!existing || !canEditWebsiteEvent(existing, now)) return "invalid_state"
    if (
        command.operation === "update" &&
        ((existing.kind ?? "match") !== command.event.kind ||
            Date.parse(command.event.meetingStart) <= now)
    )
        return "invalid_state"
    return null
}
