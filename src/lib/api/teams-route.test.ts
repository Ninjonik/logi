import { GET as getTeamDetail } from "@/app/api/v1/clan/teams/[id]/route"
import { GET as listTeams } from "@/app/api/v1/clan/teams/route"
import { allowsApiKeyRead } from "@/domain/api/key-access"
import assert from "node:assert/strict"
import test from "node:test"

import {
    openTeamCursor,
    parseTeamCollectionQuery,
    parseTeamDetailQuery,
    parseTeamIdSegment,
    sealTeamCursor,
    teamErrorResponse,
} from "./teams-route"

const collection = (query: string) =>
    new Request(`https://logi.test/api/v1/clan/teams?${query}`)
const detail = (query: string) =>
    new Request(`https://logi.test/api/v1/clan/teams/team-1?${query}`)

test("team collection query requires exactly one directory game and bounded pagination", () => {
    assert.deepEqual(parseTeamCollectionQuery(collection("game=wardogs")), {
        gameId: "wardogs",
        cursor: null,
        limit: 50,
    })
    assert.deepEqual(
        parseTeamCollectionQuery(
            collection("game=hell_let_loose&limit=100&cursor=opaque")
        ),
        { gameId: "hell_let_loose", cursor: "opaque", limit: 100 }
    )
    for (const query of [
        "",
        "game=",
        "game=all",
        "game=hell_let_loose_vietnam",
        "game=hell_let_loose,wardogs",
        "game=wardogs&game=wardogs",
        "game=wardogs&limit=0",
        "game=wardogs&limit=101",
        "game=wardogs&limit=1e1",
        "game=wardogs&limit=10&limit=10",
        "game=wardogs&cursor=",
        "game=wardogs&cursor=a&cursor=b",
        `game=wardogs&cursor=${"x".repeat(4097)}`,
        "game=wardogs&sort=createdAt",
        "game=wardogs&search=axis",
    ])
        assert.equal(parseTeamCollectionQuery(collection(query)), null, query)
})

test("team detail query accepts only one directory game and no other parameters", () => {
    assert.deepEqual(parseTeamDetailQuery(detail("game=hell_let_loose")), {
        gameId: "hell_let_loose",
    })
    for (const query of [
        "",
        "game=all",
        "game=hell_let_loose_vietnam",
        "game=wardogs&game=hell_let_loose",
        "game=wardogs&limit=1",
        "game=wardogs&cursor=x",
    ])
        assert.equal(parseTeamDetailQuery(detail(query)), null, query)
})

test("team cursors open only for the workspace and game they were sealed for", () => {
    const binding = {
        secret: "synthetic-team-secret",
        guildId: "910000000000000001",
        gameId: "hell_let_loose" as const,
    }
    const sealed = sealTeamCursor(binding, "convex|cursor:1")
    assert.notEqual(sealed, "convex|cursor:1")
    assert.equal(openTeamCursor(binding, sealed), "convex|cursor:1")
    for (const other of [
        { ...binding, gameId: "wardogs" as const },
        { ...binding, guildId: "910000000000000002" },
        { ...binding, secret: "rotated-secret" },
    ])
        assert.equal(openTeamCursor(other, sealed), null)
    const [body, signature] = sealed.split(".")
    for (const forged of [
        "opaque",
        "",
        ".",
        `${body}.`,
        `.${signature}`,
        `${body}.${signature}.x`,
        `${Buffer.from("other").toString("base64url")}.${signature}`,
        `${body}.${"A".repeat(signature!.length)}`,
    ])
        assert.equal(openTeamCursor(binding, forged), null, forged)
})

test("team ID path segments are bounded opaque identifiers", () => {
    assert.equal(parseTeamIdSegment("kh7synthetic0team"), "kh7synthetic0team")
    assert.equal(parseTeamIdSegment("a".repeat(64)), "a".repeat(64))
    for (const id of [
        "",
        "a".repeat(65),
        "..",
        "../teams",
        "team/1",
        "team\\1",
        "team%2F1",
        "team 1",
        "team\n1",
        "team.json",
        "team?game=wardogs",
    ])
        assert.equal(parseTeamIdSegment(id), null, JSON.stringify(id))
})

test("team error envelopes stay generic and carry caller headers", async () => {
    const response = teamErrorResponse("not_found", {
        "RateLimit-Limit": "300",
        "Cache-Control": "no-store",
    })
    assert.equal(response.status, 404)
    assert.equal(response.headers.get("RateLimit-Limit"), "300")
    assert.equal(response.headers.get("Cache-Control"), "no-store")
    assert.deepEqual(await response.json(), { error: { code: "not_found" } })
    assert.equal(teamErrorResponse("insufficient_scope", {}).status, 403)
    assert.equal(teamErrorResponse("unavailable", {}).status, 503)
    assert.deepEqual(
        await teamErrorResponse("invalid_query", {}, "Explain.").json(),
        { error: { code: "invalid_query", message: "Explain." } }
    )
})

test("the teams resource is an explicit per-game grant that legacy keys never acquire", () => {
    assert.equal(allowsApiKeyRead(undefined, "teams", "wardogs"), false)
    assert.equal(allowsApiKeyRead(undefined, "teams"), false)
    assert.equal(
        allowsApiKeyRead(
            { resources: ["event-summaries"], gameIds: ["wardogs"] },
            "teams",
            "wardogs"
        ),
        false
    )
    assert.equal(
        allowsApiKeyRead(
            { resources: ["teams"], gameIds: ["hell_let_loose"] },
            "teams",
            "wardogs"
        ),
        false
    )
    assert.equal(
        allowsApiKeyRead(
            { resources: ["teams"], gameIds: ["hell_let_loose"] },
            "teams",
            "hell_let_loose"
        ),
        true
    )
})

const team = {
    id: "kh7synthetic0team0000000000001",
    gameId: "hell_let_loose",
    name: "Synthetic Armoured Division",
    shortCode: "SAD",
    logoUrl:
        "https://logi.example/api/image-assets/0123456789abcdef0123456789abcdef.png",
    description: "Synthetic armoured community.",
    links: ["https://example.org/synthetic-armoured-division"],
    revision: 3,
    updatedAt: "2026-10-03T10:00:00.000Z",
}
/** The DTO of a backend that predates description and links. */
const previousDto = Object.fromEntries(
    Object.entries(team).filter(
        ([key]) => key !== "description" && key !== "links"
    )
)
/** A team that a global administrator merged into `team`: Convex reads it as absent. */
const MERGED_TEAM_ID = "kh7synthetic0team0000000000002"

test("team HTTP routes map Convex grant, record and failure outcomes to generic envelopes", async (t) => {
    const previous = {
        url: process.env.NEXT_PUBLIC_CONVEX_URL,
        secret: process.env.INTERNAL_AUTH_SECRET,
    }
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://offline-test.convex.cloud"
    process.env.INTERNAL_AUTH_SECRET = "synthetic-team-secret"
    t.after(() => {
        if (previous.url === undefined)
            delete process.env.NEXT_PUBLIC_CONVEX_URL
        else process.env.NEXT_PUBLIC_CONVEX_URL = previous.url
        if (previous.secret === undefined)
            delete process.env.INTERNAL_AUTH_SECRET
        else process.env.INTERNAL_AUTH_SECRET = previous.secret
    })
    let legacy = false,
        granted = true,
        failing = false,
        paged = false,
        stale = false,
        grantedGames = ["hell_let_loose"]
    const calls: Array<{ path: string; args: Record<string, unknown> }> = []
    t.mock.method(
        globalThis,
        "fetch",
        async (_url: unknown, init?: RequestInit) => {
            const request = JSON.parse(String(init?.body)) as {
                path: string
                args: Array<Record<string, unknown>>
            }
            const args = request.args[0]!
            let value: unknown
            if (request.path === "publicApi:checkRateLimit")
                value = { allowed: true, remaining: 299, resetAt: 0 }
            else if (request.path === "apiKeyAuth:authenticateKey")
                value = {
                    guildId: "910000000000000001",
                    ...(legacy
                        ? {}
                        : {
                              readAccess: {
                                  resources: ["teams"],
                                  gameIds: grantedGames,
                              },
                          }),
                }
            else if (request.path === "teamReads:list") {
                calls.push({ path: request.path, args })
                if (failing)
                    return Response.json({
                        status: "error",
                        errorMessage: "offline",
                    })
                value = granted
                    ? {
                          items: args.cursor ? [] : [team],
                          nextCursor:
                              paged && !args.cursor ? "convex|page:2" : null,
                      }
                    : null
            } else if (request.path === "teamReads:get") {
                calls.push({ path: request.path, args })
                value = granted
                    ? {
                          team:
                              args.id === team.id
                                  ? stale
                                      ? previousDto
                                      : team
                                  : null,
                      }
                    : null
            } else throw new Error(`Unexpected offline call ${request.path}`)
            return Response.json({ status: "success", value })
        }
    )
    const list = (query: string) =>
        listTeams(
            new Request(`https://logi.test/api/v1/clan/teams?${query}`, {
                headers: { Authorization: "Bearer synthetic-reader" },
            })
        )
    const get = (id: string, query: string) =>
        getTeamDetail(
            new Request(
                `https://logi.test/api/v1/clan/teams/${encodeURIComponent(id)}?${query}`,
                { headers: { Authorization: "Bearer synthetic-reader" } }
            ),
            { params: Promise.resolve({ id }) }
        )

    const page = await list("game=hell_let_loose&limit=10")
    assert.equal(page.status, 200)
    assert.equal(page.headers.get("cache-control"), "no-store")
    assert.equal(page.headers.get("ratelimit-remaining"), "299")
    assert.deepEqual(await page.json(), {
        data: { items: [team], nextCursor: null },
    })
    assert.deepEqual(calls.at(-1), {
        path: "teamReads:list",
        args: {
            secret: "synthetic-team-secret",
            keyHash: calls.at(-1)!.args.keyHash,
            guildId: "910000000000000001",
            gameId: "hell_let_loose",
            cursor: null,
            limit: 10,
        },
    })
    assert.notEqual(calls.at(-1)!.args.keyHash, "synthetic-reader")

    const record = await get(team.id, "game=hell_let_loose")
    assert.equal(record.status, 200)
    assert.deepEqual(await record.json(), { data: team })
    assert.equal(calls.at(-1)!.args.id, team.id)

    // Unknown, archived, merged and other-game catalogue IDs are all absent.
    for (const id of ["kh7unknownteam00000000000001", MERGED_TEAM_ID]) {
        const missing = await get(id, "game=hell_let_loose")
        assert.equal(missing.status, 404, id)
        assert.deepEqual(await missing.json(), {
            error: { code: "not_found" },
        })
    }

    // The global catalogue DTO is closed: an incomplete backend answer is never relayed.
    stale = true
    const incomplete = await get(team.id, "game=hell_let_loose")
    assert.equal(incomplete.status, 503)
    assert.deepEqual(await incomplete.json(), {
        error: { code: "unavailable" },
    })
    stale = false

    const reads = calls.length
    // The gateway refuses collection game selections the key cannot satisfy
    // before the route parser runs: these are 403, never 400.
    for (const [response, label] of [
        [await list("game=wardogs"), "ungranted game at the gateway"],
        [await list(""), "missing game at the gateway"],
        [await list("game="), "empty game at the gateway"],
        [await list("game=all"), "game=all at the gateway"],
        [
            await list("game=all,hell_let_loose"),
            "all with a game at the gateway",
        ],
        [await list("game=unknown"), "unknown game at the gateway"],
        [
            await list("game=hell_let_loose,wardogs"),
            "combination with an ungranted game at the gateway",
        ],
    ] as const) {
        assert.equal(response.status, 403, label)
        assert.equal((await response.json()).error.code, "insufficient_scope")
    }
    for (const [response, label] of [
        [await list("game=hell_let_loose&limit=101"), "limit above 100"],
        [await list("game=hell_let_loose&sort=createdAt"), "unknown parameter"],
        [
            await list("game=hell_let_loose&game=hell_let_loose"),
            "repeated granted game",
        ],
        [await get(team.id, ""), "detail without game"],
        [await get(team.id, "game=all"), "detail with game=all"],
        [await get(team.id, "game=hell_let_loose&limit=1"), "detail extras"],
        [await get("../teams", "game=hell_let_loose"), "traversal segment"],
        [await get("a".repeat(65), "game=hell_let_loose"), "oversized segment"],
    ] as const) {
        assert.equal(response.status, 400, label)
        assert.equal((await response.json()).error.code, "invalid_query")
        assert.equal(response.headers.get("cache-control"), "no-store")
    }
    assert.equal(calls.length, reads, "invalid input never reaches Convex")

    // Selections every game of which the key grants pass the gateway and are
    // then rejected by the route parser as 400 invalid_query.
    grantedGames = ["hell_let_loose", "wardogs", "hell_let_loose_vietnam"]
    for (const [response, label] of [
        [await list("game=hell_let_loose,wardogs"), "granted combination"],
        [
            await list("game=hell_let_loose_vietnam"),
            "granted game without a directory",
        ],
    ] as const) {
        assert.equal(response.status, 400, label)
        assert.equal((await response.json()).error.code, "invalid_query")
    }
    assert.equal(calls.length, reads, "parser rejections never reach Convex")
    grantedGames = ["hell_let_loose"]

    // The gateway cannot know a detail record's game; Convex rechecks the grant.
    granted = false
    for (const response of [
        await list("game=hell_let_loose"),
        await get(team.id, "game=hell_let_loose"),
    ]) {
        assert.equal(response.status, 403)
        assert.deepEqual(await response.json(), {
            error: { code: "insufficient_scope" },
        })
    }
    granted = true

    // Legacy unrestricted keys pass the generic gateway branch and are denied in Convex.
    legacy = true
    granted = false
    assert.equal((await list("game=hell_let_loose")).status, 403)
    assert.equal(calls.at(-1)?.path, "teamReads:list")
    legacy = false
    granted = true

    // Next pages travel as sealed cursors bound to the workspace and game.
    paged = true
    grantedGames = ["hell_let_loose", "wardogs"]
    const first = (await (await list("game=hell_let_loose")).json()) as {
        data: { nextCursor: string }
    }
    assert.notEqual(first.data.nextCursor, "convex|page:2")
    const cursor = encodeURIComponent(first.data.nextCursor)
    const second = await list(`game=hell_let_loose&cursor=${cursor}`)
    assert.equal(second.status, 200)
    assert.equal(calls.at(-1)!.args.cursor, "convex|page:2")
    assert.deepEqual(await second.json(), {
        data: { items: [], nextCursor: null },
    })
    const sealedReads = calls.length
    for (const [response, label] of [
        [await list(`game=wardogs&cursor=${cursor}`), "cursor of another game"],
        [await list("game=hell_let_loose&cursor=opaque"), "forged cursor"],
        [
            await list("game=hell_let_loose&cursor=convex%7Cpage%3A2"),
            "raw Convex cursor",
        ],
    ] as const) {
        assert.equal(response.status, 400, label)
        assert.equal((await response.json()).error.code, "invalid_query")
    }
    assert.equal(calls.length, sealedReads, "bad cursors never reach Convex")
    paged = false
    grantedGames = ["hell_let_loose"]

    failing = true
    const unavailable = await list("game=hell_let_loose")
    assert.equal(unavailable.status, 503)
    assert.deepEqual(await unavailable.json(), {
        error: { code: "unavailable" },
    })
    assert.equal(unavailable.headers.get("cache-control"), "no-store")
})
