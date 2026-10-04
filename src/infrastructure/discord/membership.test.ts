import { fetchDiscordMembership } from "./membership"
import assert from "node:assert/strict"
import test from "node:test"
const subject = {
    guildId: "111111111111111111",
    discordUserId: "222222222222222222",
}
test("unknown guild/access failure is unavailable; only Discord Unknown Member proves departure", async () => {
    for (const [status, code] of [
        [404, 10004],
        [403, 50001],
        [429, 0],
        [500, 0],
    ])
        assert.equal(
            (
                await fetchDiscordMembership(subject, {
                    token: "synthetic",
                    fetch: async () => Response.json({ code }, { status }),
                })
            ).state,
            "unknown"
        )
    assert.equal(
        (
            await fetchDiscordMembership(subject, {
                token: "synthetic",
                fetch: async () =>
                    Response.json({ code: 10007 }, { status: 404 }),
            })
        ).state,
        "left"
    )
})
test("REST observation binds exact member, fixed origin and read start time", async () => {
    let time = 1000
    const result = await fetchDiscordMembership(subject, {
        token: "synthetic",
        now: () => time,
        fetch: async (url, init) => {
            assert.equal(
                String(url),
                `https://discord.com/api/v10/guilds/${subject.guildId}/members/${subject.discordUserId}`
            )
            assert.equal(init?.redirect, "error")
            assert.ok(init?.signal)
            time = 9000
            return Response.json({
                user: { id: subject.discordUserId },
                roles: ["333333333333333333"],
            })
        },
    })
    assert.equal(result.observedAt, new Date(1000).toISOString())
    assert.equal(
        (
            await fetchDiscordMembership(subject, {
                token: "synthetic",
                fetch: async () =>
                    Response.json({ user: { id: "other" }, roles: [] }),
            })
        ).state,
        "unknown"
    )
})
test("membership transport cancels oversized bodies and preserves Discord retry delay", async () => {
    let cancelled = false,
        reads = 0
    const body = new ReadableStream<Uint8Array>({
        pull(controller) {
            reads++
            if (reads === 4) controller.close()
            else controller.enqueue(new Uint8Array(65537))
        },
        cancel() {
            cancelled = true
        },
    })
    assert.equal(
        (
            await fetchDiscordMembership(subject, {
                token: "synthetic",
                fetch: async () => new Response(body),
            })
        ).state,
        "unknown"
    )
    assert.equal(cancelled, true)
    assert.ok(reads <= 2)
    const limited = await fetchDiscordMembership(subject, {
        token: "synthetic",
        fetch: async () => Response.json({ retry_after: 1.5 }, { status: 429 }),
    })
    assert.equal(limited.state, "unknown")
    assert.equal(limited.retryAfterMs, 1500)
})
