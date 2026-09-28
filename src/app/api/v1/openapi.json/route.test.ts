import assert from "node:assert/strict"
import test from "node:test"

import { GET } from "./route"

test("OpenAPI exposes read-only summary routes with closed minimal response schemas", async () => {
    const document = await (await GET()).json()
    for (const [resource, schemaName, field] of [
        ["server-snapshots", "ClanServerSnapshotsDocument", "freshness"],
        [
            "integration-health",
            "ClanIntegrationHealthDocument",
            "lastSuccessAt",
        ],
        ["event-summaries", "ClanEventSummariesDocument", "startsAt"],
        ["match-summaries", "ClanMatchSummariesDocument", "resultState"],
    ]) {
        const operations = document.paths[`/clan/${resource}`]
        assert.ok(operations?.get, `${resource} list is documented`)
        assert.deepEqual(Object.keys(operations), ["get"])
        assert.ok(
            operations.get.parameters.some(
                (parameter: { name: string }) => parameter.name === "game"
            )
        )
        assert.equal(
            operations.get.responses["200"].content["application/json"].schema
                .properties.data.items.$ref,
            `#/components/schemas/${schemaName}`
        )
        const schema = document.components.schemas[schemaName]
        assert.ok(schema.properties[field])
        assert.equal(schema.additionalProperties, false)
        for (const excluded of [
            "notes",
            "serverPassword",
            "participants",
            "signUps",
            "raw",
            "sourceUrl",
        ])
            assert.equal(excluded in schema.properties, false)
    }
    assert.ok(document.paths["/clan/match-summaries/{eventId}"]?.get)
    assert.ok(document.paths["/clan/event-summaries/{id}"]?.get)
})

test("every clan operation documents runtime scope denial and its read-access resource", async () => {
    const document = await (await GET()).json()
    for (const [path, operations] of Object.entries(document.paths)) {
        if (!path.startsWith("/clan/")) continue
        for (const [method, operation] of Object.entries(
            operations as Record<
                string,
                {
                    responses: Record<string, unknown>
                    "x-logi-read-access"?: unknown
                }
            >
        )) {
            assert.ok(
                operation.responses["403"],
                `${method} ${path} must document insufficient_scope`
            )
            const resource = path.split("/")[2]
            if (resource === "membership-summaries") {
                assert.deepEqual(operation["x-logi-read-access"], {
                    resource,
                    gameSelection: "one-explicit-game",
                    policy: "enabled-per-key-role-allowlist",
                    subject: "exact-discord-user-id",
                })
                continue
            }
            if (["changes", "sync-records"].includes(resource)) {
                assert.deepEqual(operation["x-logi-read-access"], {
                    resources: "underlying-explicit-grants",
                    gameSelection: "one-explicit-game",
                })
                continue
            }
            const allowed =
                method === "get" &&
                [
                    "server-snapshots",
                    "integration-health",
                    "events",
                    "groups",
                    "rosters",
                    "assignments",
                    "stratmaps",
                    "matches",
                    "event-summaries",
                    "match-summaries",
                ].includes(resource)
            assert.deepEqual(
                operation["x-logi-read-access"],
                allowed
                    ? {
                          resource,
                          gameSelection: path.includes("{")
                              ? "persisted-record"
                              : "explicit-permitted-games",
                      }
                    : null,
                `${method} ${path}`
            )
        }
    }
})
test("membership OpenAPI exposes only exact-subject reads and required policy/freshness rules", async () => {
    const document = await (await GET()).json()
    assert.equal(document.paths["/clan/membership-summaries"], undefined)
    const operation =
        document.paths["/clan/membership-summaries/{discordUserId}"]?.get
    assert.ok(operation)
    assert.ok(
        operation.parameters.some(
            (value: { name: string; required?: boolean }) =>
                value.name === "game" && value.required
        )
    )
    assert.ok(
        operation.parameters.some(
            (value: { name: string; schema: { maximum?: number } }) =>
                value.name === "maxAgeMs" && value.schema.maximum === 300000
        )
    )
    assert.ok(document.components.schemas.MembershipObservation)
    assert.ok(
        document.paths["/clan/changes"].get.parameters.some(
            (value: { name: string }) => value.name === "subject"
        )
    )
})

test("OpenAPI advertises every implemented clan write endpoint", async () => {
    const response = await GET()
    const document = (await response.json()) as {
        paths: Record<string, Record<string, unknown>>
    }

    assert.ok(document.paths["/clan/articles"]?.post)
    assert.ok(document.paths["/clan/articles/{id}"]?.patch)
    assert.ok(document.paths["/clan/articles/{id}"]?.delete)
    assert.ok(document.paths["/clan/events/{eventId}/signup"]?.post)
    assert.ok(document.paths["/clan/events"]?.post)
    assert.ok(document.paths["/clan/events/{id}"]?.patch)
    assert.ok(document.paths["/clan/events/{eventId}/actions/conclude"]?.post)
    assert.ok(document.paths["/clan/groups"]?.post)
    assert.ok(document.paths["/clan/groups/{id}"]?.patch)
    assert.ok(document.paths["/clan/groups/{id}"]?.delete)
    assert.ok(document.paths["/clan/calendar-items"]?.post)
    assert.ok(document.paths["/clan/calendar-items/{id}"]?.patch)
    assert.ok(document.paths["/clan/calendar-items/{id}"]?.delete)
    assert.ok(document.paths["/clan/settings"]?.patch)
    assert.ok(document.paths["/clan/assignments"]?.post)
    assert.ok(document.paths["/clan/assignments/{id}"]?.patch)
    assert.ok(document.paths["/clan/assignments/{id}"]?.delete)
    assert.ok(document.paths["/clan/rosters/{id}"]?.patch)
    assert.ok(document.paths["/clan/rosters/{id}"]?.delete)
    assert.ok(document.paths["/clan/stratmaps"]?.post)
    assert.ok(document.paths["/clan/stratmaps/{id}"]?.patch)
    assert.ok(document.paths["/clan/topic-presets"]?.post)
    assert.ok(document.paths["/clan/topic-presets/{id}"]?.patch)
    assert.ok(document.paths["/clan/squad-presets"]?.post)
    assert.ok(document.paths["/clan/squad-presets/{id}"]?.patch)
})

test("OpenAPI requires idempotency for clan writes", async () => {
    const document = (await (await GET()).json()) as {
        paths: Record<
            string,
            Record<string, { parameters?: Array<{ name?: string }> }>
        >
    }
    const paths = [
        ["/clan/articles", "post"],
        ["/clan/articles/{id}", "patch"],
        ["/clan/articles/{id}", "delete"],
        ["/clan/events/{eventId}/signup", "post"],
        ["/clan/events", "post"],
        ["/clan/events/{id}", "patch"],
        ["/clan/events/{eventId}/actions/conclude", "post"],
        ["/clan/groups", "post"],
        ["/clan/groups/{id}", "patch"],
        ["/clan/groups/{id}", "delete"],
        ["/clan/calendar-items", "post"],
        ["/clan/calendar-items/{id}", "patch"],
        ["/clan/calendar-items/{id}", "delete"],
        ["/clan/settings", "patch"],
        ["/clan/assignments", "post"],
        ["/clan/assignments/{id}", "patch"],
        ["/clan/assignments/{id}", "delete"],
        ["/clan/rosters/{id}", "patch"],
        ["/clan/rosters/{id}", "delete"],
        ["/clan/stratmaps", "post"],
        ["/clan/stratmaps/{id}", "patch"],
        ["/clan/topic-presets", "post"],
        ["/clan/topic-presets/{id}", "patch"],
        ["/clan/squad-presets", "post"],
        ["/clan/squad-presets/{id}", "patch"],
    ] as const
    for (const [path, method] of paths)
        assert.ok(
            document.paths[path]?.[method]?.parameters?.some(
                (parameter) => parameter.name === "Idempotency-Key"
            )
        )
})

test("OpenAPI documents beginner-safe API workflows", async () => {
    const document = (await (await GET()).json()) as {
        info: { description: string }
        components: {
            securitySchemes: Record<string, { description?: string }>
        }
        paths: Record<
            string,
            Record<
                string,
                {
                    parameters?: Array<{
                        name?: string
                        description?: string
                    }>
                }
            >
        >
    }

    assert.match(
        document.info.description,
        /Authorization: Bearer YOUR_API_KEY/
    )
    assert.match(document.info.description, /page\.nextCursor/)
    assert.match(document.info.description, /updatedSince/)
    assert.match(document.info.description, /409 idempotency_conflict/)
    assert.match(document.info.description, /X-Logi-Signature/)
    assert.match(
        document.info.description,
        /deletion is intentionally unsupported/
    )
    assert.match(
        document.components.securitySchemes.clanApiKey?.description ?? "",
        /scoped to one clan/
    )

    const eventList = document.paths["/clan/events"]?.get
    assert.match(
        eventList?.parameters?.find((parameter) => parameter.name === "cursor")
            ?.description ?? "",
        /Opaque/
    )
    assert.match(
        eventList?.parameters?.find((parameter) => parameter.name === "game")
            ?.description ?? "",
        /Game scope/
    )
})

test("OpenAPI groups operations by their clan resource", async () => {
    const document = (await (await GET()).json()) as {
        tags: Array<{ name: string }>
        paths: Record<string, Record<string, { tags?: string[] }>>
    }

    assert.deepEqual(
        document.tags.map((tag) => tag.name),
        [
            "Public API — no key required",
            "Clan API — Overview",
            "Clan API — Settings",
            "Clan API — Articles",
            "Clan API — Events",
            "Clan API — Groups",
            "Clan API — Calendar",
            "Clan API — Rosters",
            "Clan API — Assignments",
            "Clan API — Stratmaps",
            "Clan API — Topic presets",
            "Clan API — Squad presets",
            "Clan API — Matches",
            "Clan API — Users",
        ]
    )
    assert.deepEqual(document.paths["/public/matches"]?.get?.tags, [
        "Public API — no key required",
    ])
    assert.deepEqual(document.paths["/clan/articles"]?.post?.tags, [
        "Clan API — Articles",
    ])
    assert.deepEqual(document.paths["/clan/events/{id}"]?.patch?.tags, [
        "Clan API — Events",
    ])
    assert.deepEqual(document.paths["/clan/rosters/{id}"]?.delete?.tags, [
        "Clan API — Rosters",
    ])
    assert.deepEqual(document.paths["/clan/settings"]?.patch?.tags, [
        "Clan API — Settings",
    ])
})

test("OpenAPI derives concrete Convex-backed success bodies", async () => {
    const document = (await (await GET()).json()) as {
        components: {
            schemas: Record<
                string,
                {
                    properties?: Record<string, unknown>
                    example?: Record<string, unknown>
                }
            >
        }
        paths: Record<
            string,
            Record<
                string,
                {
                    responses?: Record<
                        string,
                        {
                            content?: {
                                "application/json"?: {
                                    schema?: Record<string, unknown>
                                }
                            }
                        }
                    >
                }
            >
        >
    }

    const event = document.components.schemas.ClanEventsDocument
    assert.ok(event?.properties?.participants)
    assert.ok(event?.properties?.signUps)
    assert.equal(event?.example?.id, "string")

    const listSchema =
        document.paths["/clan/events"]?.get?.responses?.["200"]?.content?.[
            "application/json"
        ]?.schema
    assert.deepEqual(
        (
            listSchema?.properties as Record<
                string,
                { items?: { $ref?: string } }
            >
        ).data?.items?.$ref,
        "#/components/schemas/ClanEventsDocument"
    )
    const createSchema =
        document.paths["/clan/events"]?.post?.responses?.["201"]?.content?.[
            "application/json"
        ]?.schema
    assert.deepEqual(
        (createSchema?.properties as Record<string, { $ref?: string }>).data
            ?.$ref,
        "#/components/schemas/ClanEventsDocument"
    )
})
