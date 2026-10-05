import {
    MEMBER_COMMANDS,
    STAFF_COMMANDS,
    type CommandAudience,
    type ConfigurableCommand,
    type LogiCommand,
} from "./catalog"
import type { ResolvedCommandSettings } from "./command-settings"

/**
 * The one permission model of every Logi command (M1 1.2): three groups,
 * the same for all commands, checked on every use from facts the bot reads
 * freshly from Discord (the member, its roles and the guild's roles), never
 * from a cache. Content rules stay with each command (`/stats` only enabled
 * games, `/notice` only the person's own events, `/link` only own accounts).
 */

/** What Discord says about the person, read at the moment of use. */
export type CommandCaller = {
    /** Discord's Administrator permission in this server. */
    isAdministrator: boolean
    /** The person's current role IDs in this server. */
    roleIds: readonly string[]
}

/** The clan's settings the matrix needs; read from Logi, not from Discord. */
export type CommandAccessConfig = {
    /** The "Role správců" from Nastavení → Role a přístup. */
    dashboardAdminRoleId?: string | null
    /** The clan role and any per-game clan roles. */
    clanRoleIds: readonly string[]
    /** Roles answering tickets ("Kdo odpovídá") in any ticket category. */
    ticketSupportRoleIds: readonly string[]
    /** Roles handling applications ("Kdo žádosti vyřizuje") in any category. */
    membershipSupportRoleIds: readonly string[]
    ticketsEnabled: boolean
    membershipEnabled: boolean
    settings: ResolvedCommandSettings
}

const hasAny = (roleIds: readonly string[], wanted: readonly string[]) =>
    wanted.some((roleId) => roleIds.includes(roleId))

/**
 * "Správci Logi": Discord Administrator or the Logi admin role, the same
 * group as on the web (M1-24).
 */
export function isLogiAdmin(
    caller: CommandCaller,
    config: Pick<CommandAccessConfig, "dashboardAdminRoleId">
) {
    return (
        caller.isAdministrator ||
        Boolean(
            config.dashboardAdminRoleId &&
            caller.roleIds.includes(config.dashboardAdminRoleId)
        )
    )
}

/** "Členové klanu": the clan role from Role a přístup, or a Logi manager. */
export function isClanMember(
    caller: CommandCaller,
    config: Pick<CommandAccessConfig, "dashboardAdminRoleId" | "clanRoleIds">
) {
    return (
        isLogiAdmin(caller, config) ||
        hasAny(caller.roleIds, config.clanRoleIds)
    )
}

/** Whether the person belongs to a command's group or one of its extra roles. */
export function inAudience(
    caller: CommandCaller,
    config: Pick<CommandAccessConfig, "dashboardAdminRoleId" | "clanRoleIds">,
    audience: CommandAudience,
    extraRoleIds: readonly string[]
) {
    if (audience === "everyone") return true
    if (hasAny(caller.roleIds, extraRoleIds)) return true
    return audience === "clanMembers"
        ? isClanMember(caller, config)
        : isLogiAdmin(caller, config)
}

export type CommandDecision =
    | { kind: "allowed" }
    /** The clan switched the command off (N3-B04). */
    | { kind: "disabled" }
    /** "nepovoleno": the person is outside the command's group. */
    | {
          kind: "notAllowed"
          audience: CommandAudience
          roleIds: readonly string[]
      }
    /** "jinde": the command works only in these channels (N3-B05). */
    | { kind: "wrongChannel"; channelIds: readonly string[] }

/**
 * Whether the person may use a configurable command here and now. The
 * channel of a thread is its parent: a command allowed in #statistiky also
 * works in that channel's threads.
 */
export function decideCommandUse(
    command: ConfigurableCommand,
    input: {
        caller: CommandCaller
        config: CommandAccessConfig
        channelId: string | null
        parentChannelId?: string | null
    }
): CommandDecision {
    const entry = input.config.settings[command]
    if (!entry.enabled) return { kind: "disabled" }
    if (!inAudience(input.caller, input.config, entry.audience, entry.roleIds))
        return {
            kind: "notAllowed",
            audience: entry.audience,
            roleIds: entry.roleIds,
        }
    if (
        entry.channelIds.length &&
        !entry.channelIds.some(
            (channelId) =>
                channelId === input.channelId ||
                channelId === input.parentChannelId
        )
    )
        return { kind: "wrongChannel", channelIds: entry.channelIds }
    return { kind: "allowed" }
}

/** Why the staff part of `/help` is shown (the line under "PRO SPRÁVCE"). */
export type StaffReason = "administrator" | "adminRole" | "support" | "role"

export type HelpCommandList = {
    members: LogiCommand[]
    staff: LogiCommand[]
    staffReason: StaffReason | null
}

/**
 * Commands for Logi's managers: the "(pro správce)" suffix (N3-B07). Extra
 * roles added on top (N3-19 "@Velení") keep the command a managers' one.
 */
export function isManagerOnlyCommand(
    command: LogiCommand,
    settings: ResolvedCommandSettings
) {
    if (command === "close_ticket" || command === "close_application")
        return false
    return settings[command].audience === "logiAdmins"
}

/**
 * What `/help` lists for the person (M1-B05, M2-11): only the commands they
 * may use and that are switched on. Category support sees only the closing
 * command that applies to it. Channel limits do not hide a command; using it
 * elsewhere explains where it works.
 */
export function helpCommandsFor(
    caller: CommandCaller,
    config: CommandAccessConfig
): HelpCommandList {
    const may = (command: ConfigurableCommand) => {
        const entry = config.settings[command]
        return (
            entry.enabled &&
            inAudience(caller, config, entry.audience, entry.roleIds)
        )
    }
    const admin = isLogiAdmin(caller, config)
    const ticketSupport =
        config.ticketsEnabled &&
        (admin || hasAny(caller.roleIds, config.ticketSupportRoleIds))
    const membershipSupport =
        config.membershipEnabled &&
        (admin || hasAny(caller.roleIds, config.membershipSupportRoleIds))

    // Commands a clan restricts to its managers move to the staff part.
    const staffOnly = (command: ConfigurableCommand) =>
        config.settings[command].audience === "logiAdmins"
    const members: LogiCommand[] = MEMBER_COMMANDS.filter(
        (command) => command !== "help" && may(command) && !staffOnly(command)
    )
    const staff: LogiCommand[] = [
        ...MEMBER_COMMANDS.filter(
            (command) =>
                command !== "help" && may(command) && staffOnly(command)
        ),
        ...STAFF_COMMANDS.filter((command) =>
            command === "close_ticket"
                ? ticketSupport
                : command === "close_application"
                  ? membershipSupport
                  : may(command)
        ),
    ]
    let staffReason: StaffReason | null = null
    if (staff.length)
        staffReason = caller.isAdministrator
            ? "administrator"
            : admin
              ? "adminRole"
              : ticketSupport || membershipSupport
                ? "support"
                : "role"
    return { members, staff, staffReason }
}
