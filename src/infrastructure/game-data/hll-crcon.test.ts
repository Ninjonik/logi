import { parseSources } from "../../domain/game-data/policy.schema"
import { hllCrconProvider } from "./hll-crcon"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
const source = parseSources(
    JSON.stringify([
        {
            ref: "hll",
            guildId: "guild",
            gameId: "hell_let_loose",
            provider: "hll_crcon",
            providerServerId: "1",
            origin: "https://crcon.example.test",
            secretRef: null,
        },
    ])
)[0]
const wire = JSON.parse(
    readFileSync(
        new URL("./fixtures/hll/public-info.json", import.meta.url),
        "utf8"
    )
)
test("CRCON status uses the public-info envelope and preserves zero without private config", async () => {
    const result = await hllCrconProvider.readSnapshot(
        source,
        {
            get: async (path) => {
                assert.equal(path, "/api/get_public_info")
                return { body: wire, status: 200, etag: null }
            },
        },
        () => 0
    )
    assert.equal(result.observation.players, 0)
    assert.equal(result.observation.scores[0].score, 0)
    assert.equal(result.observation.map, "Sainte-Mère-Église Warfare")
    assert.equal(result.observation.displayName, "Synthetic HLL server")
    assert.equal(JSON.stringify(result).includes("private"), false)
})
test("CRCON failed or malformed envelope never becomes an empty online server", async () => {
    for (const body of [
        { failed: true, result: wire.result },
        { failed: false, result: {} },
        { result: wire.result },
    ]) {
        await assert.rejects(
            hllCrconProvider.readSnapshot(
                source,
                { get: async () => ({ body, status: 200, etag: null }) },
                () => 0
            ),
            /invalid_response/
        )
    }
})
