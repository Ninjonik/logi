// Read-only artifact/source verification; this does not rerun live acceptance.
import { readFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import assert from "node:assert/strict"
import path from "node:path"

const root = import.meta.dirname
const manifest = JSON.parse(readFileSync(path.join(root, "manifest.json"), "utf8"))
for (const [file, expected] of Object.entries(manifest.artifacts)) {
    const actual = createHash("sha256")
        .update(readFileSync(path.join(root, file), "utf8").replaceAll("\r\n", "\n"))
        .digest("hex")
    assert.equal(actual, expected, `Evidence changed: ${file}`)
}
const output = readFileSync(path.join(root, "tests.txt"), "utf8")
assert.match(output, /tests 551/)
assert.match(output, /pass 551/)
assert.match(output, /fail 0/)
execFileSync("git", [
    "diff", "--exit-code", manifest.source.commit, "--",
    "src", "convex", "discord-bot", "package.json", "package-lock.json",
], { cwd: path.resolve(root, "../../../../../.."), stdio: "pipe" })
console.log(JSON.stringify({
    artifacts: Object.keys(manifest.artifacts).length,
    hashes: "pass",
    runtimeSource: "unchanged",
    acceptanceRerun: false,
    source: manifest.source.commit,
}))
