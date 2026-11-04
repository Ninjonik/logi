import assert from "node:assert/strict"
import test from "node:test"
import { searchAssignmentCandidates } from "./player-search"

const players = [
    { user: { discordId: "12345", name: "DiscordAlice", nicknames: { here: "Server Ace", elsewhere: "Other Alias" } } },
    { user: { discordId: "67890", name: "Bob", nicknames: {} }, existingHere: { type: "member" } },
    { user: { discordId: "24680", name: "Carol", nicknames: {} }, existingHere: { type: "mercenary" } },
]
const input = { query: "", guildId: "here", createMode: true }

test("Add player excludes all existing assignments, including mercenaries", () => {
    assert.deepEqual(searchAssignmentCandidates(players, input), [players[0]])
    assert.deepEqual(searchAssignmentCandidates(players, { ...input, query: "Bob" }), [])
})

test("search matches Discord names, current-server display names and Discord IDs", () => {
    for (const query of [" discordALICE ", "server ace", "12345"]) assert.deepEqual(searchAssignmentCandidates(players, { ...input, query }), [players[0]])
    assert.deepEqual(searchAssignmentCandidates(players, { ...input, query: "Other Alias" }), [])
    assert.deepEqual(searchAssignmentCandidates(players, { ...input, query: "missing" }), [])
})

test("editing retains the assigned player's identity", () => {
    assert.deepEqual(searchAssignmentCandidates(players, { ...input, query: "Bob", createMode: false }), [players[1]])
})
