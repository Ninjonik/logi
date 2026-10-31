// Type inventory only. Does not contact, configure or deploy a Convex backend.
// Target acceptance must still run the normal deployment-aware Convex generator.
import {
    importPath,
    moduleIdentifier,
} from "../node_modules/convex/dist/esm/cli/codegen_templates/api.js"
import {
    apiComment,
    header,
} from "../node_modules/convex/dist/esm/cli/codegen_templates/common.js"
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
// Match Convex's dynamic component API declarations, used by deployment codegen.
// The legacy apiCodegen template has different import ordering and API comments.
const generated = `
${header("Generated `api` utility.")}
${modules.map((name) => `import type * as ${moduleIdentifier(name)} from "../${importPath(name)}.js";`).join("\n")}

import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";

declare const fullApi: ApiFromModules<{
${modules.map((name) => `"${importPath(name)}": typeof ${moduleIdentifier(name)},`).join("\n")}
}>;
${apiComment("api", "public")}
export declare const api: FilterApi<typeof fullApi, FunctionReference<any, "public">>;
${apiComment("internal", "internal")}
export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">>;

${components[0]}
`
await writeFile(
    path,
    await format(generated, { parser: "typescript", semi: true, tabWidth: 2 })
)
console.log(
    `Regenerated Convex API type inventory for ${modules.length} modules; no backend contacted.`
)
