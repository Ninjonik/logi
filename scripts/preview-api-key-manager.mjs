// Local, in-memory UI evidence only. This does not start Logi, Convex or Discord.
// Run: node --import tsx scripts/preview-api-key-manager.mjs
import { isApiKeyReadAccess } from "../src/domain/api/key-access.ts"
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
    entryPoints: ["scripts/fixtures/api-key-manager.tsx"],
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
const html = `<!doctype html><html lang="en" class="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Logi API keys — synthetic component preview</title><link rel="stylesheet" href="/preview.css"><style>:root{--font-inter:Arial,sans-serif}body{background:var(--background);color:var(--foreground)}</style></head><body><div id="root"></div><script src="/preview.js"></script></body></html>`
const baseKey = {
    keyPrefix: "fixture_only",
    createdAt: "2026-09-28T12:00:00.000Z",
}
const keys = {
    "fixture-a": [
        { ...baseKey, id: "fixture-legacy", name: "Legacy integration" },
        {
            ...baseKey,
            id: "fixture-reader",
            name: "Wardogs website",
            readAccess: {
                resources: ["event-summaries", "match-summaries"],
                gameIds: ["wardogs"],
            },
        },
        {
            ...baseKey,
            id: "fixture-revoked",
            name: "Retired HLL reader",
            revokedAt: "2026-09-28T13:00:00.000Z",
            readAccess: { resources: ["events"], gameIds: ["hell_let_loose"] },
        },
    ],
    "fixture-b": [
        {
            ...baseKey,
            id: "fixture-other",
            name: "Workspace B reader",
            readAccess: {
                resources: ["event-summaries"],
                gameIds: ["hell_let_loose"],
            },
        },
    ],
}
const requests = []
let sequence = 0
let failNext = false

const server = createServer(async (request, response) => {
    const url = new URL(request.url, "http://127.0.0.1:4318")
    const send = (status, value) => {
        response.writeHead(status, {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
        })
        response.end(JSON.stringify(value))
    }
    if (url.pathname === "/__fixture/stop" && request.method === "POST") {
        send(200, { ok: true })
        server.close()
        return
    }
    if (url.pathname === "/__fixture/requests") return send(200, requests)
    if (url.pathname === "/__fixture/fail-next" && request.method === "POST") {
        failNext = true
        return send(200, { ok: true })
    }
    if (["/", "/preview.js", "/preview.css"].includes(url.pathname)) {
        const type =
            url.pathname === "/"
                ? "text/html"
                : url.pathname.endsWith(".js")
                  ? "text/javascript"
                  : "text/css"
        response.writeHead(200, {
            "Content-Type": type,
            "Cache-Control": "no-store",
        })
        response.end(
            url.pathname === "/"
                ? html
                : url.pathname.endsWith(".js")
                  ? bundle.outputFiles[0].contents
                  : css.css
        )
        return
    }
    const match = url.pathname.match(
        /^\/api\/servers\/(fixture-a|fixture-b)\/api-keys$/
    )
    if (!match) return send(404, { error: "Fixture route not found" })
    const workspace = keys[match[1]]
    let body = ""
    for await (const chunk of request) {
        body += chunk.toString()
        if (body.length > 8192)
            return send(413, { error: "Fixture request too large" })
    }
    let payload
    try {
        payload = body ? JSON.parse(body) : undefined
    } catch {
        return send(400, { error: "Invalid JSON" })
    }
    requests.push({ method: request.method, path: request.url, body: payload })
    if (failNext) {
        failNext = false
        return send(503, { error: "Synthetic failure" })
    }
    if (request.method === "GET") return send(200, { keys: workspace })
    if (request.method === "POST") {
        if (
            !payload ||
            typeof payload.name !== "string" ||
            !payload.name.trim() ||
            payload.name.trim().length > 80 ||
            (payload.readAccess !== undefined &&
                !isApiKeyReadAccess(payload.readAccess))
        )
            return send(400, { error: "Invalid fixture key" })
        const id = `fixture-created-${++sequence}`
        workspace.push({
            ...baseKey,
            id,
            name: payload.name.trim(),
            ...(payload.readAccess === undefined
                ? {}
                : { readAccess: payload.readAccess }),
        })
        return send(201, { key: `SYNTHETIC_KEY_${sequence}_NOT_VALID` })
    }
    if (request.method === "DELETE") {
        const key = workspace.find(
            (value) => value.id === url.searchParams.get("keyId")
        )
        if (!key) return send(404, { error: "Fixture key not found" })
        key.revokedAt = new Date().toISOString()
        return send(200, { ok: true })
    }
    send(405, { error: "Unsupported fixture method" })
})
server.listen(4318, "127.0.0.1", () =>
    console.log("Synthetic API key preview: http://127.0.0.1:4318/?locale=cs")
)
