import { wardogsDirectoryProvider } from "./wardogs-public-directory"
import { parseSources } from "../../domain/game-data/policy.schema"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
const source = parseSources(
    JSON.stringify([
        {
            ref: "directory",
            guildId: "guild",
            gameId: "wardogs",
            provider: "wardogs_public_directory",
            providerServerId: "00012345",
            origin: "https://api.wardogservers.com",
            secretRef: null,
        },
    ])
)[0]
const body = JSON.parse(
    readFileSync(
        new URL("./fixtures/wardogs/directory.json", import.meta.url),
        "utf8"
    )
)
const now = () => Date.parse("2030-01-01T00:01:00Z")
test("directory preserves provider age, stable join identity and restart-specific instance", async () => {
    const result = await wardogsDirectoryProvider.readSnapshot(
        source,
        {
            get: async (path) => {
                assert.equal(path, "/v1/servers/00012345")
                return { body, status: 200, etag: '"fixture"' }
            },
        },
        now
    )
    assert.equal(result.observation.observedAt, "2030-01-01T00:00:00.000Z")
    assert.equal(result.observation.players, 0)
    assert.equal(result.pollAfterMs, 120_000)
    const restarted = await wardogsDirectoryProvider.readSnapshot(
        source,
        {
            get: async () => ({
                body: {
                    ...body,
                    data: {
                        ...body.data,
                        id: "22222222-2222-4222-8222-222222222222",
                    },
                },
                status: 200,
                etag: null,
            }),
        },
        now
    )
    assert.notEqual(
        restarted.observation.providerInstanceId,
        result.observation.providerInstanceId
    )
    assert.equal(source.providerServerId, "00012345")
    const cached = await wardogsDirectoryProvider.readSnapshot(
        {
            ...source,
            observation: result.observation,
            etag: result.etag,
            pollAfterMs: result.pollAfterMs,
        },
        {
            get: async (_path, options) => {
                assert.equal(options?.etag, '"fixture"')
                return { body: null, status: 304, etag: null }
            },
        },
        now
    )
    assert.deepEqual(cached.observation, result.observation)
    assert.equal(cached.pollAfterMs, 120_000)
})
test("directory missing listing, unknown region and mismatched identity cannot prove online", async () => {
    await assert.rejects(
        wardogsDirectoryProvider.readSnapshot(
            source,
            { get: async () => ({ body: null, status: 404, etag: null }) },
            now
        ),
        /not_listed/
    )
    await assert.rejects(
        wardogsDirectoryProvider.readSnapshot(
            source,
            {
                get: async () => ({
                    body: {
                        ...body,
                        data: { ...body.data, serverId: "other" },
                    },
                    status: 200,
                    etag: null,
                }),
            },
            now
        ),
        /invalid_response/
    )
    const missingRegion = await wardogsDirectoryProvider.readSnapshot(
        source,
        {
            get: async () => ({
                body: {
                    ...body,
                    meta: {
                        ...body.meta,
                        observedRegions: [],
                        stale: true,
                        complete: false,
                    },
                },
                status: 200,
                etag: null,
            }),
        },
        now
    )
    assert.equal(missingRegion.observation.state, "unknown")
})
