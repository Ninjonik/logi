import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { fileURLToPath } from "node:url"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"

const directory = path.dirname(fileURLToPath(import.meta.url))
const repository = path.resolve(directory, "../../../../../..")
const hash = (data) => createHash("sha256").update(data).digest("hex")
const git = (...args) =>
    execFileSync("git", args, {
        cwd: repository,
        encoding: "utf8",
        maxBuffer: 8 * 1024 * 1024,
    }).trim()
const json = (name) =>
    JSON.parse(readFileSync(path.join(directory, name), "utf8"))
const source = json("source-manifest.json")
assert.match(source.sourceRevision, /^[0-9a-f]{40}$/)
const runtimePaths = source.runtimeInputs.map((entry) => {
    const target = path.resolve(repository, entry.path)
    assert.ok(target.startsWith(repository + path.sep))
    assert.equal(
        git("rev-parse", `${source.sourceRevision}:${entry.path}`),
        entry.gitObject,
        entry.path
    )
    return entry.path
})
assert.equal(
    git("diff", "--name-only", source.sourceRevision, "--", ...runtimePaths),
    "",
    "Runtime differs from the tested source"
)
assert.equal(
    git("ls-files", "--others", "--exclude-standard", "--", ...runtimePaths),
    "",
    "Untracked runtime inputs are not covered"
)
const files = git("ls-files", "-z")
    .split("\0")
    .filter(
        (file) =>
            /^(convex|src|discord-bot)\//.test(file) &&
            /\.[cm]?tsx?$/.test(file) &&
            !file.includes("/_generated/")
    )
    .sort()
    .map((file) => ({
        path: file,
        sha256: hash(
            readFileSync(path.join(repository, file), "utf8").replace(
                /\r\n/g,
                "\n"
            )
        ),
    }))
assert.equal(files.length, source.observedTypeScriptSnapshot.fileCount)
assert.equal(
    hash(JSON.stringify(files)),
    source.observedTypeScriptSnapshot.sha256
)
const verification = json("verification.json")
const http = json("http-checks.json")
const security = json("security-review.json")
assert.equal(verification.sourceRevision, source.sourceRevision)
assert.equal(http.sourceRevision, source.sourceRevision)
assert.equal(security.fixRevision, source.sourceRevision)
assert.equal(
    http.suites.reduce((count, suite) => count + suite.checks.length, 0),
    http.totalAssertions
)
assert.ok(
    http.suites.every((suite) => suite.checks.every((check) => check.passed))
)
for (const artifact of json("manifest.json").artifacts) {
    const target = path.resolve(directory, artifact.path)
    assert.ok(target.startsWith(directory + path.sep))
    assert.equal(
        hash(readFileSync(target, "utf8").replace(/\r\n/g, "\n")),
        artifact.sha256,
        artifact.path
    )
}
console.log(
    JSON.stringify(
        {
            verified: true,
            sourceRevision: source.sourceRevision,
            sourceFiles: files.length,
            httpAssertions: http.totalAssertions,
            externalChecksRerun: false,
        },
        null,
        2
    )
)
