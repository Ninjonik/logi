import assert from "node:assert/strict"
import test from "node:test"

import {
    createEventDraftDeleteHandler,
    createEventFlowWriteHandler,
} from "./event-draft-routes"

const event = {
    gameId: "hell_let_loose",
    kind: "match",
    name: "VLK vs ROG",
    registrationEnd: "2026-10-10T17:30:00.000Z",
    meetingStart: "2026-10-11T17:30:00.000Z",
    gameStart: "2026-10-11T18:00:00.000Z",
    gameEnd: "2026-10-11T19:30:00.000Z",
    pingClan: false,
}
const DRAFT_ID = "k17abcdefghijklmnopq"

function deps(overrides: Record<string, unknown> = {}) {
    const calls: Array<[string, ...unknown[]]> = []
    return {
        calls,
        deps: {
            denied: async () => null,
            readJson: async (request: Request) => request.json(),
            saveDraft: async (...args: unknown[]) => {
                calls.push(["save", ...args])
                return { ok: true as const, eventId: DRAFT_ID }
            },
            publish: async (...args: unknown[]) => {
                calls.push(["publish", ...args])
                return { ok: true as const, eventId: DRAFT_ID }
            },
            remove: async (...args: unknown[]) => {
                calls.push(["remove", ...args])
                return { ok: true as const, eventId: DRAFT_ID }
            },
            revalidate: (...args: unknown[]) => {
                calls.push(["revalidate", ...args])
            },
            logError: () => undefined,
            ...overrides,
        },
    }
}

const post = (body: unknown) =>
    new Request("https://logi.test/api/servers/s1/event-drafts", {
        method: "POST",
        body: JSON.stringify(body),
    })
const params = Promise.resolve({ serverId: "s1" })

test("a denied request never reaches the save", async () => {
    const { deps: d, calls } = deps({
        denied: async () =>
            Response.json({ error: "forbidden" }, { status: 403 }),
    })
    const response = await createEventFlowWriteHandler(d)(post({ event }), {
        params,
    })
    assert.equal(response.status, 403)
    assert.equal(calls.length, 0)
})

test("an untitled draft saves, but cannot publish", async () => {
    const { deps: d, calls } = deps()
    const handler = createEventFlowWriteHandler(d)
    const saved = await handler(post({ event: { ...event, name: "" } }), {
        params,
    })
    assert.equal(saved.status, 200)
    assert.equal(calls[0][0], "save")
    assert.deepEqual(calls[1], ["revalidate", "s1", DRAFT_ID])

    const published = await handler(
        post({
            eventId: DRAFT_ID,
            publish: true,
            event: { ...event, name: "" },
        }),
        { params }
    )
    assert.equal(published.status, 400)
    assert.deepEqual(await published.json(), {
        error: "invalid_event",
        fields: ["name"],
    })
})

test("unknown body fields are refused", async () => {
    const { deps: d } = deps()
    const response = await createEventFlowWriteHandler(d)(
        post({ event, serverId: "other" }),
        { params }
    )
    assert.equal(response.status, 400)
})

test("publishing a published event or another clan's draft is refused", async () => {
    for (const [error, status] of [
        ["not_draft", 409],
        ["not_found", 404],
    ] as const) {
        const { deps: d, calls } = deps({
            publish: async () => ({ ok: false, error }),
        })
        const response = await createEventFlowWriteHandler(d)(
            post({ eventId: DRAFT_ID, publish: true, event }),
            { params }
        )
        assert.equal(response.status, status)
        assert.equal(calls.length, 0)
    }
})

test("a draft is deleted through its own route", async () => {
    const { deps: d, calls } = deps()
    const handler = createEventDraftDeleteHandler(d)
    const response = await handler(
        new Request("https://logi.test/x", { method: "DELETE" }),
        { params: Promise.resolve({ serverId: "s1", eventId: DRAFT_ID }) }
    )
    assert.equal(response.status, 200)
    assert.deepEqual(calls[0], ["remove", "s1", DRAFT_ID])
    const bad = await handler(
        new Request("https://logi.test/x", { method: "DELETE" }),
        { params: Promise.resolve({ serverId: "s1", eventId: "../x" }) }
    )
    assert.equal(bad.status, 404)
})
