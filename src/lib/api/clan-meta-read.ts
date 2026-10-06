import { clanMetaFreshness, type ClanMetaCounts } from "@/domain/api/clan-meta"

/** What `publicApiReads:getClanMeta` returns for an accepted key. */
export type ClanMetaRead = {
    guild: { id: string; guildId: string; name: string }
    enabledGames: string[]
    /** Null until the first refresh stored the clan's summary. */
    counts: ClanMetaCounts | null
    computedAt: string | null
    updatedAt: string
}

/** What `clanMeta:refreshClanMeta` returns: the stored summary, or null for a key it rejects. */
export type ClanMetaRefresh = {
    counts: ClanMetaCounts
    computedAt: string
} | null

/** The meta as `/api/v1/clan/meta` serves it: counts always present. */
export type ClanApiMeta = Omit<ClanMetaRead, "counts" | "computedAt"> & {
    counts: ClanMetaCounts
    computedAt: string
}

export type ClanMetaPorts = {
    read(): Promise<ClanMetaRead | null>
    refresh(): Promise<ClanMetaRefresh>
    /** True when this process may fire the clan's refresh now. */
    claimRefresh(guildId: string, now: number): boolean
    now(): number
}

/**
 * Serves the stored summary and keeps it fresh off the request path. A clan
 * without a summary (the first call after a deploy) answers from a
 * synchronous refresh, so the website never sees an empty meta; a stale
 * summary is served as is while one refresh per clan and interval runs in
 * the background, throttled in this process and re-checked by the mutation.
 */
export async function readClanApiMeta(
    ports: ClanMetaPorts
): Promise<ClanApiMeta | null> {
    const meta = await ports.read()
    if (!meta) return null
    const { counts, computedAt, ...rest } = meta
    if (counts === null || computedAt === null) {
        const refreshed = await ports.refresh()
        return refreshed ? { ...rest, ...refreshed } : null
    }
    const now = ports.now()
    if (
        clanMetaFreshness(computedAt, now) !== "fresh" &&
        ports.claimRefresh(meta.guild.guildId, now)
    )
        void ports.refresh().catch(() => undefined)
    return { ...rest, counts, computedAt }
}
