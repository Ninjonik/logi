// Loopback-only actual component + handlers. Synthetic Steam transport; no provider access.
import tailwindcss from "@tailwindcss/postcss"
import { dirname, resolve } from "node:path"
import { readFile } from "node:fs/promises"
import { createServer } from "node:http"
import { fileURLToPath } from "node:url"
import { createHash, randomBytes } from "node:crypto"
import { build } from "esbuild"
import postcss from "postcss"
import { platformLinksHandlers } from "../src/lib/api/platform-links-route.ts"
import { createSteamVerifier, steamRedirect } from "../src/infrastructure/steam/openid-verifier.ts"
import { invoke, testContext } from "../src/infrastructure/convex/testing/database.ts"
import * as storage from "../convex/platformIdentityLinks.ts"
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const bundle = await build({ absWorkingDir: root, entryPoints: ["scripts/fixtures/platform-links.tsx"], bundle: true, write: false, platform: "browser", format: "iife", tsconfig: "tsconfig.json", define: { "process.env.NODE_ENV": '"development"' } })
const cssPath = resolve(root, "src/app/globals.css")
const css = await postcss([tailwindcss({ base: root })]).process(await readFile(cssPath, "utf8"), { from: cssPath })
const origin = "http://127.0.0.1:4321", ctx = testContext(), secret = process.env.INTERNAL_AUTH_SECRET = "dev-internal-auth-secret"
ctx.db.seed("users", { _id: "users:preview", id: "synthetic-player", discordId: "222222222222222222", platformIds: ["76561198000000001"] })
const actor = { discordUserId: "222222222222222222", sessionHash: "a".repeat(64) }
const mutate = (name, args) => invoke(storage[name], ctx, { secret, ...args })
const handlers = platformLinksHandlers({ origin, actor: async () => actor, list: (discordUserId) => mutate("list", { discordUserId }), unlink: (discordUserId) => mutate("unlink", { discordUserId }), links: {
    now: Date.now, randomState: () => randomBytes(32).toString("base64url"), hash: (s) => createHash("sha256").update(s).digest("hex"),
    create: (args) => mutate("begin", args), claim: (args) => mutate("claim", args), complete: (args) => mutate("complete", args), fail: (args) => mutate("fail", args), redirect: steamRedirect,
    verify: createSteamVerifier(async () => new Response("ns:http://specs.openid.net/auth/2.0\nis_valid:true\n")),
} })
let failNext = false
const html = '<!doctype html><html class="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Logi Steam — synthetic preview</title><link rel="stylesheet" href="/preview.css"><style>:root{--font-inter:Arial,sans-serif}body{background:var(--background);color:var(--foreground)}</style></head><body><div id="root"></div><script src="/preview.js"></script></body></html>'
const server = createServer(async (request, response) => {
    try {
        const url = new URL(request.url, origin)
        const send = async (result) => { response.writeHead(result.status, Object.fromEntries(result.headers)); response.end(await result.text()) }
        if (url.pathname === "/__fixture/stop" && request.method === "POST") { await send(Response.json({ ok: true })); server.close(); return }
        if (url.pathname === "/__fixture/fail-next") { failNext = true; return send(Response.json({ ok: true })) }
        if (url.pathname === "/__fixture/callback") {
            const locale = url.searchParams.get("locale") ?? "en"
            const start = await handlers.start(new Request(`${origin}/api/platform-links/steam/start`, { method: "POST", headers: { origin }, body: JSON.stringify({ locale }) }))
            if (!start.ok) return send(start)
            const redirect = new URL((await start.json()).redirectUrl)
            const returnURL = redirect.searchParams.get("openid.return_to"), callback = new URL(returnURL)
            for (const [key, value] of Object.entries({ "openid.ns": "http://specs.openid.net/auth/2.0", "openid.mode": "id_res", "openid.op_endpoint": "https://steamcommunity.com/openid/login", "openid.claimed_id": "https://steamcommunity.com/openid/id/76561198000000001", "openid.identity": "https://steamcommunity.com/openid/id/76561198000000001", "openid.return_to": returnURL, "openid.response_nonce": `${new Date().toISOString().slice(0, 19)}Zsynthetic-${randomBytes(6).toString("hex")}`, "openid.assoc_handle": "1234567890", "openid.signed": "signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle", "openid.sig": "synthetic-signature" })) callback.searchParams.set(key, value)
            const result = await handlers.callback(new Request(callback))
            const linked = new URL(result.headers.get("location")).searchParams.get("steam")
            return send(new Response(null, { status: 303, headers: { Location: `/?locale=${locale}&steam=${linked}` } }))
        }
        if (url.pathname === "/api/platform-links/steam") {
            if (request.method === "DELETE") return send(await handlers.unlink(new Request(url, { method: "DELETE", headers: { origin: request.headers.origin ?? "" } })))
            if (failNext) { failNext = false; return send(Response.json({ error: "Synthetic unavailable" }, { status: 503 })) }
            return send(await handlers.status())
        }
        if (url.pathname === "/api/platform-links/steam/start") return send(Response.json({ error: "Use the synthetic callback control; real Steam navigation disabled in preview." }, { status: 503 }))
        response.writeHead(200, { "content-type": url.pathname.endsWith(".js") ? "text/javascript" : url.pathname.endsWith(".css") ? "text/css" : "text/html", "cache-control": "no-store" })
        response.end(url.pathname.endsWith(".js") ? bundle.outputFiles[0].contents : url.pathname.endsWith(".css") ? css.css : html)
    } catch { response.writeHead(500); response.end("Synthetic fixture failed") }
})
server.listen(4321, "127.0.0.1", () => console.log("Steam linking preview: http://127.0.0.1:4321/?locale=cs"))
