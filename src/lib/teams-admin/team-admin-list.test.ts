import {
    appendUnique,
    fillTemplate,
    formatAdminDate,
    linkableWorkspaces,
    mergeCandidates,
    removeById,
    teamAdminActions,
    teamLifecycleBadge,
    upsertAdminTeam,
    workspaceName,
} from "./team-admin-list"
import type { TeamRecord } from "@/domain/teams/team"
import assert from "node:assert/strict"
import test from "node:test"

const team = (id: string, overrides: Partial<TeamRecord> = {}): TeamRecord => ({
    id,
    gameId: "wardogs",
    name: id,
    shortCode: null,
    logoUrl: null,
    description: null,
    links: [],
    revision: 1,
    updatedAt: "2026-10-01T00:00:00.000Z",
    logoAssetId: null,
    linkedGuildId: null,
    mergedIntoTeamId: null,
    archivedAt: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
})

test("upserts keep catalogue order and drop archived rows from active lists", () => {
    const items = [team("alpha"), team("charlie")]
    assert.deepEqual(
        upsertAdminTeam(items, team("bravo"), false).map((item) => item.id),
        ["alpha", "bravo", "charlie"]
    )
    const archived = team("alpha", { archivedAt: "2026-10-02T00:00:00.000Z" })
    assert.deepEqual(
        upsertAdminTeam(items, archived, false).map((item) => item.id),
        ["charlie"]
    )
    assert.equal(
        upsertAdminTeam(items, archived, true)[0]?.archivedAt,
        archived.archivedAt
    )
})

test("pages append without duplicates and rows can be removed", () => {
    const items = [team("a"), team("b")]
    assert.deepEqual(
        appendUnique(items, [team("b"), team("c")]).map((item) => item.id),
        ["a", "b", "c"]
    )
    assert.deepEqual(
        removeById(items, "a").map((item) => item.id),
        ["b"]
    )
})

test("badges and actions follow archive and merge state", () => {
    const active = team("a"),
        archived = team("b", { archivedAt: "2026-10-02T00:00:00.000Z" }),
        merged = team("c", {
            archivedAt: "2026-10-02T00:00:00.000Z",
            mergedIntoTeamId: "a",
        })
    assert.equal(teamLifecycleBadge(active), null)
    assert.equal(teamLifecycleBadge(archived), "archived")
    assert.equal(teamLifecycleBadge(merged), "merged")
    assert.deepEqual(teamAdminActions(active), {
        edit: true,
        archive: true,
        restore: false,
        merge: true,
    })
    assert.deepEqual(teamAdminActions(archived), {
        edit: false,
        archive: false,
        restore: true,
        merge: true,
    })
    assert.deepEqual(teamAdminActions(merged), {
        edit: false,
        archive: false,
        restore: false,
        merge: false,
    })
})

test("merge candidates are other active teams of the same game", () => {
    const source = team("source")
    const candidates = mergeCandidates(
        [
            source,
            team("ok"),
            team("hll", { gameId: "hell_let_loose" }),
            team("gone", { archivedAt: "2026-10-02T00:00:00.000Z" }),
        ],
        source
    )
    assert.deepEqual(
        candidates.map((item) => item.id),
        ["ok"]
    )
})

test("templates insert values literally", () => {
    assert.equal(
        fillTemplate("Merge {source} into {target}", {
            source: "A$&",
            target: "B",
        }),
        "Merge A$& into B"
    )
})

test("linkable workspaces keep valid guild IDs, deduplicated and sorted", () => {
    assert.deepEqual(
        linkableWorkspaces([
            { discordId: "222222222222222222", name: "" },
            { discordId: "111111111111111111", name: "Zulu" },
            { discordId: "222222222222222222", name: "Alpha" },
            { discordId: "not-a-guild", name: "Broken" },
            { discordId: "333333333333333333", name: " " },
        ]),
        [
            { id: "222222222222222222", name: "Alpha" },
            { id: "111111111111111111", name: "Zulu" },
            { id: "333333333333333333", name: "333333333333333333" },
        ]
    )
    const options = [{ id: "111111111111111111", name: "Zulu" }]
    assert.equal(workspaceName(options, "111111111111111111"), "Zulu")
    assert.equal(workspaceName(options, "999999999999999999"), null)
    assert.equal(workspaceName(options, null), null)
})

test("dates are localized and invalid values are shown as stored", () => {
    assert.match(
        formatAdminDate("2026-10-04T12:00:00.000Z", "en-GB"),
        /4 Oct 2026/
    )
    assert.equal(formatAdminDate("not a date", "en"), "not a date")
})
