import {
    buildTeamRequestDecisionMessage,
    deliverTeamRequestNotifications,
    safeDiscordText,
    startTeamRequestNotificationLoop,
    type TeamRequestDecisionMessage,
    type TeamRequestNotification,
    type TeamRequestNotificationPorts,
} from "./team-request-notifications"
import assert from "node:assert/strict"
import test from "node:test"

const USER = "100000000000000001"
const notification = (
    overrides: Partial<TeamRequestNotification> = {}
): TeamRequestNotification => ({
    requestId: "req-1",
    discordUserId: USER,
    guildId: "200000000000000002",
    language: "en",
    kind: "create",
    gameId: "wardogs",
    status: "approved",
    requestedName: "Alpha Squad",
    teamName: "Alpha Squad",
    reason: null,
    ...overrides,
})
const embedOf = (message: TeamRequestDecisionMessage | null) => {
    assert.ok(message)
    assert.deepEqual(message.allowedMentions, { parse: [] })
    const embed = message.embeds[0]?.toJSON()
    assert.ok(embed)
    return {
        ...embed,
        field: (name: string) =>
            embed.fields?.find((field) => field.name === name)?.value,
    }
}

test("approved create DMs name the requested and resulting team", () => {
    const embed = embedOf(buildTeamRequestDecisionMessage(notification()))
    assert.equal(embed.title, "Team request approved")
    assert.match(embed.description ?? "", /now in the Logi team catalogue/)
    assert.equal(embed.field("Request"), "New team")
    assert.equal(embed.field("Game"), "Wardogs")
    assert.equal(embed.field("Requested name"), "Alpha Squad")
    assert.equal(embed.field("Team in the catalogue"), "Alpha Squad")
    assert.equal(embed.field("Reason"), undefined)
    assert.equal(embed.footer?.text, "Logi team catalogue")
})

test("approved change requests and merges use their own copy", () => {
    const update = embedOf(
        buildTeamRequestDecisionMessage(
            notification({ kind: "update", gameId: "hell_let_loose" })
        )
    )
    assert.match(update.description ?? "", /requested changes were applied/)
    assert.equal(update.field("Request"), "Change request")
    assert.equal(update.field("Game"), "Hell Let Loose")
    const merged = embedOf(
        buildTeamRequestDecisionMessage(
            notification({
                status: "merged",
                requestedName: "Alpha",
                teamName: "Alpha Squad",
            })
        )
    )
    assert.equal(merged.title, "Team request merged")
    assert.equal(merged.field("Requested name"), "Alpha")
    assert.equal(merged.field("Team in the catalogue"), "Alpha Squad")
})

test("rejections carry the reason and no resulting team", () => {
    const embed = embedOf(
        buildTeamRequestDecisionMessage(
            notification({
                status: "rejected",
                teamName: null,
                reason: "Duplicate of an existing team.",
            })
        )
    )
    assert.equal(embed.title, "Team request rejected")
    assert.equal(embed.field("Reason"), "Duplicate of an existing team.")
    assert.equal(embed.field("Team in the catalogue"), undefined)
    assert.equal(embed.color, 0xed4245)
})

test("DMs use the requesting workspace's language with an English fallback", () => {
    const czech = embedOf(
        buildTeamRequestDecisionMessage(
            notification({ language: "cs", status: "rejected", reason: "Ne" })
        )
    )
    assert.equal(czech.title, "Žádost o tým zamítnuta")
    assert.equal(czech.field("Důvod"), "Ne")
    const german = embedOf(
        buildTeamRequestDecisionMessage(notification({ language: "de" }))
    )
    assert.equal(german.title, "Teamanfrage genehmigt")
    const unknown = embedOf(
        buildTeamRequestDecisionMessage(notification({ language: "xx" }))
    )
    assert.equal(unknown.title, "Team request approved")
})

test("user-supplied text is escaped and cannot mention anyone", () => {
    const embed = embedOf(
        buildTeamRequestDecisionMessage(
            notification({
                status: "rejected",
                requestedName: "**Bold** @everyone",
                reason: "See <@123456789012345678> and <#1> _now_",
            })
        )
    )
    const name = embed.field("Requested name") ?? ""
    assert.equal(name.includes("**"), false)
    assert.equal(name.includes("@everyone"), false)
    assert.match(name, /\\\*\\\*Bold\\\*\\\*/)
    const reason = embed.field("Reason") ?? ""
    assert.equal(reason.includes("<@"), false)
    assert.equal(reason.includes("<#"), false)
    assert.equal(safeDiscordText("x".repeat(2000)).length, 1024)
})

test("undecided statuses produce no message", () => {
    assert.equal(
        buildTeamRequestDecisionMessage(notification({ status: "pending" })),
        null
    )
    assert.equal(
        buildTeamRequestDecisionMessage(notification({ status: "cancelled" })),
        null
    )
})

type FakeUser = { sent: TeamRequestDecisionMessage[]; fail?: unknown }
function fakePorts(input: {
    claimed: unknown
    users?: Record<string, FakeUser>
    markFails?: boolean
}) {
    const marks: Array<[string, string]> = []
    const warnings: Array<{
        message: string
        context: Record<string, string | number>
    }> = []
    const fetched: string[] = []
    const ports: TeamRequestNotificationPorts = {
        claim: async () => {
            if (input.claimed instanceof Error) throw input.claimed
            return input.claimed
        },
        fetchUser: async (id) => {
            fetched.push(id)
            const user = input.users?.[id]
            return user
                ? {
                      send: async (message) => {
                          if (user.fail) throw user.fail
                          user.sent.push(message)
                      },
                  }
                : null
        },
        mark: async (requestId, outcome) => {
            if (input.markFails) throw new Error("convex down")
            marks.push([requestId, outcome])
        },
        warn: (message, context) => warnings.push({ message, context }),
    }
    return { ports, marks, warnings, fetched }
}

test("a pass sends each claimed DM and confirms it", async () => {
    const user: FakeUser = { sent: [] }
    const { ports, marks } = fakePorts({
        claimed: [notification(), notification({ requestId: "req-2" })],
        users: { [USER]: user },
    })
    assert.deepEqual(await deliverTeamRequestNotifications(ports), {
        sent: 2,
        failed: 0,
    })
    assert.equal(user.sent.length, 2)
    assert.deepEqual(marks, [
        ["req-1", "sent"],
        ["req-2", "sent"],
    ])
})

test("unknown users and malformed claims are retried; closed DMs are final", async () => {
    const closed: FakeUser = {
        sent: [],
        fail: Object.assign(new Error("Cannot send messages to this user"), {
            code: 50007,
        }),
    }
    const { ports, marks, warnings, fetched } = fakePorts({
        claimed: [
            notification({
                requestId: "req-gone",
                discordUserId: "300000000000000003",
            }),
            notification({ requestId: "req-closed" }),
            notification({ requestId: "req-bad-id", discordUserId: "nope" }),
            { requestId: "req-malformed", status: "approved" },
            notification({ requestId: "req-pending", status: "pending" }),
            { nothing: true },
        ],
        users: { [USER]: closed },
    })
    assert.deepEqual(await deliverTeamRequestNotifications(ports), {
        sent: 0,
        failed: 5,
    })
    assert.deepEqual(marks, [
        ["req-gone", "failed"],
        ["req-closed", "undeliverable"],
        ["req-bad-id", "failed"],
        ["req-malformed", "failed"],
        ["req-pending", "failed"],
    ])
    // An invalid recipient is never looked up.
    assert.deepEqual(fetched, ["300000000000000003", USER])
    assert.ok(
        warnings.some(
            (warning) =>
                warning.context.requestId === "req-closed" &&
                warning.context.code === 50007
        )
    )
    // Logs carry IDs and codes, never names, reasons or user IDs.
    const logged = JSON.stringify(warnings)
    assert.equal(logged.includes(USER), false)
    assert.equal(logged.includes("Alpha"), false)
})

test("claim and confirmation failures never escape a pass", async () => {
    const claimFails = fakePorts({ claimed: new Error("convex down") })
    assert.deepEqual(await deliverTeamRequestNotifications(claimFails.ports), {
        sent: 0,
        failed: 0,
    })
    assert.equal(claimFails.warnings.length, 1)
    const markFails = fakePorts({
        claimed: [notification()],
        users: { [USER]: { sent: [] } },
        markFails: true,
    })
    assert.deepEqual(await deliverTeamRequestNotifications(markFails.ports), {
        sent: 0,
        failed: 0,
    })
    assert.equal(markFails.warnings.at(-1)?.context.outcome, "sent")
    const empty = fakePorts({ claimed: null })
    assert.deepEqual(await deliverTeamRequestNotifications(empty.ports), {
        sent: 0,
        failed: 0,
    })
})

test("the loop runs at once, on its interval, without overlap or escaping errors", async () => {
    let scheduled: (() => void) | null = null,
        interval = 0,
        unrefs = 0,
        cancelled = 0,
        runs = 0
    let release: () => void = () => {}
    const loop = startTeamRequestNotificationLoop(
        async () => {
            runs += 1
            if (runs === 1)
                await new Promise<void>((resolve) => (release = resolve))
            if (runs === 2) throw new Error("boom")
        },
        {
            intervalMs: 60_000,
            schedule: (tick, ms) => {
                scheduled = tick
                interval = ms
                return { unref: () => (unrefs += 1) }
            },
            cancel: () => (cancelled += 1),
        }
    )
    assert.equal(interval, 60_000)
    assert.equal(unrefs, 1)
    assert.equal(runs, 1)
    // A tick while the first pass is still running is skipped.
    await loop.tick()
    assert.equal(runs, 1)
    release()
    await new Promise((resolve) => setImmediate(resolve))
    // The interval callback runs the next pass; its failure is swallowed.
    assert.ok(scheduled)
    ;(scheduled as () => void)()
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(runs, 2)
    await loop.tick()
    assert.equal(runs, 3)
    loop.stop()
    assert.equal(cancelled, 1)
    await loop.tick()
    assert.equal(runs, 3)
})
