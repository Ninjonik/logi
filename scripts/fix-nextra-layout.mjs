// Works around nextra-theme-docs#Layout validating props with
// LayoutPropsSchema.safeParse(themeConfig) after destructuring `children`
// out. `children: reactNode` is required by the schema, so zod >= 4 rejects
// the missing key ("expected nonoptional, received undefined → at children")
// and every /wiki/* prerender throws. Re-inject children before validation.
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const file = require.resolve("nextra-theme-docs/dist/layout.js");
const src = readFileSync(file, "utf8");

const from = "LayoutPropsSchema.safeParse(themeConfig)";
const to = "LayoutPropsSchema.safeParse({ ...themeConfig, children })";

if (src.includes(to)) {
    console.log("[fix-nextra-layout] already applied");
} else if (!src.includes(from)) {
    console.warn(
        "[fix-nextra-layout] pattern not found, skipping (maybe fixed upstream?)"
    );
} else {
    writeFileSync(file, src.replace(from, to));
    console.log("[fix-nextra-layout] applied");
}
