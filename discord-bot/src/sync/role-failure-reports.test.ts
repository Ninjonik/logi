import assert from "node:assert/strict"
import test from "node:test"

import {
    createRoleFailureReporter,
    type RoleFailureReport,
} from "./role-failure-reports"

function setup() {
    const reports: RoleFailureReport[] = []
    const timers: Array<() => void> = []
    const reporter = createRoleFailureReporter({
        report: async (report) => {
            reports.push(report)
        },
        schedule: (run) => {
            timers.push(run)
        },
    })
    return { reports, timers, reporter }
}

test("failures of one clan go out as one report with every member (L5-14)", async () => {
    const { reports, timers, reporter } = setup()
    for (const memberId of ["1", "2", "2", "3"])
        reporter.add({
            guildId: "g",
            memberId,
            reason: "role_unmanageable_or_deleted",
        })
    reporter.add({ guildId: "g", memberId: "4", reason: "discord_forbidden" })
    assert.equal(timers.length, 1, "one report per window")
    timers[0]!()
    await Promise.resolve()
    assert.deepEqual(reports, [
        {
            guildId: "g",
            memberIds: ["1", "2", "3", "4"],
            reasons: ["role_unmanageable_or_deleted", "discord_forbidden"],
        },
    ])
})

test("clans are reported separately; failures that fix themselves are not reported", async () => {
    const { reports, timers, reporter } = setup()
    assert.equal(
        reporter.add({
            guildId: "a",
            memberId: "1",
            reason: "target_not_eligible",
        }),
        false
    )
    reporter.add({ guildId: "a", memberId: "1", reason: "discord_forbidden" })
    reporter.add({ guildId: "b", memberId: "2", reason: "discord_forbidden" })
    for (const run of timers) run()
    await Promise.resolve()
    assert.deepEqual(
        reports.map((report) => [report.guildId, report.memberIds]),
        [
            ["a", ["1"]],
            ["b", ["2"]],
        ]
    )
    // A later failure opens a new window.
    reporter.add({ guildId: "a", memberId: "5", reason: "discord_forbidden" })
    assert.equal(timers.length, 3)
})
