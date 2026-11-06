import {
    assertGuestRosterEdit,
    assertUniqueRosterPlayers,
    rosterRevisionTimestamp,
} from "./shared-roster"
import { participantClan, validateRequestedRoles } from "../events/shared-match"
import { localRosterLists, canReadSharedRosterPassword } from "./local-audience"
import { sharedRosterUser } from "./shared-roster-user"
import type { AppUser } from "../../types/domain"
import type { RosterLike } from "./types"
import assert from "node:assert/strict"
import test from "node:test"

function roster(): RosterLike {
    return {
        squads: [
            {
                name: "Alpha",
                group: "Infantry",
                color: "#fff",
                order: 0,
                players: [
                    { id: "host-player", ack: false },
                    {
                        allocatedGuildId: "guest",
                        id: "guest-player",
                        ack: false,
                    },
                ],
            },
        ],
        reservePlayerIds: [],
        notAttendingPlayerIds: [],
        published: false,
    }
}

test("a guest can replace the host's choice in its unlocked slot without changing its allocation", () => {
    const before = roster()
    const after = structuredClone(before)
    after.squads[0].players[1].id = "replacement"
    assert.doesNotThrow(() =>
        assertGuestRosterEdit({
            hostGuildId: "host",
            actorGuildId: "guest",
            before,
            after,
            eligibleUserIds: new Set(["replacement"]),
        })
    )
    assert.equal(before.squads[0].players[1].id, "guest-player")
    before.squads[0].players[1].locked = true
    assert.throws(
        () =>
            assertGuestRosterEdit({
                hostGuildId: "host",
                actorGuildId: "guest",
                before,
                after,
                eligibleUserIds: new Set(["replacement"]),
            }),
        /read-only/
    )
})

test("JSON property order does not turn unchanged foreign slots into edits", () => {
    const before = roster()
    const after = structuredClone(before)
    after.squads[0].players[0] = { ack: false, id: "host-player" }
    assert.doesNotThrow(() =>
        assertGuestRosterEdit({
            hostGuildId: "host",
            actorGuildId: "guest",
            before,
            after,
            eligibleUserIds: new Set(["guest-player"]),
        })
    )
})

test("a player cannot occupy two shared slots", () => {
    const value = roster()
    value.squads[0].players[1].id = "host-player"
    assert.throws(() => assertUniqueRosterPlayers(value), /only one slot/)
})

test("Discord local lists keep the whole squad layout and only local reserves and declines", () => {
    const value = {
        ...roster(),
        localPlayerIds: ["guest-player"],
        reservePlayerIds: ["host-player", "guest-player"],
        notAttendingPlayerIds: ["host-decline"],
    }
    const local = localRosterLists(value)
    assert.deepEqual(local.squads, value.squads)
    assert.deepEqual(local.reservePlayerIds, ["guest-player"])
    assert.deepEqual(local.notAttendingPlayerIds, [])
    assert.deepEqual(value.reservePlayerIds, ["host-player", "guest-player"])
})

test("shared roster revisions advance even for concurrent millisecond writes", () => {
    const now = new Date("2026-11-06T12:00:00.000Z")
    assert.equal(
        rosterRevisionTimestamp(now.toISOString(), now),
        "2026-11-06T12:00:00.001Z"
    )
    assert.equal(rosterRevisionTimestamp(undefined, now), now.toISOString())
})

test("main clan takes priority only when it participates and requested roles are bounded", () => {
    assert.equal(
        participantClan({
            mainGuildId: "main",
            participatingGuildIds: ["main", "guest"],
            selectedGuildId: "guest",
        }),
        "main"
    )
    assert.equal(
        participantClan({
            mainGuildId: "other",
            participatingGuildIds: ["host", "guest"],
            selectedGuildId: "guest",
        }),
        "guest"
    )
    assert.throws(() =>
        participantClan({
            participatingGuildIds: ["host"],
            selectedGuildId: "stranger",
        })
    )
    assert.deepEqual(
        validateRequestedRoles([{ role: " Infantry ", count: 5 }]),
        [{ role: "Infantry", count: 5 }]
    )
    for (const count of [0, -1, 1.5, 501])
        assert.throws(() =>
            validateRequestedRoles([{ role: "Infantry", count }])
        )
})

test("foreign roster identities do not expose private account or clan membership data", () => {
    const user: AppUser = {
        id: "player",
        discordId: "discord",
        name: "Player",
        avatar: "avatar",
        hasDiscordLink: true,
        isStreamer: false,
        nicknames: { private: "nickname" },
        platformIds: ["private-platform-id"],
        managedGuildIds: ["private-admin-clan"],
        mercenaryGuildIds: ["private-clan"],
        scores: { private: 42 },
        note: "private member note",
        defaultWorkspaceId: "private-workspace",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
    }
    const foreign = sharedRosterUser(user, false)
    assert.equal(foreign.name, user.name)
    assert.equal(foreign.note, undefined)
    assert.equal(foreign.defaultWorkspaceId, undefined)
    assert.deepEqual(foreign.platformIds, [])
    assert.deepEqual(foreign.scores, {})
    assert.deepEqual(foreign.managedGuildIds, [])
    assert.equal(sharedRosterUser(user, true), user)
})

test("guest managers and unassigned members do not receive the host password in draft or live roster props", () => {
    const value = { ...roster(), localPlayerIds: ["guest-player"] }
    assert.equal(
        canReadSharedRosterPassword({
            hostAdmin: false,
            userId: "guest-player",
            roster: value,
        }),
        false
    )
    value.published = true
    assert.equal(
        canReadSharedRosterPassword({
            hostAdmin: false,
            userId: "guest-player",
            roster: value,
        }),
        true
    )
    assert.equal(
        canReadSharedRosterPassword({
            hostAdmin: false,
            userId: "guest-admin",
            roster: value,
        }),
        false
    )
    assert.equal(
        canReadSharedRosterPassword({
            hostAdmin: false,
            userId: "host-player",
            roster: value,
        }),
        false
    )
    assert.equal(
        canReadSharedRosterPassword({
            hostAdmin: true,
            userId: "host-admin",
            roster: null,
        }),
        true
    )
})
