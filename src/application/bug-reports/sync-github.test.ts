import { syncGithubReport, type GithubIssuePort } from "./sync-github"
import type { Report } from "../../domain/bug-reports/report"
import assert from "node:assert/strict"
import test from "node:test"
const report: Report = {
    _id: "one",
    _creationTime: 0,
    reporter: "private",
    status: "resolved",
    title: "Bug",
    message: "Details of bug",
    server: "",
    attachments: [],
}
function fixture() {
    const calls: string[] = []
    const port: GithubIssuePort = {
        async findOrCreate(marker, title, body) {
            calls.push("create")
            assert.ok(body.startsWith(marker))
            assert.ok(!body.includes("private"))
            return { number: 3, html_url: "https://github.com/o/r/issues/3" }
        },
        async setState(number, state) {
            calls.push(`${number}:${state}`)
        },
        async commentOnce(number, marker, body) {
            calls.push("comment")
            assert.ok(body.includes(marker))
        },
    }
    return { calls, port }
}
test("creation checkpoints the identity before updating state", async () => {
    const { calls, port } = fixture()
    assert.equal((await syncGithubReport(report, "o/r", port)).revision, -1)
    assert.deepEqual(calls, ["create"])
})
test("linked status update precedes idempotent status comment", async () => {
    const { calls, port } = fixture()
    await syncGithubReport(
        { ...report, githubNumber: 3, githubRepository: "o/r" },
        "o/r",
        port
    )
    assert.deepEqual(calls, ["3:closed", "comment"])
})
test("repository mismatch has no external effects", async () => {
    const { calls, port } = fixture()
    await assert.rejects(
        syncGithubReport(
            { ...report, githubRepository: "old/repo" },
            "o/r",
            port
        )
    )
    assert.deepEqual(calls, [])
})
