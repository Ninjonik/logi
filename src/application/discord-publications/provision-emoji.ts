type Emoji = { id: string; name: string | null }
type Asset = { name: string; image: string }
export type EmojiProvisioningPorts<A extends Asset = Asset> = {
    list(): Promise<Emoji[]>
    create(asset: A): Promise<Emoji>
}
/** Operator-only provisioning. No deletion, no guild emoji changes, no restart upload. */
export async function provisionEmoji(
    assets: Asset[],
    ports: EmojiProvisioningPorts
) {
    const existing = await ports.list()
    const result: Record<string, string> = {}
    for (const asset of assets) {
        const matches = existing.filter((e) => e.name === asset.name)
        if (matches.length > 1)
            throw new Error(
                "Duplicate application emoji names require operator reconciliation."
            )
        const emoji = matches[0] ?? (await ports.create(asset))
        result[asset.name] = emoji.id
    }
    return result
}

export type ProvisionedEmoji = { id: string; name: string }
export type EmojiProvisioningReport<K extends string> = {
    /** Installed emoji by registry key. */
    emoji: Partial<Record<K, ProvisionedEmoji>>
    created: K[]
    failed: K[]
}

/**
 * The bot's automatic provisioning of the fixed panel signs (P7-B03): lists
 * the application emoji once, reuses every exact name match and uploads only
 * what is missing, so a restart uploads nothing. One failed upload never
 * blocks the others; nothing is ever deleted. When two bot instances raced
 * and left the same name twice, the oldest (lowest ID) is used.
 */
export async function provisionApplicationEmoji<
    K extends string,
    A extends Asset & { key: K },
>(
    assets: readonly A[],
    ports: EmojiProvisioningPorts<A>
): Promise<EmojiProvisioningReport<K>> {
    const existing = await ports.list()
    const report: EmojiProvisioningReport<K> = {
        emoji: {},
        created: [],
        failed: [],
    }
    for (const asset of assets) {
        const found = existing
            .filter((e) => e.name === asset.name)
            .sort(
                (a, b) =>
                    a.id.length - b.id.length ||
                    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
            )[0]
        if (found) {
            report.emoji[asset.key] = { id: found.id, name: asset.name }
            continue
        }
        try {
            const created = await ports.create(asset)
            report.emoji[asset.key] = { id: created.id, name: asset.name }
            report.created.push(asset.key)
        } catch {
            report.failed.push(asset.key)
        }
    }
    return report
}

/** Discord markup of an application emoji: `<:name:id>`. */
export function emojiMarkup(emoji: ProvisionedEmoji): string {
    return `<:${emoji.name}:${emoji.id}>`
}
