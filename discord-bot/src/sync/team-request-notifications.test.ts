import {
    buildTeamRequestDecisionMessage,
    deliverTeamRequestNotifications,
    startTeamRequestNotificationLoop,
    teamRequestLinks,
    type TeamRequestDecisionMessage,
    type TeamRequestNotification,
    type TeamRequestNotificationPorts,
} from "./team-request-notifications"
import { MessageFlags } from "discord.js"
import assert from "node:assert/strict"
import test from "node:test"

const USER = "100000000000000001"
const SITE = "https://logi.example"
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
    teamCode: "ALP",
    clanName: "Vlci",
    serverId: "k17abc",
    accentColor: null,
    ...overrides,
})

type Json = Record<string, unknown> & { components?: Json[] }
/** The container JSON, its accent, all text and all buttons of a DM. */
const cardOf = (message: TeamRequestDecisionMessage | null) => {
    assert.ok(message)
    assert.deepEqual(message.allowedMentions, { parse: [] })
    assert.equal(message.flags, MessageFlags.IsComponentsV2)
    assert.equal(message.embeds, undefined)
    const container = JSON.parse(
        JSON.stringify(
            (message.components as Array<{ toJSON(): unknown }>)[0]!.toJSON()
        )
    ) as Json & { accent_color: number }
    const flat: Json[] = []
    const walk = (node: Json) => {
        flat.push(node)
        for (const child of node.components ?? []) walk(child)
    }
    walk(container)
    return {
        accent: container.accent_color,
        text: flat
            .map((node) =>
                typeof node.content === "string" ? node.content : ""
            )
            .join("\n"),
        buttons: flat
            .filter((node) => node.type === 2)
            .map((node) => ({ label: node.label, url: node.url })),
    }
}

test("approved DMs are the clan card with the code, chip and team link (L5-39, L2-57)", () => {
    const card = cardOf(
        buildTeamRequestDecisionMessage(
            notification({
                language: "cs",
                gameId: "hell_let_loose",
                teamName: "Vlci",
                teamCode: "VLK",
            }),
            SITE
        )
    )
    assert.equal(card.accent, 0xe8a33d)
    assert.match(card.text, /-# \*\*KATALOG TÝMŮ LOGI · HELL LET LOOSE\*\*/)
    assert.match(card.text, /### Tým je v katalogu/)
    assert.match(card.text, /🟢 \*\*Schváleno\*\*/)
    assert.match(card.text, /`VLK` \*\*Vlci\*\* · nový tým/)
    assert.match(card.text, /Tým teď můžeš vybrat u zápasů\./)
    assert.match(
        card.text,
        /-# Klan Vlci · \[Nastavit zprávy\]\(https:\/\/logi\.example\/cs\/dashboard\/settings\/user#zpravy-od-bota\)/
    )
    assert.deepEqual(card.buttons, [
        {
            label: "Otevřít tým v Logi",
            url: "https://logi.example/cs/dashboard/servers/k17abc/teams?game=hell_let_loose",
        },
    ])
})

test("merged and rejected DMs follow the board, with the clan colour", () => {
    const merged = cardOf(
        buildTeamRequestDecisionMessage(
            notification({
                language: "cs",
                status: "merged",
                requestedName: "Rogue Co.",
                teamName: "Rogue Company",
                teamCode: "ROG",
                accentColor: "#123456",
            }),
            SITE
        )
    )
    assert.equal(merged.accent, 0x123456)
    assert.match(merged.text, /### Tým už v katalogu byl/)
    assert.match(
        merged.text,
        /`ROG` \*\*Rogue Company\*\* · žádal\(a\) jsi „Rogue Co\.“/
    )
    const rejected = cardOf(
        buildTeamRequestDecisionMessage(
            notification({
                language: "cs",
                status: "rejected",
                kind: "update",
                requestedName: "Black Dogs",
                teamName: "Black Dogs",
                reason: "Logo porušuje pravidla katalogu. Pošli prosím jiné.",
            }),
            SITE
        )
    )
    assert.match(rejected.text, /-# \*\*KATALOG TÝMŮ LOGI · WARDOGS\*\*/)
    assert.match(rejected.text, /### Žádost o tým nebyla přijata/)
    assert.match(rejected.text, /🔴 \*\*Zamítnuto\*\*/)
    assert.match(rejected.text, /Žádost o změnu · tým Black Dogs/)
    assert.match(
        rejected.text,
        /> Logo porušuje pravidla katalogu\. Pošli prosím jiné\./
    )
    assert.match(rejected.text, /Opravenou žádost pošleš v Logi → Týmy\./)
    assert.deepEqual(
        rejected.buttons.map((button) => button.label),
        ["Otevřít Týmy v Logi"]
    )
})

test("DMs use the requesting clan's language with an English fallback", () => {
    assert.match(
        cardOf(
            buildTeamRequestDecisionMessage(
                notification({ language: "de" }),
                SITE
            )
        ).text,
        /### Das Team ist im Katalog/
    )
    assert.match(
        cardOf(
            buildTeamRequestDecisionMessage(
                notification({ language: "xx" }),
                SITE
            )
        ).text,
        /### The team is in the catalogue/
    )
})

test("user-supplied text is escaped and cannot mention anyone", () => {
    const card = cardOf(
        buildTeamRequestDecisionMessage(
            notification({
                status: "rejected",
                requestedName: "**Bold** @everyone",
                teamName: null,
                reason: "See <@123456789012345678> and <#1> _now_",
            }),
            SITE
        )
    )
    assert.equal(card.text.includes("<@123456789012345678>"), false)
    assert.equal(card.text.includes("<#1>"), false)
    assert.match(card.text, /\\\*\\\*Bold\\\*\\\*/)
})

test("without a clan dashboard ID the DM has no team link", () => {
    assert.deepEqual(
        teamRequestLinks(
            { language: "cs", serverId: null, gameId: "wardogs" },
            SITE
        ),
        {
            teams: undefined,
            settings:
                "https://logi.example/cs/dashboard/settings/user#zpravy-od-bota",
        }
    )
    const card = cardOf(
        buildTeamRequestDecisionMessage(notification({ serverId: null }), SITE)
    )
    assert.deepEqual(card.buttons, [])
})

test("undecided statuses produce no message", () => {
    assert.equal(
        buildTeamRequestDecisionMessage(
            notification({ status: "pending" }),
            SITE
        ),
        null
    )
    assert.equal(
        buildTeamRequestDecisionMessage(
            notification({ status: "cancelled" }),
            SITE
        ),
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
        siteUrl: SITE,
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
