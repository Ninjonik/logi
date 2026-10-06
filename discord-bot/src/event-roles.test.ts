import assert from "node:assert/strict"
import test from "node:test"

import type { Guild } from "discord.js"

import type { ClanErrorReportInput } from "./error-reporting"
import { eventRoleName, syncEventRoles } from "./event-roles"
import type { EventRecord } from "./types"

const PLAYERS_ROLE = "300000000000000001"
const RESERVES_ROLE = "300000000000000002"

/** A server where the bot may not hand out `refusedRole` (it sits above Logi). */
function fakeGuild(refusedRole: string) {
    const role = (id: string, name: string) => ({
        id,
        name,
        members: new Map(),
        setName: async () => undefined,
    })
    const roles = new Map([
        [PLAYERS_ROLE, role(PLAYERS_ROLE, "VLK vs ROG · Hráči")],
        [RESERVES_ROLE, role(RESERVES_ROLE, "VLK vs ROG · Zálohy")],
    ])
    const member = (id: string) => ({
        id,
        roles: {
            cache: new Map(),
            add: async (roleId: string) => {
                if (roleId === refusedRole)
                    throw Object.assign(new Error("Missing Permissions"), {
                        code: 50013,
                        status: 403,
                    })
            },
            remove: async () => undefined,
        },
    })
    return {
        id: "200000000000000001",
        client: {},
        roles: { fetch: async (id: string) => roles.get(id) ?? null },
        members: {
            fetch: async () =>
                new Map(
                    ["100000000000000001", "100000000000000002"].map((id) => [
                        id,
                        member(id),
                    ])
                ),
        },
    } as unknown as Guild
}

const snapshot = (name: string, shortCode: string) => ({
    name,
    shortCode,
    logoAssetId: null,
    logoUrl: null,
    teamRevision: 1,
    capturedAt: "",
})

const event = {
    name: "Liga 4",
    matchTeams: [
        {
            teamId: "a",
            slot: "a" as const,
            side: "Allies",
            snapshot: snapshot("Vlci", "VLK"),
        },
        {
            teamId: "b",
            slot: "b" as const,
            side: "Axis",
            snapshot: snapshot("Rogue", "ROG"),
        },
    ],
}

test("match roles are named after the match with the suffix in the clan language", () => {
    assert.equal(eventRoleName(event, "players", "cs"), "VLK vs ROG · Hráči")
    assert.equal(eventRoleName(event, "reserves", "cs"), "VLK vs ROG · Zálohy")
    assert.equal(eventRoleName(event, "players", "en"), "VLK vs ROG · Players")
    assert.equal(
        eventRoleName({ name: "Trénink obrany" }, "reserves", "de"),
        "Trénink obrany · Reserve"
    )
    assert.ok(
        eventRoleName({ name: "x".repeat(200) }, "players", "cs").length <= 100
    )
})

test("a match role Discord refuses is reported once with the role and the match (L5-19)", async () => {
    const reports: ClanErrorReportInput[] = []
    const record = {
        ...event,
        id: "k17event",
        status: "registration",
        attendeeRoleId: PLAYERS_ROLE,
        reserveRoleId: RESERVES_ROLE,
        participants: [
            { userId: "100000000000000001", status: "attending" },
            { userId: "100000000000000002", status: "attending" },
        ],
    } as unknown as EventRecord
    const result = await syncEventRoles(
        fakeGuild(PLAYERS_ROLE),
        record,
        null,
        "cs",
        async (input) => {
            reports.push(input)
        }
    )
    assert.deepEqual(result, {
        attendeeRoleId: PLAYERS_ROLE,
        reserveRoleId: RESERVES_ROLE,
    })
    assert.equal(reports.length, 1, "one report for the role, not per member")
    assert.equal(reports[0]?.source, "eventRoles")
    assert.equal(reports[0]?.eventId, "k17event")
    assert.equal(reports[0]?.roleId, PLAYERS_ROLE)
    assert.equal((reports[0]?.error as { code?: number }).code, 50013)

    // Something that passes by itself (a member who left) is not reported.
    const quiet: ClanErrorReportInput[] = []
    const guild = fakeGuild("none")
    const members = await guild.members.fetch()
    for (const member of members.values())
        Object.assign(member.roles, {
            add: async () => {
                throw Object.assign(new Error("Unknown Member"), {
                    code: 10007,
                    status: 404,
                })
            },
        })
    Object.assign(guild.members, { fetch: async () => members })
    await syncEventRoles(guild, record, null, "cs", async (input) => {
        quiet.push(input)
    })
    assert.deepEqual(quiet, [])
})
