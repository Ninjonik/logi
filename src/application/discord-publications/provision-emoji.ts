type Emoji = { id: string; name: string | null }
type Asset = { name: string; image: string }
/** Operator-only provisioning. No deletion, no guild emoji changes, no restart upload. */
export async function provisionEmoji(
    assets: Asset[],
    ports: { list(): Promise<Emoji[]>; create(asset: Asset): Promise<Emoji> }
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
