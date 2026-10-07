/**
 * OpenAPI for `GET/PATCH /clan/settings`, built from the plain settings
 * fields and every registered settings slice, so a new slice is documented
 * without editing the OpenAPI route.
 */

import {
    clanSettingsSliceJsonSchemas,
    clanSettingsSliceSchemaName,
    type AnyClanSettingsSlice,
} from "@/domain/api/settings-slices"
import {
    SETTINGS_DISCORD_FIELDS,
    SUPPORTED_SETTINGS_TIMEZONES,
} from "@/domain/api/settings-patch"
import { CLAN_SETTINGS_SLICES } from "@/domain/api/clan-settings-slices"

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })

/** Component schemas: the PATCH body, the GET data and each slice. */
export function clanSettingsOpenApiSchemas(
    slices: readonly AnyClanSettingsSlice[] = CLAN_SETTINGS_SLICES
) {
    const discordId = {
        anyOf: [{ type: "string", pattern: "^\\d+$" }, { type: "null" }],
        description: "Discord snowflake; null clears it.",
    }
    return {
        ...clanSettingsSliceJsonSchemas(slices),
        ClanSettingsPatch: {
            type: "object",
            additionalProperties: false,
            minProperties: 1,
            description:
                "Only supplied fields change. Each settings slice is patched as one object under its key.",
            properties: {
                name: { type: "string", minLength: 1 },
                avatar: { type: "string", minLength: 1 },
                description: {
                    anyOf: [{ type: "string", minLength: 1 }, { type: "null" }],
                },
                timezone: {
                    type: "string",
                    enum: [...SUPPORTED_SETTINGS_TIMEZONES],
                },
                defaultLanguage: { type: "string", enum: ["en", "cs", "de"] },
                ...Object.fromEntries(
                    SETTINGS_DISCORD_FIELDS.map((field) => [field, discordId])
                ),
                ...Object.fromEntries(
                    slices.map((slice) => [
                        slice.key,
                        ref(clanSettingsSliceSchemaName(slice.key, "patch")),
                    ])
                ),
            },
        },
        ClanSettings: {
            type: "object",
            required: ["guild", "discordConfig", "slices"],
            properties: {
                guild: {
                    type: "object",
                    description: "The clan record.",
                    additionalProperties: true,
                },
                discordConfig: {
                    anyOf: [
                        { type: "object", additionalProperties: true },
                        { type: "null" },
                    ],
                    description:
                        "The stored Discord configuration without runtime secrets or player-stat connections.",
                },
                slices: {
                    type: "object",
                    additionalProperties: false,
                    required: slices.map((slice) => slice.key),
                    description:
                        "Feature settings, one object per settings slice.",
                    properties: Object.fromEntries(
                        slices.map((slice) => [
                            slice.key,
                            ref(clanSettingsSliceSchemaName(slice.key, "read")),
                        ])
                    ),
                },
            },
        },
    }
}

const settingsResponse = {
    description: "The clan settings after the request.",
    content: {
        "application/json": {
            schema: {
                type: "object",
                required: ["data"],
                properties: { data: ref("ClanSettings") },
            },
        },
    },
}

/** The `/clan/settings` path; `responses` and `idempotency` come from the route. */
export function clanSettingsOpenApiPath(input: {
    responses: Record<string, object>
    idempotencyParameter: object
}) {
    const ok = { ...input.responses["200"], ...settingsResponse }
    return {
        get: {
            summary:
                "Get authenticated clan and Discord configuration without runtime secrets",
            tags: ["Clan API — Settings"],
            security: [{ clanApiKey: [] }],
            responses: { ...input.responses, "200": ok },
        },
        patch: {
            summary: "Patch safe clan and Discord settings",
            tags: ["Clan API — Settings"],
            description:
                'Only supplied fields change. Feature settings are patched per slice, for example `{ "<slice>": { … } }`; GET returns them under `data.slices`. Runtime secrets, player-stat connections, ticket settings, membership settings and game overrides cannot be set through this endpoint.',
            security: [{ clanApiKey: [] }],
            parameters: [input.idempotencyParameter],
            requestBody: {
                required: true,
                content: {
                    "application/json": { schema: ref("ClanSettingsPatch") },
                },
            },
            responses: {
                ...input.responses,
                "200": ok,
                "409": { description: "Idempotency conflict" },
            },
        },
    }
}
