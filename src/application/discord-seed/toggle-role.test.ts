import assert from "node:assert/strict"
import test from "node:test"

import {
    seedRoleToggleAction,
    toggleSeedRole,
    type SeedRoleTogglePorts,
} from "./toggle-role"

const ROLE = "333333333333333333"

function member(initial: string[], options: { offered?: boolean } = {}) {
    let roles = [...initial]
    const changes: string[] = []
    const ports: SeedRoleTogglePorts = {
        offered: async () => options.offered ?? true,
        observe: async () => ({ roleIds: [...roles] }),
        change: async (action, roleId) => {
            changes.push(`${action}:${roleId}`)
            roles =
                action === "add"
                    ? [...roles, roleId]
                    : roles.filter((id) => id !== roleId)
        },
    }
    return { ports, changes, roles: () => roles }
}

test("the button turns the role on, then off (P5-23, P5-24)", async () => {
    const env = member(["111"])
    assert.deepEqual(await toggleSeedRole(env.ports, ROLE), { kind: "on" })
    assert.deepEqual(env.roles(), ["111", ROLE])
    assert.deepEqual(await toggleSeedRole(env.ports, ROLE), { kind: "off" })
    assert.deepEqual(env.roles(), ["111"])
    assert.deepEqual(env.changes, [`add:${ROLE}`, `remove:${ROLE}`])
})

test("a role given by hand in Discord counts and the button removes it (P5-22)", async () => {
    const env = member([ROLE])
    assert.deepEqual(await toggleSeedRole(env.ports, ROLE), { kind: "off" })
    assert.equal(seedRoleToggleAction([ROLE], ROLE), "remove")
    assert.equal(seedRoleToggleAction([], ROLE), "add")
})

test("a role no plan offers is refused without touching Discord", async () => {
    const env = member([], { offered: false })
    assert.deepEqual(await toggleSeedRole(env.ports, ROLE), {
        kind: "unavailable",
    })
    assert.deepEqual(env.changes, [])
})

test("a refused or silently ignored change is a failure, never a false reply", async () => {
    const refused = member([])
    refused.ports.change = async () => {
        throw new Error("Missing Permissions")
    }
    const result = await toggleSeedRole(refused.ports, ROLE)
    assert.equal(result.kind, "failed")
    const ignored = member([])
    ignored.ports.change = async () => {}
    assert.equal((await toggleSeedRole(ignored.ports, ROLE)).kind, "failed")
})
