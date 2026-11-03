import { submitReport, type BugReportRepository } from "./submit-report"
import { validAttachment } from "../../domain/bug-reports/report"
import assert from "node:assert/strict"
import { test } from "node:test"

const now = 1800000000000
const input = {
    title: " Broken button ",
    message: "The save button does nothing.",
    server: "Example (123)",
    occurredAt: now - 1000,
}
function repository(count = 0) {
    const inserted: Parameters<BugReportRepository["insert"]>[0][] = []
    const repo: BugReportRepository = {
        recentCount: async (reporter, since) => {
            assert.equal(reporter, "actor")
            assert.equal(since, now - 3600000)
            return count
        },
        insert: async (report) => {
            inserted.push(report)
            return "report-id"
        },
    }
    return { repo, inserted }
}
test("submits normalized content with trusted reporter and new status", async () => {
    const { repo, inserted } = repository()
    assert.equal(
        await submitReport(
            repo,
            "actor",
            { ...input, reporter: "spoofed", status: "resolved" },
            [],
            now
        ),
        "report-id"
    )
    assert.equal(inserted[0].reporter, "actor")
    assert.equal(inserted[0].status, "new")
    assert.equal(inserted[0].title, "Broken button")
    assert.equal(inserted[0].occurredAt, now - 1000)
})
test("rejects invalid content, future incident times, excess attachments and hourly limit", async () => {
    const { repo, inserted } = repository()
    await assert.rejects(
        submitReport(repo, "actor", { ...input, title: " " }, [], now)
    )
    await assert.rejects(
        submitReport(
            repo,
            "actor",
            { ...input, occurredAt: now + 120000 },
            [],
            now
        ),
        /invalid_time/
    )
    await assert.rejects(
        submitReport(
            repo,
            "actor",
            input,
            Array(6).fill({ storageId: "id", name: "x.log", size: 1 }),
            now
        )
    )
    await assert.rejects(
        submitReport(repository(10).repo, "actor", input, [], now),
        /rate_limited/
    )
    assert.equal(inserted.length, 0)
})
test("optional incident time and attachments are supported", async () => {
    const { repo, inserted } = repository(9)
    await submitReport(
        repo,
        "actor",
        { title: input.title, message: input.message },
        [{ storageId: "file", name: "error.log", size: 20 }],
        now
    )
    assert.equal(inserted[0].server, "")
    assert.equal(inserted[0].occurredAt, undefined)
    assert.equal(inserted[0].attachments.length, 1)
})
test("attachment rules accept screenshots/logs and reject empty, executable and oversized files", () => {
    for (const name of [
        "screenshot.PNG",
        "error.log",
        "logs.zip",
        "trace.json",
    ])
        assert.ok(validAttachment({ name, size: 10 }))
    assert.ok(!validAttachment({ name: "x.exe", size: 10 }))
    assert.ok(!validAttachment({ name: "x.log", size: 0 }))
    assert.ok(!validAttachment({ name: "x.log", size: 5 * 1024 * 1024 + 1 }))
})
