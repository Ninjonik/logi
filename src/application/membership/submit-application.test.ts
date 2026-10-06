import assert from "node:assert/strict"
import test from "node:test"

import {
    submitApplication,
    type SubmitApplicationPorts,
} from "./submit-application"

function fake(overrides: Partial<SubmitApplicationPorts> = {}) {
    const calls: string[] = []
    const ports: SubmitApplicationPorts = {
        createAssignment: async () => {
            calls.push("assignment")
            return "assignment-1"
        },
        removeAssignment: async (id) => {
            calls.push(`remove-assignment:${id}`)
        },
        createThread: async () => {
            calls.push("thread")
            return { id: "thread-1" }
        },
        deleteThread: async (id) => {
            calls.push(`delete-thread:${id}`)
        },
        addMembers: async () => {
            calls.push("members")
        },
        recordApplication: async () => {
            calls.push("record")
            return { number: 42 }
        },
        sendIntro: async () => {
            calls.push("intro")
            return true
        },
        sendCard: async (_thread, number) => {
            calls.push(`card:${number}`)
            return "card-message"
        },
        storeCardMessage: async (_thread, id) => {
            calls.push(`store:${id}`)
        },
        linkAccounts: async () => {
            calls.push("accounts")
        },
        report: (step) => {
            calls.push(`report:${step}`)
        },
        ...overrides,
    }
    return { ports, calls }
}

test("a submit creates the membership, thread, record, intro and card in order", async () => {
    const { ports, calls } = fake()
    assert.deepEqual(await submitApplication(ports), {
        ok: true,
        threadId: "thread-1",
        number: 42,
    })
    assert.deepEqual(calls, [
        "assignment",
        "thread",
        "members",
        "record",
        "intro",
        "card:42",
        "store:card-message",
        "accounts",
    ])
})

test("no thread: the membership is rolled back and nothing is left (L4-23)", async () => {
    const { ports, calls } = fake({
        createThread: async () => {
            throw new Error("Missing Access")
        },
    })
    assert.deepEqual(await submitApplication(ports), {
        ok: false,
        failedAt: "thread",
    })
    assert.deepEqual(calls, [
        "assignment",
        "report:thread",
        "remove-assignment:assignment-1",
    ])
})

test("no record: the thread is deleted and the membership rolled back", async () => {
    const { ports, calls } = fake({ recordApplication: async () => null })
    assert.deepEqual(await submitApplication(ports), {
        ok: false,
        failedAt: "record",
    })
    assert.deepEqual(calls.slice(-2), [
        "delete-thread:thread-1",
        "remove-assignment:assignment-1",
    ])
})

test("no membership: nothing else happens", async () => {
    const { ports, calls } = fake({ createAssignment: async () => null })
    assert.deepEqual(await submitApplication(ports), {
        ok: false,
        failedAt: "assignment",
    })
    assert.deepEqual(calls, [])
})

test("a failed card is reported but the application stands", async () => {
    const { ports, calls } = fake({
        sendCard: async () => {
            throw new Error("Invalid Form Body")
        },
    })
    assert.equal((await submitApplication(ports)).ok, true)
    assert.ok(calls.includes("report:card"))
    assert.ok(!calls.some((call) => call.startsWith("store:")))
})
