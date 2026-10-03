type Overwrite = { id: string; type: number; allow: string; deny: string }
export function canPublishChannel(
    guildId: string,
    botId: string,
    memberRoleIds: string[],
    roles: { id: string; permissions: string }[],
    overwrites: Overwrite[]
) {
    let permissions = roles
        .filter((r) => r.id === guildId || memberRoleIds.includes(r.id))
        .reduce((bits, r) => bits | BigInt(r.permissions), BigInt(0))
    if (permissions & BigInt(8)) return true
    const apply = (values: Overwrite[]) => {
        const deny = values.reduce(
            (bits, r) => bits | BigInt(r.deny),
            BigInt(0)
        )
        const allow = values.reduce(
            (bits, r) => bits | BigInt(r.allow),
            BigInt(0)
        )
        permissions = (permissions & ~deny) | allow
    }
    apply(overwrites.filter((r) => r.type === 0 && r.id === guildId))
    apply(
        overwrites.filter(
            (r) =>
                r.type === 0 && r.id !== guildId && memberRoleIds.includes(r.id)
        )
    )
    apply(overwrites.filter((r) => r.type === 1 && r.id === botId))
    const required =
        (BigInt(1) << BigInt(10)) |
        (BigInt(1) << BigInt(11)) |
        (BigInt(1) << BigInt(14)) |
        (BigInt(1) << BigInt(15)) |
        (BigInt(1) << BigInt(16))
    return (permissions & required) === required
}
