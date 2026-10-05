import assert from "node:assert/strict"
import test from "node:test"

import {
    createPublicInviteHandler,
    type SavePublicInviteResult,
} from "./public-invite-route"

const request = (body: unknown) =>
    new Request("http://internal/api/servers/s1/public-invite", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: typeof body === "string" ? body : JSON.stringify(body),
    })

function harness(options: {
    denied?: boolean
    save?: (inviteUrl: string | null) => Promise<SavePublicInviteResult>
}) {
    const saved: Array<string | null> = []
    const revalidated: string[] = []
    const errors: unknown[] = []
    const handle = createPublicInviteHandler({
        denied: async () =>
            options.denied
                ? Response.json({ error: "forbidden" }, { status: 403 })
                : null,
        save: async (_serverId, inviteUrl) => {
            saved.push(inviteUrl)
            return options.save
                ? options.save(inviteUrl)
                : { ok: true, inviteUrl, guildDiscordId: "123" }
        },
        revalidate: (serverId, guildDiscordId) =>
            revalidated.push(`${serverId}:${guildDiscordId}`),
        logError: (error) => errors.push(error),
    })
    return { handle, saved, revalidated, errors }
}

test("a clan admin's invite is stored in canonical form", async () => {
    const { handle, saved, revalidated } = harness({})
    const response = await handle(
        request({ inviteUrl: "https://discord.com/invite/MyClan" }),
        "s1"
    )
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
        inviteUrl: "https://discord.gg/MyClan",
    })
    assert.deepEqual(saved, ["https://discord.gg/MyClan"])
    assert.deepEqual(revalidated, ["s1:123"])
})

test("null or an empty value removes the invite", async () => {
    const { handle, saved } = harness({})
    assert.equal((await handle(request({ inviteUrl: null }), "s1")).status, 200)
    assert.equal((await handle(request({ inviteUrl: " " }), "s1")).status, 200)
    assert.deepEqual(saved, [null, null])
})

test("a refused caller is answered before the body is read", async () => {
    const { handle, saved } = harness({ denied: true })
    const response = await handle(
        request({ inviteUrl: "https://discord.gg/clan" }),
        "s1"
    )
    assert.equal(response.status, 403)
    assert.deepEqual(saved, [])
})

test("other links, extra fields and malformed bodies are refused", async () => {
    const { handle, saved } = harness({})
    for (const body of [
        { inviteUrl: "https://evil.example/join" },
        { inviteUrl: "https://discord.gg/clan", name: "x" },
        { inviteUrl: 5 },
        {},
        "not json",
        { inviteUrl: "https://discord.gg/" + "a".repeat(3000) },
    ]) {
        const response = await handle(request(body), "s1")
        assert.equal(response.status, 400, JSON.stringify(body))
    }
    assert.deepEqual(saved, [])
})

test("a store failure is reported without details", async () => {
    const { handle, errors } = harness({
        save: async () => {
            throw new Error("Convex unavailable")
        },
    })
    const response = await handle(
        request({ inviteUrl: "https://discord.gg/clan" }),
        "s1"
    )
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), { error: "save_failed" })
    assert.equal(errors.length, 1)
})
