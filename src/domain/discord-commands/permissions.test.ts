import assert from "node:assert/strict"
import test from "node:test"

import {
    decideCommandUse,
    helpCommandsFor,
    inAudience,
    isClanMember,
    isLogiAdmin,
    isManagerOnlyCommand,
    type CommandAccessConfig,
    type CommandCaller,
} from "./permissions"
import {
    DEFAULT_COMMAND_SETTINGS,
    resolveCommandSettings,
} from "./command-settings"

const ADMIN_ROLE = "100000000000000001"
const CLAN_ROLE = "100000000000000002"
const TICKET_SUPPORT = "100000000000000003"
const RECRUITERS = "100000000000000004"
const LEADS = "100000000000000005"
const STATS_CHANNEL = "200000000000000001"
const BOT_CHANNEL = "200000000000000002"

const config = (
    settings = DEFAULT_COMMAND_SETTINGS,
    overrides: Partial<CommandAccessConfig> = {}
): CommandAccessConfig => ({
    dashboardAdminRoleId: ADMIN_ROLE,
    clanRoleIds: [CLAN_ROLE],
    ticketSupportRoleIds: [TICKET_SUPPORT],
    membershipSupportRoleIds: [RECRUITERS],
    ticketsEnabled: true,
    membershipEnabled: true,
    settings,
    ...overrides,
})
const caller = (
    roleIds: string[] = [],
    isAdministrator = false
): CommandCaller => ({ isAdministrator, roleIds })

test("Správci Logi are Discord Administrators or holders of the Logi admin role (M1-24)", () => {
    assert.equal(isLogiAdmin(caller([], true), config()), true)
    assert.equal(isLogiAdmin(caller([ADMIN_ROLE]), config()), true)
    assert.equal(isLogiAdmin(caller([CLAN_ROLE]), config()), false)
    assert.equal(
        isLogiAdmin(caller([ADMIN_ROLE]), { dashboardAdminRoleId: null }),
        false,
        "no admin role configured means only Administrator"
    )
})

test("clan members have a clan role; managers count as members", () => {
    assert.equal(isClanMember(caller([CLAN_ROLE]), config()), true)
    assert.equal(isClanMember(caller([ADMIN_ROLE]), config()), true)
    assert.equal(isClanMember(caller([]), config()), false)
})

test("extra roles widen a restricted group, never the other way round (N3-15)", () => {
    assert.equal(
        inAudience(caller([LEADS]), config(), "logiAdmins", [LEADS]),
        true
    )
    assert.equal(inAudience(caller([]), config(), "logiAdmins", [LEADS]), false)
    assert.equal(inAudience(caller([]), config(), "everyone", []), true)
})

test("/server-status is for Logi managers by default, read from fresh facts (M1-B07, M3-21)", () => {
    const decide = (who: CommandCaller) =>
        decideCommandUse("server-status", {
            caller: who,
            config: config(),
            channelId: STATS_CHANNEL,
        })
    assert.deepEqual(decide(caller([ADMIN_ROLE])), { kind: "allowed" })
    assert.deepEqual(decide(caller([], true)), { kind: "allowed" })
    assert.deepEqual(decide(caller([CLAN_ROLE])), {
        kind: "notAllowed",
        audience: "logiAdmins",
        roleIds: [],
    })
})

test("a switched-off command is refused before the group (N3-B04)", () => {
    const settings = resolveCommandSettings(
        { player: { enabled: false } },
        true
    )
    assert.deepEqual(
        decideCommandUse("player", {
            caller: caller([], true),
            config: config(settings),
            channelId: STATS_CHANNEL,
        }),
        { kind: "disabled" }
    )
})

test("a channel limit answers where the command works; threads use their parent (N3-B05)", () => {
    const settings = resolveCommandSettings(
        { stats: { channelIds: [STATS_CHANNEL, BOT_CHANNEL] } },
        true
    )
    const decide = (channelId: string, parentChannelId?: string) =>
        decideCommandUse("stats", {
            caller: caller(),
            config: config(settings),
            channelId,
            parentChannelId,
        })
    assert.deepEqual(decide(STATS_CHANNEL), { kind: "allowed" })
    assert.deepEqual(decide("300000000000000001", BOT_CHANNEL), {
        kind: "allowed",
    })
    assert.deepEqual(decide("300000000000000002"), {
        kind: "wrongChannel",
        channelIds: [STATS_CHANNEL, BOT_CHANNEL],
    })
})

test("/help lists only what the person may use, with a staff part (M1-B05, M2-11)", () => {
    const member = helpCommandsFor(caller([CLAN_ROLE]), config())
    assert.deepEqual(member.members, ["stats", "player", "link", "notice"])
    assert.deepEqual(member.staff, [])
    assert.equal(member.staffReason, null)

    const admin = helpCommandsFor(caller([ADMIN_ROLE]), config())
    assert.deepEqual(admin.members, ["stats", "player", "link", "notice"])
    assert.deepEqual(admin.staff, [
        "server-status",
        "close_ticket",
        "close_application",
    ])
    assert.equal(admin.staffReason, "adminRole")
    assert.equal(
        helpCommandsFor(caller([], true), config()).staffReason,
        "administrator"
    )
})

test("category support sees only the closing command that applies to it (M2-11)", () => {
    const support = helpCommandsFor(caller([TICKET_SUPPORT]), config())
    assert.deepEqual(support.staff, ["close_ticket"])
    assert.equal(support.staffReason, "support")
    const recruiter = helpCommandsFor(caller([RECRUITERS]), config())
    assert.deepEqual(recruiter.staff, ["close_application"])
    const ticketsOff = helpCommandsFor(
        caller([TICKET_SUPPORT]),
        config(DEFAULT_COMMAND_SETTINGS, { ticketsEnabled: false })
    )
    assert.deepEqual(
        ticketsOff.staff,
        [],
        "close commands follow Tickety (N3-B06)"
    )
})

test("switched-off commands and commands restricted to managers move or disappear", () => {
    const settings = resolveCommandSettings(
        {
            stats: { audience: "logiAdmins" },
            link: { enabled: false },
            serverStatus: { audience: "logiAdmins", roleIds: [LEADS] },
        },
        true
    )
    const member = helpCommandsFor(caller([CLAN_ROLE]), config(settings))
    assert.deepEqual(member.members, ["player", "notice"])
    const lead = helpCommandsFor(caller([LEADS]), config(settings))
    assert.deepEqual(lead.staff, ["server-status"])
    assert.equal(lead.staffReason, "role")
    const admin = helpCommandsFor(caller([ADMIN_ROLE]), config(settings))
    assert.deepEqual(admin.staff.slice(0, 2), ["stats", "server-status"])
})

test("the managers' suffix belongs to commands for Logi managers only (N3-B07)", () => {
    assert.equal(
        isManagerOnlyCommand("server-status", DEFAULT_COMMAND_SETTINGS),
        true
    )
    assert.equal(isManagerOnlyCommand("stats", DEFAULT_COMMAND_SETTINGS), false)
    assert.equal(
        isManagerOnlyCommand("close_ticket", DEFAULT_COMMAND_SETTINGS),
        false
    )
})
