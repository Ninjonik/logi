import assert from "node:assert/strict"
import test from "node:test"

import { canOpenWorkspace, type WorkspaceAccessFacts } from "./workspace-access"

const nobody: WorkspaceAccessFacts = {
    userDiscordId: "user-1",
    managedGuildIds: [],
    mercenaryGuildIds: [],
    dashboardAccessGuildIds: [],
}
const clan = { discordId: "guild-1", adminIds: [] as string[] }

test("a stored workspace without any access link cannot be opened", () => {
    assert.equal(canOpenWorkspace(nobody, clan), false)
})

test("each access source opens the workspace", () => {
    for (const facts of [
        { ...nobody, primaryGuildId: "guild-1" },
        { ...nobody, managedGuildIds: ["guild-1"] },
        { ...nobody, mercenaryGuildIds: ["guild-1"] },
        { ...nobody, memberGuildIds: ["guild-1"] },
        { ...nobody, dashboardAccessGuildIds: ["guild-1"] },
    ]) {
        assert.equal(canOpenWorkspace(facts, clan), true)
    }
    assert.equal(
        canOpenWorkspace(nobody, { ...clan, adminIds: ["user-1"] }),
        true
    )
    assert.equal(
        canOpenWorkspace(nobody, { ...clan, dashboardAdminIds: ["user-1"] }),
        true
    )
})

test("access to another clan does not open this one", () => {
    assert.equal(
        canOpenWorkspace(
            {
                ...nobody,
                primaryGuildId: "guild-2",
                managedGuildIds: ["guild-3"],
                dashboardAccessGuildIds: ["guild-4"],
            },
            { ...clan, adminIds: ["user-2"] }
        ),
        false
    )
})
