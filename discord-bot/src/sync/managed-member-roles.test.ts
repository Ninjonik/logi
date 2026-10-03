import { processManagedRoleOperation } from "./managed-member-roles"
import assert from "node:assert/strict"
import test from "node:test"
test("bot runner uses current durable claim, fresh provider evidence and fenced completion", async () => {
    let observed = false
    const calls: string[] = []
    const outcome = await processManagedRoleOperation(
        { guildId: "guild", operationId: "op", fence: 3 },
        {
            now: () => 1,
            prepare: async (_claim, evidence) => {
                calls.push(evidence ? "prepare-fresh" : "prepare")
                return {
                    verdict: "ready",
                    guildId: "guild",
                    discordUserId: "222222222222222222",
                    actorId: "staff",
                    allowedRoleIds: [],
                    desiredRoleIds: [],
                }
            },
            discord: (work) => {
                assert.equal(work.userId, "222222222222222222")
                return {
                    observe: async () => {
                        observed = true
                        return {
                            roleIds: [],
                            manageableRoleIds: [],
                            targetEligible: true,
                            evidence: {
                                actorPresent: true,
                                actorAdministrator: false,
                                actorRoleIds: [],
                                targetRoleIds: [],
                                observedAt: 1,
                            },
                        }
                    },
                    change: async () => assert.fail("No role write required"),
                }
            },
            finish: async (claim, status, _reason, _retry, evidence) => {
                assert.equal(claim.fence, 3)
                assert.equal(status, "applied")
                assert.ok(observed && evidence)
                calls.push("finish")
                return true
            },
        }
    )
    assert.equal(outcome, "applied")
    assert.deepEqual(calls, ["prepare", "prepare-fresh", "finish"])
})

for (const expiresDuring of ["observation", "authorization"] as const) {
    test(`bot runner never changes a role when evidence expires during ${expiresDuring}`, async () => {
        let now = 1000
        let observed = false
        const changed: string[] = []
        const outcome = await processManagedRoleOperation(
            { guildId: "guild", operationId: "op", fence: 3 },
            {
                now: () => now,
                prepare: async () => {
                    if (observed && expiresDuring === "authorization")
                        now = 12000
                    return {
                        verdict: "ready",
                        guildId: "guild",
                        discordUserId: "222222222222222222",
                        actorId: "staff",
                        allowedRoleIds: ["role"],
                        desiredRoleIds: ["role"],
                    }
                },
                discord: () => ({
                    observe: async () => {
                        observed = true
                        if (expiresDuring === "observation") now = 12000
                        return {
                            roleIds: [...changed],
                            manageableRoleIds: ["role"],
                            targetEligible: true,
                            evidence: {
                                actorPresent: true,
                                actorAdministrator: true,
                                actorRoleIds: [],
                                targetRoleIds: [...changed],
                                observedAt: 1000,
                            },
                        }
                    },
                    change: async (_action, id) => {
                        changed.push(id)
                    },
                }),
                finish: async () => true,
            }
        )
        assert.deepEqual(changed, [])
        assert.equal(outcome, "retry_scheduled")
    })
}
