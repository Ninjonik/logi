/**
 * Discord permission checks for the seed plan's channels and role, evaluated
 * from data the caller fetched (P3-12 "Bot může psát a označit roli @Seed.",
 * P3-22 "Kanál je soukromý ✓ · vidí ho jen správci.").
 */

const bit = (index: number) => BigInt(1) << BigInt(index)

export const SEED_DISCORD_PERMISSIONS = {
    administrator: bit(3),
    viewChannel: bit(10),
    sendMessages: bit(11),
    embedLinks: bit(14),
    attachFiles: bit(15),
    readMessageHistory: bit(16),
    mentionEveryone: bit(17),
    manageRoles: bit(28),
} as const

const P = SEED_DISCORD_PERMISSIONS
/** The same set the managed panels require. */
const PUBLISH =
    P.viewChannel |
    P.sendMessages |
    P.embedLinks |
    P.attachFiles |
    P.readMessageHistory
const ALL = ~BigInt(0)

export type DiscordOverwrite = {
    id: string
    /** 0 = role, 1 = member. */
    type: number
    allow: string
    deny: string
}
export type DiscordRole = {
    id: string
    permissions: string
    position: number
    mentionable: boolean
    managed: boolean
}

function basePermissions(
    guildId: string,
    memberRoleIds: readonly string[],
    roles: readonly DiscordRole[]
) {
    return roles
        .filter(
            (role) => role.id === guildId || memberRoleIds.includes(role.id)
        )
        .reduce((bits, role) => bits | BigInt(role.permissions), BigInt(0))
}

function applyOverwrites(
    permissions: bigint,
    overwrites: readonly DiscordOverwrite[]
) {
    const deny = overwrites.reduce(
        (bits, entry) => bits | BigInt(entry.deny),
        BigInt(0)
    )
    const allow = overwrites.reduce(
        (bits, entry) => bits | BigInt(entry.allow),
        BigInt(0)
    )
    return (permissions & ~deny) | allow
}

/** A member's effective permissions in a channel (Discord's documented order). */
export function channelPermissions(input: {
    guildId: string
    memberId: string
    memberRoleIds: readonly string[]
    roles: readonly DiscordRole[]
    overwrites: readonly DiscordOverwrite[]
}): bigint {
    let permissions = basePermissions(
        input.guildId,
        input.memberRoleIds,
        input.roles
    )
    if (permissions & P.administrator) return ALL
    permissions = applyOverwrites(
        permissions,
        input.overwrites.filter(
            (entry) => entry.type === 0 && entry.id === input.guildId
        )
    )
    permissions = applyOverwrites(
        permissions,
        input.overwrites.filter(
            (entry) =>
                entry.type === 0 &&
                entry.id !== input.guildId &&
                input.memberRoleIds.includes(entry.id)
        )
    )
    return applyOverwrites(
        permissions,
        input.overwrites.filter(
            (entry) => entry.type === 1 && entry.id === input.memberId
        )
    )
}

/** Whether `@everyone` can see the channel; a control channel must not be. */
export function everyoneCanView(
    guildId: string,
    roles: readonly DiscordRole[],
    overwrites: readonly DiscordOverwrite[]
): boolean {
    let permissions = basePermissions(guildId, [], roles)
    if (permissions & P.administrator) return true
    permissions = applyOverwrites(
        permissions,
        overwrites.filter((entry) => entry.type === 0 && entry.id === guildId)
    )
    return (permissions & P.viewChannel) === P.viewChannel
}

export type SeedChannelProblem =
    | "seed_channel_unpublishable"
    | "seed_role_missing"
    | "seed_role_not_mentionable"
    | "seed_role_unmanageable"
    | "control_channel_unpublishable"
    | "control_channel_public"

export type SeedChannelReport = {
    seedChannel: { canPublish: boolean; canMentionRole: boolean | null } | null
    controlChannel: { canPublish: boolean; private: boolean } | null
    role: { exists: boolean; canManage: boolean } | null
    problems: SeedChannelProblem[]
}

type ChannelInput = { overwrites: readonly DiscordOverwrite[] }

/**
 * Checks what the plan needs from Discord:
 * - the bot can publish in the seed channel and can mention the Seed role there
 *   (a role that is not mentionable needs "Mention @everyone");
 * - the bot can toggle the role when players turn it on themselves (Manage
 *   Roles and a higher top role; Discord-managed roles cannot be assigned);
 * - the bot can publish in the control channel and `@everyone` cannot view it.
 */
export function checkSeedChannels(input: {
    guildId: string
    bot: { id: string; roleIds: readonly string[] }
    roles: readonly DiscordRole[]
    seedChannel: ChannelInput | null
    controlChannel: ChannelInput | null
    roleId: string | null
    roleSelfService: boolean
}): SeedChannelReport {
    const problems: SeedChannelProblem[] = []
    const permissionsIn = (channel: ChannelInput) =>
        channelPermissions({
            guildId: input.guildId,
            memberId: input.bot.id,
            memberRoleIds: input.bot.roleIds,
            roles: input.roles,
            overwrites: channel.overwrites,
        })
    const role = input.roleId
        ? (input.roles.find((entry) => entry.id === input.roleId) ?? null)
        : null
    if (input.roleId && !role) problems.push("seed_role_missing")
    let seedChannel: SeedChannelReport["seedChannel"] = null
    if (input.seedChannel) {
        const permissions = permissionsIn(input.seedChannel)
        const canPublish = (permissions & PUBLISH) === PUBLISH
        const canMentionRole = role
            ? role.mentionable ||
              (permissions & P.mentionEveryone) === P.mentionEveryone
            : null
        if (!canPublish) problems.push("seed_channel_unpublishable")
        if (canMentionRole === false) problems.push("seed_role_not_mentionable")
        seedChannel = { canPublish, canMentionRole }
    }
    let roleReport: SeedChannelReport["role"] = null
    if (input.roleId) {
        const guildPermissions = basePermissions(
            input.guildId,
            input.bot.roleIds,
            input.roles
        )
        const top = Math.max(
            0,
            ...input.roles
                .filter((entry) => input.bot.roleIds.includes(entry.id))
                .map((entry) => entry.position)
        )
        const canManage = Boolean(
            role &&
            !role.managed &&
            role.id !== input.guildId &&
            (guildPermissions & (P.manageRoles | P.administrator)) !==
                BigInt(0) &&
            role.position < top
        )
        if (role && input.roleSelfService && !canManage)
            problems.push("seed_role_unmanageable")
        roleReport = { exists: Boolean(role), canManage }
    }
    let controlChannel: SeedChannelReport["controlChannel"] = null
    if (input.controlChannel) {
        const canPublish =
            (permissionsIn(input.controlChannel) & PUBLISH) === PUBLISH
        const isPrivate = !everyoneCanView(
            input.guildId,
            input.roles,
            input.controlChannel.overwrites
        )
        if (!canPublish) problems.push("control_channel_unpublishable")
        if (!isPrivate) problems.push("control_channel_public")
        controlChannel = { canPublish, private: isPrivate }
    }
    return { seedChannel, controlChannel, role: roleReport, problems }
}
