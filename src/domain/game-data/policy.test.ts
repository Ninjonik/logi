import {
    parseSources,
    projectSnapshot,
    projectLastState,
    acceptsRun,
    retryDelay,
    LAST_STATE_MAX_AGE_MS,
} from "./policy"
import assert from "node:assert/strict"
import test from "node:test"

const source = {
    ref: "wdg-primary",
    guildId: "guild-a",
    gameId: "wardogs",
    provider: "wardogs_rcon",
    providerServerId: "primary",
    origin: "https://rcon.example.test",
    secretRef: "LOGI_GAME_DATA_WDG_TOKEN",
    allowedAddresses: [],
}
const now = Date.parse("2030-01-01T00:00:00Z")
const observation = {
    observedAt: new Date(now).toISOString(),
    providerUpdatedAt: null,
    displayName: "Synthetic server",
    state: "online",
    map: "Map",
    players: 0,
    capacity: 100,
    providerInstanceId: "instance-1",
    scores: [{ id: "a", label: "A", score: 0 }],
    capabilities: ["server_snapshot"],
}
const stored = {
    id: "connection",
    guildId: "guild-a",
    gameId: "wardogs",
    provider: "wardogs_rcon",
    enabled: true,
    generation: 2,
    fence: 5,
    leaseUntil: now + 60_000,
    lastAttemptAt: new Date(now).toISOString(),
    errorCategory: null,
    observation,
}

test("source catalog binds credentials to tenant and rejects unsafe configuration", () => {
    assert.equal(parseSources(JSON.stringify([source]))[0].ref, "wdg-primary")
    for (const patch of [
        { origin: "http://public.example.test" },
        { origin: "https://user:password@example.test" },
        { origin: "https://example.test/path" },
        { secretRef: "DISCORD_BOT_TOKEN" },
        { gameId: "hell_let_loose" },
    ]) {
        assert.throws(
            () => parseSources(JSON.stringify([{ ...source, ...patch }])),
            /configuration/i
        )
    }
    assert.throws(
        () => parseSources(JSON.stringify([source, source])),
        /configuration/i
    )
    assert.deepEqual(parseSources(undefined), [])
})

test("snapshot preserves zero and minimizes fields while freshness uses observation time", () => {
    const result = projectSnapshot(stored, now)
    assert.equal(result.players, 0)
    assert.equal(result.freshness, "fresh")
    assert.equal(result.scores[0].score, 0)
    assert.equal(projectSnapshot(stored, now + 180_000).freshness, "stale")
    assert.equal(
        projectSnapshot(stored, now + 900_000).freshness,
        "unavailable"
    )
    for (const key of [
        "origin",
        "secretRef",
        "generation",
        "fence",
        "leaseUntil",
        "observation",
    ])
        assert.equal(key in result, false)
})

test("timeout preserves last success and reports unknown rather than offline or zero", () => {
    const result = projectSnapshot(
        {
            ...stored,
            errorCategory: "timeout",
            lastAttemptAt: new Date(now + 10_000).toISOString(),
        },
        now + 10_000
    )
    assert.equal(result.state, "unknown")
    assert.equal(result.freshness, "stale")
    assert.equal(result.observedAt, observation.observedAt)
    assert.equal(result.players, 0)
    const missing = projectSnapshot({ ...stored, observation: null }, now)
    assert.equal(missing.players, null)
    assert.equal(missing.freshness, "unavailable")
})

test("an incomplete directory observation stays stale even when its timestamp is recent", () => {
    const result = projectSnapshot(
        {
            ...stored,
            provider: "wardogs_public_directory",
            observation: { ...observation, state: "unknown" },
        },
        now
    )
    assert.equal(result.freshness, "stale")
    assert.equal(result.state, "unknown")
    assert.equal(result.players, 0)
})

test("the last observed state outlives freshness for a day, without changing the snapshot (M3-23)", () => {
    // 25 minutes old: the snapshot says unavailable and unknown, the last
    // state is still known.
    const later = now + 25 * 60_000
    assert.equal(projectSnapshot(stored, later).state, "unknown")
    assert.equal(projectSnapshot(stored, later).freshness, "unavailable")
    assert.equal(projectLastState(stored, later), "online")
    assert.equal(
        projectLastState(
            { ...stored, observation: { ...observation, state: "offline" } },
            later
        ),
        "offline"
    )
    assert.equal(
        projectLastState(stored, now + LAST_STATE_MAX_AGE_MS - 1),
        "online"
    )
    assert.equal(projectLastState(stored, now + LAST_STATE_MAX_AGE_MS), null)
    assert.equal(projectLastState({ ...stored, enabled: false }, now), null)
    assert.equal(projectLastState({ ...stored, observation: null }, now), null)
    assert.equal(
        projectLastState(
            { ...stored, observation: { ...observation, state: "unknown" } },
            now
        ),
        null
    )
    // An observation from the future is not trusted.
    assert.equal(projectLastState(stored, now - 1), null)
})

test("disabled generation and expired or superseded lease reject late commits", () => {
    assert.equal(acceptsRun(stored, { generation: 2, fence: 5 }, now), true)
    assert.equal(
        acceptsRun(
            { ...stored, enabled: false },
            { generation: 2, fence: 5 },
            now
        ),
        false
    )
    assert.equal(acceptsRun(stored, { generation: 1, fence: 5 }, now), false)
    assert.equal(acceptsRun(stored, { generation: 2, fence: 4 }, now), false)
    assert.equal(
        acceptsRun(stored, { generation: 2, fence: 5 }, now + 60_000),
        false
    )
})

test("retry policy honors Retry-After and pauses configuration failures", () => {
    assert.equal(retryDelay("rate_limited", 1, 120_000), 120_000)
    assert.equal(retryDelay("timeout", 1), 5_000)
    assert.equal(retryDelay("timeout", 3), 60_000)
    assert.equal(retryDelay("unauthorized", 1), null)
    assert.equal(retryDelay("unsupported", 1), null)
})
