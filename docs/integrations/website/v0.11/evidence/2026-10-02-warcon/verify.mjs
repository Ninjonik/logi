import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { fileURLToPath } from "node:url"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"

const directory = path.dirname(fileURLToPath(import.meta.url))
const repository = path.resolve(directory, "../../../../../..")
const git = (...args) =>
    execFileSync("git", args, {
        cwd: repository,
        encoding: "utf8",
        maxBuffer: 8 * 1024 * 1024,
    }).trim()
const manifest = JSON.parse(readFileSync(path.join(directory, "manifest.json")))
for (const entry of manifest.artifacts) {
    const target = path.resolve(directory, entry.path)
    assert.ok(
        target.startsWith(directory + path.sep),
        "Artifact escapes evidence directory"
    )
    const bytes = readFileSync(target)
    const value =
        entry.encoding === "utf8-lf"
            ? Buffer.from(bytes.toString("utf8").replace(/\r\n/g, "\n"))
            : bytes
    assert.equal(
        createHash("sha256").update(value).digest("hex"),
        entry.sha256,
        entry.path
    )
}
const source = JSON.parse(
    readFileSync(path.join(directory, "source-manifest.json"))
)
assert.match(source.runtimeCommit, /^[0-9a-f]{40}$/)
for (const file of source.files) {
    const target = path.resolve(repository, file.path)
    assert.ok(
        target.startsWith(repository + path.sep),
        "Source escapes repository"
    )
    assert.equal(
        git("rev-parse", `${source.runtimeCommit}:${file.path}`),
        file.gitBlob,
        file.path
    )
    assert.equal(
        git("-c", "core.safecrlf=false", "hash-object", file.path),
        file.gitBlob,
        file.path
    )
}
assert.equal(
    git(
        "diff",
        "--name-only",
        source.runtimeCommit,
        "--",
        ...source.runtimePaths
    ),
    "",
    "Runtime source differs from the tested commit"
)
assert.equal(
    git(
        "ls-files",
        "--others",
        "--exclude-standard",
        "--",
        ...source.runtimePaths
    ),
    "",
    "Untracked runtime source is not covered by this evidence"
)
console.log(
    JSON.stringify(
        {
            verified: true,
            artifacts: manifest.artifacts.length,
            sourceFiles: source.files.length,
            runtimeCommit: source.runtimeCommit,
            liveChecksRerun: false,
        },
        null,
        2
    )
)
