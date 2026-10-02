import {
    websiteEventCommandSchema,
    websiteEventEditorSchema,
    websiteEventReceiptSchema,
} from "../../domain/events/website-command"
import { z } from "zod"

export const websiteEventCommandSchemas = {
    WebsiteEventCommand: z.toJSONSchema(websiteEventCommandSchema),
    WebsiteEventReceipt: z.toJSONSchema(websiteEventReceiptSchema),
    WebsiteEventEditor: z.toJSONSchema(websiteEventEditorSchema),
}
const security = [{ clanApiKey: [], ssoActorToken: [] }]
const access = {
    "x-logi-read-access": null,
    "x-logi-write-access": {
        resource: "event-commands",
        gameSelection: "one-explicit-game",
        actor: "current-bound-SSO-token",
        policy: "enabled-application-game-role-allowlist",
    },
}
const game = {
    name: "game",
    in: "query",
    required: true,
    description:
        "Exactly one explicit permitted game. Repeated games, all and other query parameters are rejected.",
    schema: { type: "string", enum: ["hell_let_loose", "wardogs"] },
}
const error = {
    type: "object",
    additionalProperties: false,
    required: ["error"],
    properties: {
        error: {
            type: "object",
            additionalProperties: false,
            required: ["code"],
            properties: { code: { type: "string" } },
        },
    },
}
const failure = (description: string) => ({
    description,
    content: { "application/json": { schema: error } },
})
const failures = {
    "400": failure(
        "invalid_request: strict request, UTC timeline, ID, or body limit failed."
    ),
    "401": failure(
        "unauthorized: current service key, central session, SSO actor or exact guild/application binding failed."
    ),
    "403": failure(
        "insufficient_scope, policy_denied or membership_denied: an explicit write grant and current allowed Discord role are required."
    ),
    "404": failure("not_found: no event in this exact guild and game."),
    "409": failure(
        "revision_conflict, idempotency_conflict or invalid_state. Refresh the editor before a new intentional edit; never overwrite a conflict automatically."
    ),
    "429": {
        ...failure(
            "rate_limited: wait for Retry-After; keep the same command and idempotency key."
        ),
        headers: { "Retry-After": { schema: { type: "integer", minimum: 1 } } },
    },
    "503": failure(
        "membership_stale or unavailable. A POST may have committed before an unavailable response; preserve the exact key/body when retrying."
    ),
}
const success = (name: string, description: string) => ({
    description,
    content: {
        "application/json": {
            schema: {
                type: "object",
                additionalProperties: false,
                required: ["data"],
                properties: { data: { $ref: `#/components/schemas/${name}` } },
            },
        },
    },
})
const permission =
    "Requires a restricted service key with explicit writeAccess event-commands/game, its enabled SSO application policy and nonempty per-game Discord role allowlist, plus the current opaque SSO actor token. The actor, key, policy and observed membership (at most 60 seconds old, current guild epoch) are revalidated inside the transaction, including receipt replays. Login or a legacy key alone grants no write access."
export const websiteEventCommandPaths = {
    "/clan/event-commands": {
        post: {
            summary:
                "Create, update or cancel an event as the current SSO actor",
            tags: ["Clan API — Events"],
            security,
            ...access,
            description: `${permission} Creates native Logi events and emits normal summary invalidations. Updates use the event-summary revision and preserve native private fields. Match/training kind changes and changes after meeting start are rejected. Cancellation uses existing pre-meeting conclusion semantics: no result or attendance points. Request JSON is limited to 16 KiB; dates must satisfy registrationStart <= registrationEnd <= meetingStart <= gameStart < gameEnd. New meeting time must be in the future. Receipts are retained without a time expiry; replay uses the same application, subject, game and key. Timeouts, malformed success and server errors have unknown outcome: retain the original key and body. No Discord control fields, results, role management, passwords, publication or two-team score inference are accepted.`,
            parameters: [
                game,
                {
                    name: "Idempotency-Key",
                    in: "header",
                    required: true,
                    description:
                        "One durable key per intentional command. Retain it after unknown outcomes; identical semantic body replays the original receipt after current authorization. Changed body with that key returns 409.",
                    schema: {
                        type: "string",
                        minLength: 16,
                        maxLength: 128,
                        pattern: "^[A-Za-z0-9_-]+$",
                    },
                },
            ],
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: {
                            $ref: "#/components/schemas/WebsiteEventCommand",
                        },
                    },
                },
            },
            responses: {
                "200": success(
                    "WebsiteEventReceipt",
                    "Update or cancellation committed, or its authorized receipt replayed."
                ),
                "201": success(
                    "WebsiteEventReceipt",
                    "Native event created, or its authorized receipt replayed."
                ),
                ...failures,
            },
        },
    },
    "/clan/event-commands/{eventId}": {
        get: {
            summary:
                "Read the bounded editor and current revision for a website command",
            description: `${permission} Returns only editable native schedule fields and canEdit/canCancel. Never exposes server passwords, Discord channels, rosters or private notes.`,
            tags: ["Clan API — Events"],
            security,
            ...access,
            parameters: [
                game,
                {
                    name: "eventId",
                    in: "path",
                    required: true,
                    schema: { type: "string" },
                },
            ],
            responses: {
                "200": success(
                    "WebsiteEventEditor",
                    "Bounded event editor at its current event-summary revision."
                ),
                ...failures,
            },
        },
    },
}
