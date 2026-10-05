import { readdirSync, readFileSync } from "node:fs"
import assert from "node:assert/strict"
import test from "node:test"
import path from "node:path"

/**
 * The root layout's title template appends "| Logi" to every page title, so a
 * page title that already ends with it reads "… | Logi | Logi" in the tab.
 */
const APP_DIR = path.join(process.cwd(), "src", "app")
const SUFFIX = /\|\s*(?:Logi|\$\{dictionary\.app\.name\})\s*["`]/
function pages(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(directory, entry.name)
        if (entry.isDirectory()) return pages(full)
        return /^(page|layout)\.tsx$/.test(entry.name) ? [full] : []
    })
}

test("page titles leave the Logi suffix to the title template", () => {
    const offenders = pages(APP_DIR)
        .filter((file) => path.relative(APP_DIR, file) !== "layout.tsx")
        .filter((file) => SUFFIX.test(readFileSync(file, "utf8")))
        .map((file) => path.relative(APP_DIR, file))
    assert.deepEqual(offenders, [])
})
