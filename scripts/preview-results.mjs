// Loopback-only, actual handlers with synthetic data. No provider or Discord access.
import {
    invoke,
    testContext,
} from "../src/infrastructure/convex/testing/database.ts"
import { eventResultsHandlers } from "../src/lib/api/event-results-route.ts"
import * as storage from "../convex/eventResults.ts"
import tailwindcss from "@tailwindcss/postcss"
import { dirname, resolve } from "node:path"
import { readFile } from "node:fs/promises"
import { createServer } from "node:http"
import { fileURLToPath } from "node:url"
import { build } from "esbuild"
import postcss from "postcss"
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const bundle = await build({
    absWorkingDir: root,
    entryPoints: ["scripts/fixtures/results.tsx"],
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    tsconfig: "tsconfig.json",
    define: { "process.env.NODE_ENV": '"development"' },
})
const cssPath = resolve(root, "src/app/globals.css")
const css = await postcss([tailwindcss({ base: root })]).process(
    await readFile(cssPath, "utf8"),
    { from: cssPath }
)
const origin = "http://127.0.0.1:4321",
    ctx = testContext(),
    secret = (process.env.INTERNAL_AUTH_SECRET = "dev-internal-auth-secret")
ctx.db.seed("guilds", {
    _id: "guilds:a",
    discordId: "guild",
    adminIds: ["synthetic-reviewer"],
    adminAccessOverrides: {},
})
for (const [id, gameId, name] of [
    ["a", "hell_let_loose", "HLL fixture"],
    ["b", "wardogs", "Wardogs fixture"],
])
    ctx.db.seed("events", {
        _id: `events:${id}`,
        guildId: "guild",
        gameId,
        kind: "match",
        name,
        gameEnd: "2026-09-29T10:00:00Z",
    })
ctx.db.seed("users", {
    _id: "users:a",
    id: "synthetic-player",
    discordId: "222222222222222222",
})
ctx.db.seed("platformIdentityLinks", {
    _id: "platformIdentityLinks:a",
    platform: "steam",
    platformId: "76561198000000001",
    userRecordId: "users:a",
    discordUserId: "222222222222222222",
    logiUserId: "synthetic-player",
    method: "steam_openid",
    verifiedAt: 1,
    revokedAt: null,
    active: true,
})
ctx.db.seed("gameDataConnections", {
    _id: "gameDataConnections:a",
    guildId: "guild",
    gameId: "hell_let_loose",
    provider: "hll_crcon",
})
ctx.db.seed("gameSessions", {
    _id: "gameSessions:a",
    connectionId: "gameDataConnections:a",
    guildId: "guild",
    gameId: "hell_let_loose",
    externalId: "42",
    fetchedAt: Date.now(),
    updatedAt: new Date().toISOString(),
    session: {
        externalId: "42",
        startedAt: "2026-09-29T08:00:00Z",
        endedAt: "2026-09-29T10:00:00Z",
        complete: true,
        map: "Foy",
        sourceDigest: "a".repeat(64),
        participants: [
            { id: "axis", label: "Axis", score: 0 },
            { id: "allies", label: "Allies", score: null },
        ],
        players: [
            { platform: "steam", platformId: "76561198000000001", metrics: {} },
            { platform: "steam", platformId: "76561198000000002", metrics: {} },
        ],
    },
})
let failNext = false
const handlers = eventResultsHandlers({
    origin,
    authorize: async (server, eventId, gameId) =>
        server === "fixture" &&
        ((eventId === "events:a" && gameId === "hell_let_loose") ||
            (eventId === "events:b" && gameId === "wardogs"))
            ? {
                  guildId: "guild",
                  eventId,
                  gameId,
                  actorId: "synthetic-reviewer",
              }
            : null,
    read: async (scope) => {
        if (failNext) {
            failNext = false
            throw new Error("Synthetic unavailable")
        }
        return invoke(storage.get, ctx, { secret, ...scope })
    },
    write: (scope, command) =>
        invoke(storage.review, ctx, { secret, ...scope, command }),
})
const html =
    '<!doctype html><html class="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Logi results — synthetic preview</title><link rel="stylesheet" href="/preview.css"><style>:root{--font-inter:Arial,sans-serif}body{background:var(--background);color:var(--foreground)}</style></head><body><div id="root"></div><script src="/preview.js"></script></body></html>'
const server = createServer(async (request, response) => {
    try {
        const url = new URL(request.url, origin)
        const send = async (result) => {
            response.writeHead(
                result.status,
                Object.fromEntries(result.headers)
            )
            response.end(await result.text())
        }
        if (url.pathname === "/__fixture/stop" && request.method === "POST") {
            await send(Response.json({ ok: true }))
            server.close()
            return
        }
        if (url.pathname === "/__fixture/fail-next") {
            failNext = true
            return send(Response.json({ ok: true }))
        }
        if (url.pathname === "/__fixture/source-change") {
            const row = await ctx.db.get("gameSessions:a")
            await ctx.db.patch(row._id, {
                session: {
                    ...row.session,
                    sourceDigest: "b".repeat(64),
                    participants: [
                        { id: "axis", label: "Axis", score: 3 },
                        { id: "allies", label: "Allies", score: 2 },
                    ],
                },
            })
            return send(Response.json({ ok: true }))
        }
        const match = url.pathname.match(
            /^\/api\/servers\/([^/]+)\/events\/([^/]+)\/results$/
        )
        if (match) {
            let body = ""
            if (request.method === "POST")
                for await (const chunk of request) {
                    body += chunk
                    if (body.length > 16384) throw new Error("Body limit")
                }
            const web = new Request(url, {
                method: request.method,
                headers: { origin: request.headers.origin ?? "" },
                ...(body ? { body } : {}),
            })
            return send(
                await handlers[request.method === "POST" ? "post" : "get"](
                    web,
                    decodeURIComponent(match[1]),
                    decodeURIComponent(match[2])
                )
            )
        }
        response.writeHead(200, {
            "content-type": url.pathname.endsWith(".js")
                ? "text/javascript"
                : url.pathname.endsWith(".css")
                  ? "text/css"
                  : "text/html",
            "cache-control": "no-store",
        })
        response.end(
            url.pathname.endsWith(".js")
                ? bundle.outputFiles[0].contents
                : url.pathname.endsWith(".css")
                  ? css.css
                  : html
        )
    } catch {
        response.writeHead(500)
        response.end("Synthetic fixture failed")
    }
})
server.listen(4321, "127.0.0.1", () =>
    console.log("Result review preview: http://127.0.0.1:4321/?locale=cs")
)
