import {
    historyPageSchema,
    historyRecordSchema,
} from "@/domain/game-data/history"
import { z } from "zod"

export const historyResponseSchemas = {
    ServerGameHistory: z.toJSONSchema(historyRecordSchema),
    ServerGameHistoryPage: z.toJSONSchema(historyPageSchema),
}
export const historyReadPaths = {
    "/clan/server-game-history": {
        get: {
            tags: ["Clan API — Game data"],
            operationId: "readServerGameHistory",
            summary: "Read retained completed Warcon games",
            description:
                "Explicit server-game-history + wardogs read grants required; legacy keys denied. Returns retained source facts even if collection is disabled. Includes provider player names and platform IDs, not verified Logi identities or clan results. Completed games only; coverage begins at the oldest successfully imported provider record. Filters use the game end time, from inclusive and until exclusive. At most 20 scanned games per page; an empty page can have a continuation. Consume all pages at one revision before publishing rankings. On 410 discard the partial scan and restart. Read id alone for one record. Capture a changes cursor before bootstrap, then reconcile server-game-history changes through sync-records. Always no-store.",
            "x-logi-read-access": {
                resource: "server-game-history",
                games: ["wardogs"],
                explicitGrantRequired: true,
            },
            parameters: [
                {
                    name: "game",
                    in: "query",
                    required: true,
                    schema: { type: "string", enum: ["wardogs"] },
                },
                ...["id", "cursor", "sourceId", "map", "from", "until"].map(
                    (name) => ({
                        name,
                        in: "query",
                        schema: {
                            type: "string",
                            ...(name === "from" || name === "until"
                                ? { format: "date-time" }
                                : {}),
                        },
                    })
                ),
            ],
            responses: {
                "200": {
                    description:
                        "One retained game or a revision-consistent page",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["data"],
                                properties: {
                                    data: {
                                        oneOf: [
                                            {
                                                $ref: "#/components/schemas/ServerGameHistory",
                                            },
                                            {
                                                $ref: "#/components/schemas/ServerGameHistoryPage",
                                            },
                                        ],
                                    },
                                },
                            },
                        },
                    },
                },
                ...Object.fromEntries(
                    [400, 401, 403, 404, 410, 429, 503].map((status) => [
                        String(status),
                        {
                            description:
                                status === 410
                                    ? "reset_required: history changed during pagination"
                                    : `Request rejected or unavailable (${status})`,
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["error"],
                                        properties: {
                                            error: {
                                                type: "object",
                                                required: ["code"],
                                                properties: {
                                                    code: { type: "string" },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    ])
                ),
            },
        },
    },
}
