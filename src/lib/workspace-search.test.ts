import assert from "node:assert/strict"
import test from "node:test"

import { rankWorkspaces } from "./workspace-search"

const clans = [
    { id: "3", name: "Wolves", description: "Czech HLL clan" },
    { id: "1", name: "Alpha", description: undefined },
    { id: "2", name: "Wolfpack", description: "Wardogs" },
    { id: "4", name: "Bravo", description: "Friends of wolves" },
]

test("without a query every clan is listed alphabetically", () => {
    assert.deepEqual(
        rankWorkspaces(clans, "  ").map((clan) => clan.name),
        ["Alpha", "Bravo", "Wolfpack", "Wolves"]
    )
})

test("a query keeps every match, best first, and drops the rest", () => {
    assert.deepEqual(
        rankWorkspaces(clans, "wol").map((clan) => clan.name),
        ["Wolfpack", "Wolves", "Bravo"]
    )
    assert.deepEqual(
        rankWorkspaces(clans, "wolves").map((clan) => clan.name),
        ["Wolves", "Bravo"]
    )
})

test("the list is not cut off, so more than five clans stay reachable", () => {
    const many = Array.from({ length: 12 }, (_, index) => ({
        id: String(index),
        name: `Clan ${String(index).padStart(2, "0")}`,
        description: undefined,
    }))
    assert.equal(rankWorkspaces(many, "").length, 12)
    assert.equal(rankWorkspaces(many, "clan").length, 12)
})
