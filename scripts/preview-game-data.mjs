// Actual component; loopback-only, synthetic data, no Convex/Discord/provider calls.
// Run: node --import tsx scripts/preview-game-data.mjs
import { gameDataSettingsSchema } from "../src/domain/game-data/contracts.ts"
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
    entryPoints: ["scripts/fixtures/game-data.tsx"],
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
const html = `<!doctype html><html lang="en" class="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Logi game data — synthetic preview</title><link rel="stylesheet" href="/preview.css"><style>:root{--font-inter:Arial,sans-serif}body{background:var(--background);color:var(--foreground)}</style></head><body><div id="root"></div><script src="/preview.js"></script></body></html>`
const fixtures = JSON.parse(
    await readFile(
        resolve(root, "docs/integrations/website/v0.5/fixtures.json"),
        "utf8"
    )
)
const workspaces = {
    "fixture-a": gameDataSettingsSchema.parse(fixtures.settings),
    "fixture-b": { sources: [], connections: [] },
}
const requests = []
let failNext = false
const server = createServer(async (request, response) => {
    const url = new URL(request.url, "http://127.0.0.1:4319")
    const send = (status, value) => {
        response.writeHead(status, {
            "content-type": "application/json",
            "cache-control": "no-store",
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
        response.writeHead(200, {
            "content-type":
                url.pathname === "/"
                    ? "text/html"
                    : url.pathname.endsWith(".js")
                      ? "text/javascript"
                      : "text/css",
            "cache-control": "no-store",
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
        /^\/api\/servers\/(fixture-a|fixture-b)\/game-data$/
    )
    if (!match) return send(404, { error: "Fixture not found" })
    let body = ""
    for await (const chunk of request) {
        body += chunk.toString()
        if (body.length > 2048) return send(413, { error: "Too large" })
    }
    let input
    try {
        input = body ? JSON.parse(body) : undefined
    } catch {
        return send(400, { error: "Invalid JSON" })
    }
    requests.push({ method: request.method, path: request.url, body: input })
    if (failNext) {
        failNext = false
        return send(503, { error: "Synthetic failure" })
    }
    const workspace = workspaces[match[1]]
    if (request.method === "GET") return send(200, workspace)
    if (request.method === "POST") {
        const entry = workspace.connections.find(
            (value) => value.sourceRef === input?.sourceRef
        )
        if (!entry || typeof input.enabled !== "boolean")
            return send(400, { error: "Invalid source" })
        entry.health.enabled = input.enabled
        entry.health.nextAttemptAt = input.enabled
            ? "2026-09-28T12:01:00.000Z"
            : null
        entry.health.errorCategory = null
        entry.health.historyErrorCategory = null
        return send(200, { ok: true })
    }
    send(405, { error: "Unsupported method" })
})
server.listen(4319, "127.0.0.1", () =>
    console.log("Synthetic game data preview: http://127.0.0.1:4319/?locale=cs")
)
