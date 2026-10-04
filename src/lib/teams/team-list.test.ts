import { appendTeamPage, removeTeamRecord, upsertTeamRecord } from "./team-list"
import type { TeamRecord } from "@/domain/teams/team"
import assert from "node:assert/strict"
import test from "node:test"

function team(id: string, name: string, archivedAt: string | null = null) {
    return {
        id,
        gameId: "wardogs",
        name,
        shortCode: null,
        logoUrl: null,
        logoAssetId: null,
        revision: 1,
        updatedAt: "2026-10-01T00:00:00.000Z",
        archivedAt,
        createdAt: "2026-10-01T00:00:00.000Z",
    } satisfies TeamRecord
}
const names = (items: readonly TeamRecord[]) => items.map((item) => item.name)

test("a saved record is placed in directory order or replaces its old row", () => {
    const list = [team("1", "Alpha"), team("3", "Charlie")]
    assert.deepEqual(names(upsertTeamRecord(list, team("2", "bravo"), false)), [
        "Alpha",
        "bravo",
        "Charlie",
    ])
    assert.deepEqual(names(upsertTeamRecord(list, team("4", "Zulu"), false)), [
        "Alpha",
        "Charlie",
        "Zulu",
    ])
    const renamed = upsertTeamRecord(list, team("1", "Delta"), false)
    assert.deepEqual(names(renamed), ["Charlie", "Delta"])
    assert.equal(list.length, 2, "the loaded page is not mutated")
})

test("archived records leave an active-only list but stay in the archived view", () => {
    const list = [team("1", "Alpha"), team("2", "Bravo")]
    const archived = team("1", "Alpha", "2026-10-02T00:00:00.000Z")
    assert.deepEqual(names(upsertTeamRecord(list, archived, false)), ["Bravo"])
    const shown = upsertTeamRecord(list, archived, true)
    assert.deepEqual(names(shown), ["Alpha", "Bravo"])
    assert.equal(shown[0]?.archivedAt, "2026-10-02T00:00:00.000Z")
})

test("removed records disappear and further pages never duplicate rows", () => {
    const list = [team("1", "Alpha"), team("2", "Bravo")]
    assert.deepEqual(names(removeTeamRecord(list, "1")), ["Bravo"])
    assert.deepEqual(
        names(appendTeamPage(list, [team("2", "Bravo"), team("3", "Charlie")])),
        ["Alpha", "Bravo", "Charlie"]
    )
})
