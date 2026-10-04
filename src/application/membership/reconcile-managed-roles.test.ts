import {
    reconcileManagedRoles,
    type ManagedRolePorts,
} from "./reconcile-managed-roles"
import assert from "node:assert/strict"
import test from "node:test"

function fixture() {
    let roles = ["external", "recruit"]
    const writes: string[] = [],
        results: unknown[] = []
    let verdict: "ready" | "denied" | "superseded" = "ready"
    const ports: ManagedRolePorts = {
        now: () => 0,
        prepare: async () => ({
            verdict,
            allowedRoleIds: ["recruit", "member"],
            desiredRoleIds: ["member"],
        }),
        observe: async () => ({
            roleIds: [...roles],
            actorAuthorized: true,
            targetEligible: true,
            manageableRoleIds: ["recruit", "member"],
        }),
        change: async (action, role) => {
            writes.push(`${action}:${role}`)
            roles =
                action === "add"
                    ? [...roles, role]
                    : roles.filter((id) => id !== role)
        },
        finish: async (status, reason, retryAfterMs) => {
            results.push({ status, reason, retryAfterMs })
            return true
        },
    }
    return {
        ports,
        writes,
        results,
        get roles() {
            return roles
        },
        setVerdict: (value: typeof verdict) => {
            verdict = value
        },
    }
}
test("unmanaged roles preserved and successful state verified before applied", async () => {
    const f = fixture()
    assert.equal(await reconcileManagedRoles(f.ports), "applied")
    assert.deepEqual(f.roles.sort(), ["external", "member"])
})
test("actor revoked before execution denies without writing", async () => {
    const f = fixture()
    f.ports.observe = async () => ({
        roleIds: [],
        actorAuthorized: false,
        targetEligible: true,
        manageableRoleIds: ["member"],
    })
    assert.equal(await reconcileManagedRoles(f.ports), "denied")
    assert.deepEqual(f.writes, [])
})
test("bot hierarchy or deleted configured role prevents the operation", async () => {
    const f = fixture()
    f.ports.observe = async () => ({
        roleIds: ["recruit"],
        actorAuthorized: true,
        targetEligible: true,
        manageableRoleIds: ["recruit"],
    })
    assert.equal(await reconcileManagedRoles(f.ports), "denied")
    assert.deepEqual(f.writes, [])
})
test("timeout after Discord success retries idempotently", async () => {
    const f = fixture(),
        change = f.ports.change
    f.ports.change = async (action, role) => {
        await change(action, role)
        throw new Error("timeout")
    }
    assert.equal(await reconcileManagedRoles(f.ports), "retry_scheduled")
    f.ports.change = change
    assert.equal(await reconcileManagedRoles(f.ports), "applied")
    assert.equal(
        f.writes.filter((write) => write === "remove:recruit").length,
        1
    )
})
test("stale desired version is superseded after an awaited provider read", async () => {
    const f = fixture(),
        observe = f.ports.observe
    f.ports.observe = async () => {
        f.setVerdict("superseded")
        return observe()
    }
    assert.equal(await reconcileManagedRoles(f.ports), "superseded")
    assert.deepEqual(f.writes, [])
})
test("departure and unverified success never become applied", async () => {
    const f = fixture()
    f.ports.observe = async () => ({
        roleIds: [],
        actorAuthorized: true,
        targetEligible: false,
        manageableRoleIds: ["member"],
    })
    assert.equal(await reconcileManagedRoles(f.ports), "denied")
    const g = fixture()
    g.ports.change = async () => {}
    assert.equal(await reconcileManagedRoles(g.ports), "retry_scheduled")
})
