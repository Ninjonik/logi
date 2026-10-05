import { providerKeySchema } from "../game-data/credentials"

/** An old stats server connection: a CRCON address and its API key. */
export type LegacyStatsServer = { url: string; token: string }

/** One game server to create from a legacy connection. */
export type LegacyStatsServerDraft = {
    source: {
        displayName: string
        gameId: "hell_let_loose"
        provider: "hll_crcon"
        origin: string
        providerServerId: string
    }
    /** The API key, to be encrypted before it leaves the web server. */
    key: string
}

/**
 * The game servers "Převést do Herních serverů" creates (N3-B09). The old
 * connections are Hell Let Loose CRCON player searches: each becomes a CRCON
 * source on the address's origin (server number 1), named after its host.
 * Connections that are not https, have no usable key or belong to another
 * game (a Wardogs or Vietnam exception) are skipped and counted.
 */
export function legacyStatsServerDrafts(input: {
    servers: readonly LegacyStatsServer[]
    exceptions: Readonly<
        Record<
            string,
            { playerStatsServers?: readonly LegacyStatsServer[] } | undefined
        >
    >
}): { drafts: LegacyStatsServerDraft[]; skipped: number } {
    const candidates = [
        ...input.servers,
        ...(input.exceptions.hell_let_loose?.playerStatsServers ?? []),
    ]
    let skipped = Object.entries(input.exceptions)
        .filter(([gameId]) => gameId !== "hell_let_loose")
        .reduce(
            (count, [, value]) =>
                count + (value?.playerStatsServers?.length ?? 0),
            0
        )
    const drafts: LegacyStatsServerDraft[] = []
    const names = new Map<string, number>()
    const origins = new Set<string>()
    for (const server of candidates) {
        let url: URL
        try {
            url = new URL(server.url.trim())
        } catch {
            skipped++
            continue
        }
        const key = providerKeySchema.safeParse(
            server.token.trim().replace(/^bearer\s+/i, "")
        )
        if (
            url.protocol !== "https:" ||
            url.username ||
            url.password ||
            !key.success
        ) {
            skipped++
            continue
        }
        // One CRCON per origin; a second path on the same host is the same server.
        if (origins.has(url.origin)) continue
        origins.add(url.origin)
        const base = url.hostname.slice(0, 72)
        const seen = names.get(base) ?? 0
        names.set(base, seen + 1)
        drafts.push({
            source: {
                displayName: seen ? `${base} ${seen + 1}` : base,
                gameId: "hell_let_loose",
                provider: "hll_crcon",
                origin: `${url.origin}/`,
                providerServerId: "1",
            },
            key: key.data,
        })
    }
    return { drafts, skipped }
}
