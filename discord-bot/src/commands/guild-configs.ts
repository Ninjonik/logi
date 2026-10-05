import {
    guildCommandConfigSchema,
    type GuildCommandConfig,
} from "../../../src/domain/discord-commands/guild-config"

/** Where the live command settings come from (Convex in production). */
export type GuildConfigSource = {
    /** One read of every configured server. */
    list(): Promise<unknown>
    /** Subscribes to changes; returns the unsubscribe function. */
    watch(onRows: (rows: unknown) => void): () => void
}

const FALLBACK_READ_MS = 1_500

/**
 * Every configured server's command settings, kept current by a live Convex
 * query (`discordCommands:listGuildConfigs`). A language change, saved
 * settings or a "Znovu zaregistrovat" request reaches the bot within
 * seconds. Discord facts (members, roles) are never cached here.
 */
export class GuildCommandConfigs {
    private configs = new Map<string, GuildCommandConfig>()
    private signatures = new Map<string, string>()
    private loaded = false
    private unsubscribe?: () => void

    constructor(private readonly source: GuildConfigSource) {}

    /** Starts the subscription; `onChange` receives the changed server IDs. */
    start(onChange: (guildIds: string[]) => void) {
        this.unsubscribe?.()
        this.unsubscribe = this.source.watch((rows) => {
            const changed = this.apply(rows)
            if (changed.length) onChange(changed)
        })
    }

    stop() {
        this.unsubscribe?.()
        this.unsubscribe = undefined
    }

    /** Replaces the known configs; returns the servers whose config changed. */
    apply(rows: unknown): string[] {
        if (!Array.isArray(rows)) return []
        const next = new Map<string, GuildCommandConfig>()
        for (const row of rows) {
            const parsed = guildCommandConfigSchema.safeParse(row)
            if (parsed.success) next.set(parsed.data.guildId, parsed.data)
        }
        const changed: string[] = []
        const signatures = new Map<string, string>()
        for (const [guildId, config] of next) {
            const signature = JSON.stringify(config)
            signatures.set(guildId, signature)
            if (this.signatures.get(guildId) !== signature)
                changed.push(guildId)
        }
        for (const guildId of this.configs.keys())
            if (!next.has(guildId)) changed.push(guildId)
        this.configs = next
        this.signatures = signatures
        this.loaded = true
        return changed
    }

    /** The current config without a backend read. */
    peek(guildId: string | null | undefined) {
        return guildId ? this.configs.get(guildId) : undefined
    }

    /**
     * The server's config; before the subscription delivered its first
     * result, one bounded read. Null means the server is not connected.
     */
    async get(
        guildId: string | null | undefined
    ): Promise<GuildCommandConfig | null> {
        if (!guildId) return null
        if (!this.loaded) {
            let timer: ReturnType<typeof setTimeout> | undefined
            try {
                const rows = await Promise.race([
                    this.source.list(),
                    new Promise<undefined>((resolve) => {
                        timer = setTimeout(
                            () => resolve(undefined),
                            FALLBACK_READ_MS
                        )
                    }),
                ])
                if (rows !== undefined) this.apply(rows)
            } catch {
                // The live subscription retries; the command answers without it.
            } finally {
                clearTimeout(timer)
            }
        }
        return this.configs.get(guildId) ?? null
    }

    all() {
        return [...this.configs.values()]
    }
}
