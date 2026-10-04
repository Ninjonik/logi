import { deliverPlayerReport, type ReportDeliveryClaim } from "./deliver-report"
import assert from "node:assert/strict"
import test from "node:test"
test("report creation records binding before private content and completion", async () => {
    const calls: string[] = [],
        claim: ReportDeliveryClaim = {
            kind: "claimed",
            canCreate: true,
            fence: 1,
            threadId: null,
            marker: "report-one",
        }
    const result = await deliverPlayerReport({
        claim: async () => claim,
        find: async () => null,
        create: async () => {
            calls.push("create")
            return "thread"
        },
        bind: async () => {
            calls.push("bind")
        },
        preparePrivateThread: async () => {
            calls.push("members")
        },
        starter: async () => {
            calls.push("content")
            return "message"
        },
        complete: async () => {
            calls.push("complete")
        },
        uncertain: async () => {
            calls.push("uncertain")
        },
        release: async () => {
            calls.push("release")
        },
    })
    assert.deepEqual(result, { kind: "open", threadId: "thread" })
    assert.deepEqual(calls, [
        "create",
        "bind",
        "members",
        "bind",
        "content",
        "complete",
    ])
})
test("ambiguous report thread creation is never repeated after a restart", async () => {
    let created = 0,
        uncertain = 0,
        found: string | null = null
    const claim: ReportDeliveryClaim = {
        kind: "claimed",
        canCreate: true,
        fence: 1,
        threadId: null,
        marker: "report-one",
    }
    const ports = {
        claim: async () => claim,
        find: async () => found,
        create: async () => {
            created++
            throw Error("lost Discord response")
        },
        bind: async () => {},
        preparePrivateThread: async () => {},
        starter: async () => "message",
        complete: async () => {},
        uncertain: async () => {
            uncertain++
        },
        release: async () => {
            throw Error("release must not follow an attempted create")
        },
    }
    assert.equal((await deliverPlayerReport(ports)).kind, "uncertain")
    claim.canCreate = false
    claim.fence++
    assert.equal((await deliverPlayerReport(ports)).kind, "uncertain")
    found = "original-thread"
    assert.deepEqual(await deliverPlayerReport(ports), {
        kind: "open",
        threadId: "original-thread",
    })
    assert.equal(created, 1)
    assert.equal(uncertain, 2)
})
test("failed privacy setup never posts a report body", async () => {
    let content = 0
    const result = await deliverPlayerReport({
        claim: async () => ({
            kind: "claimed",
            canCreate: true,
            fence: 1,
            threadId: null,
            marker: "report-one",
        }),
        find: async () => null,
        create: async () => "thread",
        bind: async () => {},
        preparePrivateThread: async () => {
            throw Error("staff invitation failed")
        },
        starter: async () => {
            content++
            return "message"
        },
        complete: async () => {},
        uncertain: async () => {},
        release: async () => {
            throw Error("a created thread is never released")
        },
    })
    assert.equal(result.kind, "uncertain")
    assert.equal(content, 0)
})
test("an already completed report returns its original thread without side effects", async () => {
    const unexpected = async (): Promise<never> => {
        throw Error("unexpected side effect")
    }
    assert.deepEqual(
        await deliverPlayerReport({
            claim: async () => ({ kind: "open", threadId: "original" }),
            find: unexpected,
            create: unexpected,
            bind: unexpected,
            preparePrivateThread: unexpected,
            starter: unexpected,
            complete: unexpected,
            uncertain: unexpected,
            release: unexpected,
        }),
        { kind: "open", threadId: "original" }
    )
})
test("a failure before any thread create returns the report to pending instead of uncertain", async () => {
    const calls: string[] = []
    const result = await deliverPlayerReport({
        claim: async () => ({
            kind: "claimed",
            canCreate: true,
            fence: 1,
            threadId: null,
            marker: "report-one",
        }),
        find: async () => {
            throw Error("staff_access_unavailable")
        },
        create: async () => {
            calls.push("create")
            return "thread"
        },
        bind: async () => {},
        preparePrivateThread: async () => {},
        starter: async () => "message",
        complete: async () => {},
        uncertain: async () => {
            calls.push("uncertain")
        },
        release: async () => {
            calls.push("release")
        },
    })
    assert.deepEqual(result, { kind: "busy" })
    assert.deepEqual(calls, ["release"])
})
