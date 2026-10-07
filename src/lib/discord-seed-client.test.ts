import assert from "node:assert/strict"
import test from "node:test"

import { boardSeedSettings } from "@/infrastructure/testing/in-memory-seed"
import type { SeedChannelReport } from "@/domain/discord-seed/channels"

import {
    checkSeedPlanChannels,
    runSeedAction,
    saveSeedPlan,
} from "./discord-seed-client"

const channels: SeedChannelReport = {
    seedChannel: { canPublish: true, canMentionRole: true },
    controlChannel: { canPublish: true, private: true },
    role: { exists: true, canManage: true },
    problems: [],
}

function fetcher(
    status: number,
    body: unknown,
    seen: Array<[string, RequestInit | undefined]> = []
) {
    return (async (url: string, init?: RequestInit) => {
        seen.push([url, init])
        return Response.json(body, { status })
    }) as unknown as typeof fetch
}
const offline = (async () => {
    throw new TypeError("offline")
}) as unknown as typeof fetch

test("saving puts the plan on the encoded server route and reads the revision", async () => {
    const seen: Array<[string, RequestInit | undefined]> = []
    const settings = boardSeedSettings()
    const result = await saveSeedPlan(
        "server/1",
        "conn:1",
        { expectedRevision: 3, settings },
        fetcher(200, { revision: 4, channels }, seen)
    )
    assert.deepEqual(result, { ok: true, revision: 4, channels })
    assert.equal(seen[0]![0], "/api/servers/server%2F1/discord-seed/conn%3A1")
    assert.equal(seen[0]![1]?.method, "PUT")
    assert.deepEqual(JSON.parse(String(seen[0]![1]?.body)), {
        expectedRevision: 3,
        settings,
    })
})

test("save refusals keep their codes; unknown answers read unavailable", async () => {
    const input = { expectedRevision: 1, settings: boardSeedSettings() }
    assert.deepEqual(
        await saveSeedPlan(
            "s",
            "c",
            input,
            fetcher(400, {
                error: "invalid_plan",
                issues: [{ path: "liveFrom", code: "live_above_capacity" }],
            })
        ),
        {
            ok: false,
            error: "invalid_plan",
            issues: [{ path: "liveFrom", code: "live_above_capacity" }],
        }
    )
    const blocked = { ...channels, problems: ["control_channel_public"] }
    assert.deepEqual(
        await saveSeedPlan(
            "s",
            "c",
            input,
            fetcher(400, { error: "channels", channels: blocked })
        ),
        { ok: false, error: "channels", channels: blocked }
    )
    for (const error of [
        "conflict",
        "not_found",
        "forbidden",
        "verification_unavailable",
    ])
        assert.deepEqual(
            await saveSeedPlan("s", "c", input, fetcher(409, { error })),
            { ok: false, error }
        )
    assert.deepEqual(
        await saveSeedPlan("s", "c", input, fetcher(403, "nope")),
        { ok: false, error: "forbidden" }
    )
    assert.deepEqual(await saveSeedPlan("s", "c", input, offline), {
        ok: false,
        error: "unavailable",
    })
})

test("checking channels sends only a verifyOnly request", async () => {
    const seen: Array<[string, RequestInit | undefined]> = []
    const settings = {
        seedChannelId: "111111111111111111",
        controlChannelId: null,
        seedRoleId: null,
        roleSelfService: true,
    }
    assert.deepEqual(
        await checkSeedPlanChannels(
            "s",
            "c",
            settings,
            fetcher(200, { channels }, seen)
        ),
        { ok: true, channels }
    )
    assert.deepEqual(JSON.parse(String(seen[0]![1]?.body)), {
        expectedRevision: null,
        settings,
        verifyOnly: true,
    })
    assert.deepEqual(
        await checkSeedPlanChannels(
            "s",
            "c",
            settings,
            fetcher(503, { error: "verification_unavailable" })
        ),
        { ok: false, error: "verification_unavailable" }
    )
    assert.deepEqual(await checkSeedPlanChannels("s", "c", settings, offline), {
        ok: false,
        error: "unavailable",
    })
})

test("Seed teď and Ukončit seed map every answer of the route", async () => {
    const seen: Array<[string, RequestInit | undefined]> = []
    assert.deepEqual(
        await runSeedAction(
            "s",
            "c",
            { action: "start", requestKey: "abcdefgh-1" },
            fetcher(
                200,
                {
                    status: "started",
                    runId: "r",
                    startedAt: "2026-10-05T15:00:00.000Z",
                    channelId: "111111111111111111",
                    pinged: true,
                },
                seen
            )
        ),
        {
            ok: true,
            action: "started",
            channelId: "111111111111111111",
            pinged: true,
        }
    )
    assert.equal(seen[0]![1]?.method, "POST")
    assert.deepEqual(
        await runSeedAction(
            "s",
            "c",
            { action: "stop" },
            fetcher(200, { status: "stopped", runId: "r" })
        ),
        { ok: true, action: "stopped" }
    )
    const start = { action: "start", requestKey: "abcdefgh-2" } as const
    assert.deepEqual(
        await runSeedAction(
            "s",
            "c",
            start,
            fetcher(200, { status: "duplicate", runId: "r" })
        ),
        { ok: false, error: "duplicate" }
    )
    assert.deepEqual(
        await runSeedAction(
            "s",
            "c",
            start,
            fetcher(429, {
                error: "cooldown",
                retryAt: "2026-10-05T18:25:00.000Z",
            })
        ),
        { ok: false, error: "cooldown", retryAt: "2026-10-05T18:25:00.000Z" }
    )
    assert.deepEqual(
        await runSeedAction(
            "s",
            "c",
            start,
            fetcher(409, { error: "unavailable", reason: "already_live" })
        ),
        { ok: false, error: "already_live" }
    )
    assert.deepEqual(
        await runSeedAction(
            "s",
            "c",
            start,
            fetcher(409, { error: "running", runId: null })
        ),
        { ok: false, error: "running" }
    )
    assert.deepEqual(
        await runSeedAction("s", "c", start, fetcher(503, { error: "x" })),
        { ok: false, error: "unavailable" }
    )
    assert.deepEqual(await runSeedAction("s", "c", start, offline), {
        ok: false,
        error: "unavailable",
    })
})
