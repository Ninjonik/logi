import * as migrations from "../../../convex/teamMigrations"
import { invoke, testContext } from "./testing/database"
import assert from "node:assert/strict"
import test from "node:test"

const team = (
    id: string,
    extra: Record<string, unknown> = {}
): Record<string, unknown> & { _id: string } => ({
    _id: `teamDirectory:${id}`,
    gameId: "hell_let_loose",
    name: "Valkyria",
    shortCode: null,
    logoAssetId: null,
    normalizedName: "valkyria",
    searchText: "Valkyria",
    archivedAt: null,
    revision: 1,
    createdAt: "2026-10-03T00:00:00.000Z",
    updatedAt: "2026-10-03T00:00:00.000Z",
    createdBy: "someone",
    updatedBy: "someone",
    ...extra,
})

test("the legacy report lists same-name teams per game and ignores merged ones", async () => {
    const ctx = testContext()
    ctx.db.seed("teamDirectory", team("a", { guildId: "guild-a" }))
    ctx.db.seed("teamDirectory", team("b", { guildId: "guild-b" }))
    // Same name in another game is not a collision.
    ctx.db.seed(
        "teamDirectory",
        team("w", { guildId: "guild-b", gameId: "wardogs" })
    )
    // A global entry without provenance still counts against a legacy one.
    ctx.db.seed(
        "teamDirectory",
        team("g", {
            name: "Bravo",
            normalizedName: "bravo",
            searchText: "Bravo",
        })
    )
    ctx.db.seed(
        "teamDirectory",
        team("c", {
            guildId: "guild-c",
            name: "Bravo",
            normalizedName: "bravo",
            searchText: "Bravo",
        })
    )
    // Already merged legacy duplicates are resolved.
    ctx.db.seed(
        "teamDirectory",
        team("m", { guildId: "guild-d", mergedIntoTeamId: "teamDirectory:a" })
    )
    const report = await invoke(migrations.legacyCollisionReport, ctx, {})
    assert.equal(report.legacyTeams, 4)
    assert.equal(report.truncated, false)
    assert.deepEqual(
        report.collisions.map(
            (entry: { normalizedName: string; teamIds: string[] }) => [
                entry.normalizedName,
                [...entry.teamIds].sort(),
            ]
        ),
        [
            ["valkyria", ["teamDirectory:a", "teamDirectory:b"]],
            ["bravo", ["teamDirectory:c", "teamDirectory:g"]],
        ]
    )
    // Nothing is written.
    assert.equal(ctx.db.tables.teamDirectory.length, 6)
})
