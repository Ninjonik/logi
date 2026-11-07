import { sharedMatchSettingsSchema } from "../validation/shared-match-settings"
import { z } from "zod"

export const sharedMatchPaths = {
    "/clan/events/{eventId}/local-settings": {
        patch: {
            tags: ["Clan API — Events"],
            summary:
                "Configure the clan's external-match delivery and signup settings",
            description:
                "Requires an unrestricted clan key and an accepted invitation. Replaces the local settings using the same validation as the dashboard. registrationStart sets this clan's registration opening and must precede the host's registration deadline. Shared match facts, results, slot allocation, locks and publication are host-controlled. Invitation acceptance and revocation require a live dashboard manager because they grant or remove another workspace's access; service keys deliberately cannot perform that lifecycle. Successful writes and idempotent replays invalidate affected dashboard views.",
            security: [{ clanApiKey: [] }],
            parameters: [
                {
                    name: "eventId",
                    in: "path",
                    required: true,
                    schema: { type: "string" },
                },
                {
                    name: "Idempotency-Key",
                    in: "header",
                    required: true,
                    schema: { type: "string" },
                },
            ],
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: z.toJSONSchema(sharedMatchSettingsSchema),
                    },
                },
            },
            responses: {
                "200": {
                    description:
                        "Local settings saved, or the original response replayed.",
                },
                "400": {
                    description:
                        "Invalid settings, inactive invitation, wrong tenant/game, or a host-controlled field.",
                },
                "401": { description: "Missing or revoked API key." },
                "403": { description: "Restricted keys cannot write." },
                "409": {
                    description:
                        "Idempotency key was already used for a different request.",
                },
                "429": { description: "Rate limit exceeded." },
            },
        },
    },
}
