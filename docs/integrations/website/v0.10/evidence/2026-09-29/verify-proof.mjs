// Read-only verification of this pinned documentation/evidence package.
import { readFileSync, existsSync, statSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import assert from "node:assert/strict"
import { compile } from "@mdx-js/mdx"
import path from "node:path"

const repo = path.resolve(import.meta.dirname, "../../../../../..")
const base = "docs/integrations/website/v0.10"
const documents = [
    "pr-handbook.md",
    "web-capabilities.md",
    "discord-reference.md",
    "verification-evidence.md",
    "review-guide.md",
    "validation.md",
    "server-status-command.md",
    "README.md",
].map((file) => `${base}/${file}`)
documents.push(
    "README.md",
    "AGENTS.md",
    "discord-bot/README.md",
    "content/discord-bot-setup.mdx",
    "docs/integrations/website/roadmap/README.md",
    "docs/integrations/website/v0.3/capabilities.md"
)
const read = (file) => readFileSync(path.join(repo, file), "utf8")
const slug = (text) =>
    text
        .toLowerCase()
        .replace(/<[^>]*>/g, "")
        .replace(/[^\p{L}\p{N}\-_ ]/gu, "")
        .replace(/ /g, "-")
let links = 0
for (const file of documents) {
    for (const match of read(file).matchAll(/!?\[[^\]]*\]\(([^\s)]+)\)/g)) {
        const target = match[1]
        if (/^(https?:|mailto:|\/)/.test(target)) continue
        const [relative, fragment] = target.split("#")
        const destination = path.resolve(
            repo,
            path.dirname(file),
            decodeURIComponent(relative)
        )
        assert.ok(existsSync(destination), `${file}: missing ${target}`)
        if (
            fragment &&
            statSync(destination).isFile() &&
            /\.mdx?$/.test(destination)
        ) {
            const headings = [
                ...readFileSync(destination, "utf8").matchAll(/^#+ (.+)$/gm),
            ].map((heading) => slug(heading[1].trim()))
            assert.ok(
                headings.includes(fragment),
                `${file}: missing heading ${target}`
            )
        }
        links++
    }
}
const manifest = JSON.parse(
    readFileSync(path.join(import.meta.dirname, "manifest.json"), "utf8")
)
for (const [file, expected] of Object.entries(manifest.artifacts)) {
    const actual = createHash("sha256")
        .update(
            readFileSync(
                path.join(import.meta.dirname, file),
                "utf8"
            ).replaceAll("\r\n", "\n")
        )
        .digest("hex")
    assert.equal(actual, expected, `Evidence changed: ${file}`)
}
const capture = JSON.parse(
    readFileSync(
        path.join(import.meta.dirname, "discord-commands.json"),
        "utf8"
    )
)
for (const commands of Object.values(capture.locales)) {
    assert.equal(commands.length, 6)
    for (const command of commands)
        assert.ok(
            read(`${base}/discord-reference.md`).includes(`/${command.name}`)
        )
}
await compile({
    path: "content/discord-bot-setup.mdx",
    value: read("content/discord-bot-setup.mdx"),
})
execFileSync(
    "git",
    [
        "diff",
        "--exit-code",
        manifest.source.commit,
        "--",
        ...manifest.runtimeDiff.paths,
    ],
    { cwd: repo, stdio: "pipe" }
)
console.log(
    JSON.stringify({
        relativeLinks: links,
        artifactHashes: Object.keys(manifest.artifacts).length,
        commandDefinitions: 6,
        locales: 3,
        wikiMdxSyntax: "pass",
        runtimeDiff: "unchanged",
        note: "Local link/MDX/hash/source check; not a full Nextra build or hosted acceptance.",
    })
)
