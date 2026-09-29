// Type inventory only. Does not contact, configure or deploy a Convex backend.
// Target acceptance must still run the normal deployment-aware Convex generator.
import { apiCodegen } from "../node_modules/convex/dist/esm/cli/codegen_templates/api.js"
import { readFile, readdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { format } from "prettier"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const modules = (await readdir(resolve(root, "convex")))
    .filter(
        (name) =>
            name.endsWith(".ts") &&
            !name.endsWith(".test.ts") &&
            !["schema.ts", "convex.config.ts"].includes(name)
    )
    .sort()
const path = resolve(root, "convex/_generated/api.d.ts")
const existing = await readFile(path, "utf8")
const components = existing.match(/export declare const components: \{\};/)
if (!components)
    throw new Error(
        "Unexpected components declaration; run target Convex codegen"
    )
const generated = apiCodegen(modules).DTS + "\n" + components[0] + "\n"
await writeFile(
    path,
    await format(generated, { parser: "typescript", semi: true, tabWidth: 2 })
)
console.log(
    `Regenerated Convex API type inventory for ${modules.length} modules; no backend contacted.`
)
