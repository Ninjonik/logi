// Loopback-only actual component with synthetic API; no Convex or Discord calls.
// Run: node --import tsx scripts/preview-membership.mjs
import {
    membershipPolicyInputSchema,
    membershipPolicySettingsSchema,
} from "../src/domain/membership/policy.ts"
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
    entryPoints: ["scripts/fixtures/membership.tsx"],
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
const html = `<!doctype html><html lang="en" class="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Logi membership — synthetic preview</title><link rel="stylesheet" href="/preview.css"><style>:root{--font-inter:Arial,sans-serif}body{background:var(--background);color:var(--foreground)}</style></head><body><div id="root"></div><script src="/preview.js"></script></body></html>`
const fixtures = JSON.parse(
    await readFile(
        resolve(root, "docs/integrations/website/v0.7/fixtures.json"),
        "utf8"
    )
)
const workspaces = {
    "fixture-a": membershipPolicySettingsSchema.parse(fixtures.settings),
    "fixture-b": [],
}
const requests = []
let failNext = false
const server = createServer(async (request, response) => {
    const url = new URL(request.url, "http://127.0.0.1:4320")
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
        /^\/api\/servers\/(fixture-a|fixture-b)\/membership-integrations$/
    )
    if (!match) return send(404, { error: "Fixture not found" })
    let body = ""
    for await (const chunk of request) {
        body += chunk.toString()
        if (body.length > 16384) return send(413, { error: "Too large" })
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
        const parsed = membershipPolicyInputSchema.safeParse(input),
            entry = workspace.find(
                (value) => value.apiKeyId === input?.apiKeyId
            )
        if (!entry || !parsed.success)
            return send(400, { error: "Invalid policy" })
        entry.policy = {
            enabled: parsed.data.enabled,
            games: parsed.data.games,
            version: String(Number(entry.policy?.version ?? "0") + 1),
        }
        return send(200, { ok: true })
    }
    send(405, { error: "Unsupported method" })
})
server.listen(4320, "127.0.0.1", () =>
    console.log(
        "Synthetic membership preview: http://127.0.0.1:4320/?locale=cs"
    )
)
