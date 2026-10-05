/**
 * The seed messages the bot keeps in Discord, keyed in the shared managed
 * publications (`discordPublications`): the call of a run, the control
 * message of a server and the pinned intro of a seed channel.
 */
export type SeedMessageKind = "call" | "control" | "intro"

export function seedPublicationKey(kind: SeedMessageKind, key: string) {
    return `seed:${kind}:${key}`
}

export function parseSeedPublicationKey(
    value: string
): { kind: SeedMessageKind; key: string } | null {
    const match = /^seed:(call|control|intro):(.+)$/.exec(value)
    return match ? { kind: match[1] as SeedMessageKind, key: match[2]! } : null
}
