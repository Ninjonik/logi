// Bundles every Convex module the way the Convex CLI does before a deploy and
// fails when a module without the "use node" directive reaches a Node-only
// import (`node:crypto`, `node:fs`, …). The CLI refuses such a deploy; CI runs
// only tests and typecheck, which cannot see it. Usage: node scripts/check-convex-bundles.mjs
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

const esbuild = await import("esbuild")
const dir = "convex"
const modules = readdirSync(dir)
    .filter(
        (name) =>
            name.endsWith(".ts") &&
            !name.endsWith(".test.ts") &&
            !name.endsWith(".d.ts") &&
            name !== "schema.ts"
    )
    .map((name) => join(dir, name))
const usesNode = (file) =>
    /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use node["']/.test(
        readFileSync(file, "utf8")
    )
const v8Modules = modules.filter((file) => !usesNode(file))
const nodeModules = modules.filter(usesNode)

const result = await esbuild.build({
    entryPoints: v8Modules,
    bundle: true,
    write: false,
    outdir: "/dev/null",
    format: "esm",
    platform: "browser",
    target: "esnext",
    logLevel: "silent",
    external: ["convex", "convex/*"],
})
const errors = result.errors.map((error) => error.text)
if (errors.length) {
    console.error(
        `Convex V8 modules cannot be bundled (${errors.length} error${errors.length === 1 ? "" : "s"}); a module without "use node" reaches a Node-only import:`
    )
    for (const text of errors) console.error(`  - ${text}`)
    process.exit(1)
}
console.log(
    `Convex bundles OK: ${v8Modules.length} V8 modules, ${nodeModules.length} "use node" modules.`
)
