import { readOperatorSources, readStoredSource } from "./operator-sources"
import { sourceFingerprint } from "./credentials"
import { parseSources } from "./policy.schema"
import { sourceSchema } from "./contracts"
import assert from "node:assert/strict"
import test from "node:test"

const warcon = {
    ref: "wd-primary",
    guildId: "guild-a",
    gameId: "wardogs",
    provider: "wardogs_warcon",
    providerServerId: "0f6d2c1e-8d1f-4a7e-9a42-2f4b6c8d9e01",
    origin: "https://warcon.example.test",
    secretRef: "LOGI_GAME_DATA_WD_TOKEN",
    allowedAddresses: ["203.0.113.4"],
}
const hll = {
    ref: "hll",
    guildId: "guild-a",
    gameId: "hell_let_loose",
    provider: "hll_crcon",
    providerServerId: "1",
    origin: "https://crcon.example.test:8443",
    secretRef: null,
}
const directory = {
    ref: "dir",
    guildId: "guild-b",
    gameId: "wardogs",
    provider: "wardogs_public_directory",
    providerServerId: "srv",
    origin: "https://api.wardogservers.com",
    secretRef: null,
    allowedAddresses: [],
}

test("the stored-source guard accepts exactly what the Zod schema accepts", () => {
    const cases: unknown[] = [
        warcon,
        hll,
        directory,
        { ...warcon, allowedAddresses: undefined },
        { ...warcon, ref: "Bad Ref" },
        { ...warcon, guildId: "" },
        { ...warcon, gameId: "chess" },
        { ...warcon, provider: "other" },
        { ...warcon, providerServerId: "not-a-uuid" },
        { ...warcon, origin: "http://warcon.example.test" },
        { ...warcon, origin: "https://user:pw@warcon.example.test" },
        { ...warcon, origin: "https://warcon.example.test/path" },
        { ...warcon, origin: "https://warcon.example.test/?q=1" },
        { ...warcon, secretRef: "DISCORD_BOT_TOKEN" },
        { ...warcon, secretRef: undefined },
        { ...warcon, allowedAddresses: Array(17).fill("203.0.113.4") },
        { ...warcon, allowedAddresses: [""] },
        { ...warcon, extra: true },
        { ...hll, gameId: "wardogs" },
        { ...directory, secretRef: "LOGI_GAME_DATA_DIR_TOKEN" },
        { ...directory, origin: "https://other.example.test" },
        { ...directory, allowedAddresses: ["203.0.113.4"] },
        null,
        [],
        "text",
    ]
    for (const value of cases) {
        const parsed = sourceSchema.safeParse(value)
        const read = readStoredSource(value)
        assert.equal(
            read !== null,
            parsed.success,
            `guard and schema disagree on ${JSON.stringify(value)}`
        )
        if (parsed.success) assert.deepEqual(read, parsed.data)
    }
})

test("a connection's stored fingerprint reads back as the source it was made from", () => {
    const source = sourceSchema.parse(hll)
    assert.deepEqual(
        readStoredSource(JSON.parse(sourceFingerprint(source))),
        source
    )
})

test("the operator catalogue reader mirrors parseSources and reads a value once", () => {
    const raw = JSON.stringify([warcon, hll, directory])
    assert.deepEqual(readOperatorSources(raw), parseSources(raw))
    assert.equal(readOperatorSources(raw), readOperatorSources(raw))
    assert.deepEqual(readOperatorSources(undefined), [])
    assert.deepEqual(readOperatorSources(""), [])
    for (const bad of [
        "not json",
        JSON.stringify({ ref: "x" }),
        JSON.stringify([warcon, warcon]),
        JSON.stringify([{ ...warcon, origin: "http://warcon.example.test" }]),
        JSON.stringify(
            Array(101)
                .fill(hll)
                .map((s, i) => ({ ...s, ref: `h${i}` }))
        ),
    ]) {
        assert.throws(() => readOperatorSources(bad), /configuration/i)
        assert.throws(() => parseSources(bad), /configuration/i)
    }
})
