// GET-only consumer smoke test. Run from the repository root with local env injection.
import { createRequire } from "node:module"
import assert from "node:assert/strict"
const require = createRequire(import.meta.url)
require("tsx/cjs")
const {
    warconEnvelopeSchema,
} = require("../../../../src/domain/game-data/warcon-contracts.ts")
const { LOGI_URL, LOGI_API_KEY, LOGI_WARCON_CONNECTION } = process.env
if (!LOGI_URL || !LOGI_API_KEY || !LOGI_WARCON_CONNECTION)
    throw new Error(
        "Set LOGI_URL, LOGI_API_KEY and LOGI_WARCON_CONNECTION privately."
    )
const origin = new URL(LOGI_URL)
if (
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    origin.pathname !== "/" ||
    !(
        origin.protocol === "https:" ||
        (origin.protocol === "http:" &&
            ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname))
    )
)
    throw new Error(
        "Use an HTTPS origin, or HTTP loopback for local acceptance."
    )
const proof = []
async function read(query) {
    const url = new URL(
        `/api/v1/clan/warcon-data/${encodeURIComponent(LOGI_WARCON_CONNECTION)}`,
        origin
    )
    url.search = new URLSearchParams({ game: "wardogs", ...query })
    const response = await fetch(url, {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(35_000),
        headers: { Authorization: `Bearer ${LOGI_API_KEY}` },
    })
    assert.equal(response.status, 200, `${query.view}: HTTP ${response.status}`)
    assert.equal(response.headers.get("cache-control"), "no-store")
    const { data } = await response.json()
    const value = warconEnvelopeSchema.parse(data)
    assert.equal(value.connectionId, LOGI_WARCON_CONNECTION)
    assert.equal(value.result.view, query.view)
    proof.push({
        view: query.view,
        range: query.range,
        ok: true,
        available: value.result.data !== null,
        at: new Date().toISOString(),
    })
    return value.result.data
}
try {
    const live = await read({ view: "live" })
    for (const range of ["24h", "7d", "30d"])
        await read({ view: "analytics", range })
    for (const view of [
        "cash",
        "leaderboard",
        "players",
        "kills",
        "rotation",
        "health",
        "capabilities",
    ])
        await read({ view })
    const catalog = await read({ view: "catalog" })
    const map = catalog.maps[0]?.id
    if (!map) throw new Error("No catalog map available for filtered reads.")
    await read({ view: "experiences", map })
    await read({ view: "alternators", map })
    const matches = await read({ view: "matches" })
    const match =
        matches.matches.find((row) => row.endedAt) ?? matches.matches[0]
    if (match) await read({ view: "match", matchId: String(match.id) })
    else
        proof.push({
            view: "match",
            skipped: true,
            reason: "No matches available",
        })
    if (live.players.length)
        await read({ view: "career", steamId: live.players[0].steamId })
    else
        proof.push({
            view: "career",
            skipped: true,
            reason: "No live player available",
        })
} catch {
    // Never print provider bodies, keys, URLs containing identifiers, or Zod input values.
    proof.push({
        ok: false,
        reason: "A read or schema assertion failed; inspect privately.",
    })
    process.exitCode = 1
}
console.log(
    JSON.stringify(
        {
            mode: "GET-only Logi consumer; no deployment or provider mutations",
            proof,
        },
        null,
        2
    )
)
