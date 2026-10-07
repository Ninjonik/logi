/**
 * The seed messages the bot keeps in Discord, keyed in the shared managed
 * publications (`discordPublications`): the call of a run, the control
 * message of a server and the pinned intro of a seed channel.
 */
export type SeedMessageKind = "call" | "control" | "intro"

/** `seed:`: every seed message of a guild, for a prefix read of the publications. */
export const SEED_PUBLICATION_KEY_PREFIX = "seed:"

/** `seed:<kind>:`: the seed messages of one kind. */
export function seedPublicationKeyPrefix(kind: SeedMessageKind) {
    return `${SEED_PUBLICATION_KEY_PREFIX}${kind}:`
}

export function seedPublicationKey(kind: SeedMessageKind, key: string) {
    return `${seedPublicationKeyPrefix(kind)}${key}`
}

export function parseSeedPublicationKey(
    value: string
): { kind: SeedMessageKind; key: string } | null {
    const match = /^seed:(call|control|intro):(.+)$/.exec(value)
    return match ? { kind: match[1] as SeedMessageKind, key: match[2]! } : null
}
