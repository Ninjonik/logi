import { PermissionFlagsBits } from "discord.js"
import assert from "node:assert/strict"
import test from "node:test"

import {
    attendeesViewFor,
    isMatchLeadership,
    type AttendeesData,
} from "./attendees"
import { layoutMessageView } from "../../../src/domain/discord-messages/message-layout"
import type { MessageView } from "../../../src/domain/discord-messages/message-view"
import { boardConfig, boardEvent, withLimits } from "./board-example.fixture"
import { messageKitLayoutOptions } from "../ui/message-kit"

function fakeClient(member: {
    administrator?: boolean
    roles?: string[]
    fails?: boolean
}) {
    const calls: string[] = []
    const client = {
        guilds: {
            fetch: async (guildId: string) => {
                calls.push(`guild:${guildId}`)
                if (member.fails) throw new Error("unavailable")
                return {
                    roles: {
                        fetch: async () => {
                            calls.push("roles")
                        },
                    },
                    members: {
                        fetch: async (options: {
                            user: string
                            force: boolean
                        }) => {
                            calls.push(
                                `member:${options.user}:${options.force}`
                            )
                            return {
                                permissions: {
                                    has: (flag: bigint) =>
                                        flag ===
                                            PermissionFlagsBits.Administrator &&
                                        Boolean(member.administrator),
                                },
                                roles: {
                                    cache: new Map(
                                        (member.roles ?? []).map((role) => [
                                            role,
                                            {},
                                        ])
                                    ),
                                },
                            }
                        },
                    },
                }
            },
        },
    }
    return { client: client as never, calls }
}

test("leadership is the Logi admin role or Administrator, read fresh at the click (L1-86, L1-B09)", async () => {
    const admin = fakeClient({ roles: ["admin-role"] })
    assert.equal(
        await isMatchLeadership(admin.client, "g", "u", "admin-role"),
        true
    )
    assert.deepEqual(admin.calls, ["guild:g", "roles", "member:u:true"])
    assert.equal(
        await isMatchLeadership(
            fakeClient({ administrator: true }).client,
            "g",
            "u",
            null
        ),
        true
    )
    assert.equal(
        await isMatchLeadership(
            fakeClient({ roles: ["member"] }).client,
            "g",
            "u",
            "admin-role"
        ),
        false
    )
    // Without a configured role only Administrators lead.
    assert.equal(
        await isMatchLeadership(
            fakeClient({ roles: ["admin-role"] }).client,
            "g",
            "u",
            undefined
        ),
        false
    )
    // Anything unreadable is not leadership.
    assert.equal(
        await isMatchLeadership(
            fakeClient({ fails: true }).client,
            "g",
            "u",
            "admin-role"
        ),
        false
    )
})

const data: AttendeesData = {
    config: { ...boardConfig, dashboardAdminRoleId: "admin-role" },
    event: withLimits(
        boardEvent({
            status: "closed",
            participants: [
                {
                    userId: "kowalski",
                    status: "attending",
                    group: "Pěchota",
                    updatedAt: "2026-10-05T16:04:00.000Z",
                },
                {
                    userId: "kos",
                    status: "not_attending",
                    group: null,
                    updatedAt: "2026-10-06T16:04:00.000Z",
                },
            ],
            absenceNotices: [
                {
                    userId: "kos",
                    reason: "nemoc",
                    createdAt: "x",
                    kind: "cannot_come",
                },
            ],
        })
    ),
    category: { label: "Přátelák", color: "#3BA55C" },
    groups: [
        { id: "inf", name: "Pěchota" },
        { id: "tank", name: "Tanky" },
        { id: "recon", name: "Recon" },
    ],
    memberships: [{ userId: "kowalski", membership: "member" }],
    signedUpAt: [{ userId: "kowalski", at: "2026-10-05T16:04:00.000Z" }],
    names: [
        { userId: "kowalski", name: "Kowalski" },
        { userId: "kos", name: "Kos" },
        { userId: "sokol", name: "Sokol" },
    ],
    unanswered: { userIds: ["sokol"], unavailable: "signups_closed" },
}

function text(view: MessageView) {
    return layoutMessageView(view, messageKitLayoutOptions({ language: "cs" }))
        .nodes.flatMap((node) =>
            node.type === "text"
                ? [node.content]
                : node.type === "buttons"
                  ? node.buttons.map(
                        (button) =>
                            `[${button.label}${button.disabled ? " off" : ""}${button.kind === "link" ? ` ${button.url}` : ""}]`
                    )
                  : []
        )
        .join("\n")
}

const names = new Map(data.names.map((entry) => [entry.userId, entry.name]))

test("members see the list without reasons or admin actions", () => {
    const body = text(
        attendeesViewFor(data, {
            leadership: false,
            filter: { kind: "unanswered" },
            page: 1,
            names,
            now: new Date("2026-10-10T18:00:00.000Z"),
        })
    )
    assert.match(body, /### Přihlášení · VLK vs ROG · Přátelák/)
    assert.match(body, /1\. \*\*Kowalski\*\* · 🟢 Člen/)
    assert.match(body, /\*\*Nepřijdou \(1\)\*\*\nKos$/m)
    assert.doesNotMatch(body, /nemoc|Sokol|Připomenout|Otevřít na webu/)
})

test("leadership sees reasons, Bez odpovědi and a link to the match's attendance page", () => {
    const body = text(
        attendeesViewFor(data, {
            leadership: true,
            filter: { kind: "all" },
            page: 1,
            names,
            now: new Date("2026-10-10T18:00:00.000Z"),
        })
    )
    assert.match(body, /\*\*Kos\*\* · nemoc/)
    assert.match(body, /Bez odpovědi \(1\)\*\* · .*\nSokol/)
    // Sign-ups are closed, so there is nobody to remind now.
    assert.match(body, /\[Připomenout bez odpovědi off\]/)
    assert.match(
        body,
        /\[Otevřít na webu https?:\/\/[^\s\]]+\/cs\/dashboard\/servers\/111111111111111111\/matches\/event-1\?tab=attendance\]/
    )
})
