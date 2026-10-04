// Loopback-only real component with synthetic API; no credentials or provider access.
import { memberRoleOperationsSchema } from "../src/domain/membership/role-operations.ts"
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
    entryPoints: ["scripts/fixtures/managed-roles.tsx"],
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
const allFixtures = memberRoleOperationsSchema.parse(
    JSON.parse(
        await readFile(
            resolve(root, "docs/integrations/website/v0.8/fixtures.json"),
            "utf8"
        )
    )
)
const fixtures = process.argv.includes("--recovery")
    ? allFixtures.filter((row) =>
          ["synthetic-applied", "synthetic-superseded"].includes(row.id)
      )
    : allFixtures
const html =
    '<!doctype html><html class="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Logi roles — synthetic preview</title><link rel="stylesheet" href="/preview.css"><style>:root{--font-inter:Arial,sans-serif}body{background:var(--background);color:var(--foreground)}</style></head><body><div id="root"></div><script src="/preview.js"></script></body></html>'
let failNext = false
const server = createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1:4321")
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
        /^\/api\/servers\/(fixture-a|fixture-b)\/member-role-operations$/
    )
    if (!match || request.method !== "GET")
        return send(404, { error: "Fixture not found" })
    if (failNext) {
        failNext = false
        return send(503, { error: "Synthetic failure" })
    }
    send(200, match[1] === "fixture-a" ? fixtures : [])
})
server.listen(4321, "127.0.0.1", () =>
    console.log(
        "Synthetic managed roles preview: http://127.0.0.1:4321/?locale=cs"
    )
)
