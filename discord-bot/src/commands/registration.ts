import {
    buildCommandDefinitions,
    commandDefinitionsSignature,
    fallbackGuildLanguage,
    type CommandDefinition,
} from "./definitions"
import {
    resolveCommandSettings,
    type ResolvedCommandSettings,
} from "../../../src/domain/discord-commands/command-settings"
import type { GuildCommandConfig } from "../../../src/domain/discord-commands/guild-config"
import type { GuildCommandConfigs } from "./guild-configs"

/** The parts of a discord.js `Guild` registration uses. */
export type RegistrationGuild = {
    id: string
    preferredLocale?: string | null
    commands: { set(commands: CommandDefinition[]): Promise<unknown> }
}

export type RegistrationFailure = "forbidden" | "rate_limited" | "unavailable"

export type RegistrationRecord = {
    guildId: string
    at: number
    handledRequestAt?: number
    result:
        | {
              ok: true
              commandCount: number
              language: string
              signature: string
          }
        | { ok: false; failure: RegistrationFailure }
}

export type CommandRegistrationPorts = {
    configs: Pick<GuildCommandConfigs, "peek" | "get">
    /** The guilds the bot is in, by ID (the client's cache). */
    guild(guildId: string): RegistrationGuild | undefined
    /** Stores the result for the "Příkazy" page (`discordCommands:recordRegistration`). */
    record(record: RegistrationRecord): Promise<unknown>
    now(): number
    log(
        level: "info" | "warn" | "error",
        message: string,
        details: Record<string, unknown>
    ): void
    /** Waits before a change is registered, so quick edits register once. */
    debounceMs?: number
    schedule?: (callback: () => void, ms: number) => unknown
    cancel?: (handle: unknown) => void
}

/**
 * `saved`: the "Příkazy" page or the API saved the command settings; the
 * registration is recorded even when Discord already has these commands.
 */
export type RegistrationReason =
    "ready" | "guildCreate" | "settings" | "language" | "request" | "saved"

/** What a server's commands are registered with. */
export function registrationInput(
    config: GuildCommandConfig | null | undefined,
    preferredLocale: string | null | undefined
): { language: string; settings: ResolvedCommandSettings } {
    return {
        language: config?.language ?? fallbackGuildLanguage(preferredLocale),
        settings: resolveCommandSettings(
            config?.commandSettings ?? null,
            config?.statsSettings?.enabled
        ),
    }
}

function failureOf(error: unknown): RegistrationFailure {
    const status =
        error && typeof error === "object" && "status" in error
            ? Number((error as { status: unknown }).status)
            : undefined
    if (status === 403 || status === 401) return "forbidden"
    if (status === 429) return "rate_limited"
    return "unavailable"
}

/**
 * Registers Logi's commands per Discord server (M1-B01): when the bot is
 * ready (every server), when it joins one, when the clan language or the
 * command settings change, after every save of the command settings and on
 * "Znovu zaregistrovat". Each registration replaces the server's commands in
 * one call and is recorded with its time, count and definitions' signature.
 * After a save that leaves the commands as this process last registered
 * them, the Discord call is skipped, but the registration is still recorded,
 * so "Zaregistrováno …" moves after every save (N3-B02).
 */
export function createCommandRegistration(ports: CommandRegistrationPorts) {
    const registered = new Map<
        string,
        { signature: string; language: string; handledRequestAt?: number }
    >()
    const timers = new Map<string, unknown>()
    const running = new Map<string, Promise<void>>()
    const schedule =
        ports.schedule ??
        ((callback: () => void, ms: number) => setTimeout(callback, ms))
    const cancel =
        ports.cancel ??
        ((handle: unknown) =>
            clearTimeout(handle as ReturnType<typeof setTimeout>))

    async function register(
        guild: RegistrationGuild,
        reason: RegistrationReason
    ) {
        const config =
            ports.configs.peek(guild.id) ?? (await ports.configs.get(guild.id))
        const { language, settings } = registrationInput(
            config,
            guild.preferredLocale
        )
        const definitions = buildCommandDefinitions({ language, settings })
        const signature = commandDefinitionsSignature(definitions)
        const handledRequestAt = config?.registration.requestedAt ?? undefined
        const at = ports.now()
        // A save that changed nothing Discord shows: no call, still recorded.
        const unchanged =
            reason === "saved" &&
            registered.get(guild.id)?.signature === signature
        try {
            if (!unchanged) await guild.commands.set(definitions)
            registered.set(guild.id, { signature, language, handledRequestAt })
            ports.log(
                "info",
                unchanged
                    ? "Slash commands unchanged; registration recorded"
                    : "Registered slash commands",
                {
                    guildId: guild.id,
                    reason,
                    language,
                    count: definitions.length,
                }
            )
            if (config)
                await ports
                    .record({
                        guildId: guild.id,
                        at,
                        handledRequestAt,
                        result: {
                            ok: true,
                            commandCount: definitions.length,
                            language,
                            signature,
                        },
                    })
                    .catch((error) =>
                        ports.log("warn", "Failed to record registration", {
                            guildId: guild.id,
                            error,
                        })
                    )
        } catch (error) {
            ports.log("error", "Failed to register guild commands", {
                guildId: guild.id,
                reason,
                error,
            })
            if (config)
                await ports
                    .record({
                        guildId: guild.id,
                        at,
                        handledRequestAt,
                        result: { ok: false, failure: failureOf(error) },
                    })
                    .catch(() => undefined)
        }
    }

    /** Registers one server now; concurrent calls for it share one run. */
    function registerGuild(
        guild: RegistrationGuild,
        reason: RegistrationReason
    ) {
        const current = running.get(guild.id)
        const next = (current ?? Promise.resolve())
            .then(() => register(guild, reason))
            .finally(() => {
                if (running.get(guild.id) === next) running.delete(guild.id)
            })
        running.set(guild.id, next)
        return next
    }

    /** Why a server needs registering after a settings change, if at all. */
    function pendingReason(
        guildId: string,
        preferredLocale: string | null | undefined
    ): RegistrationReason | null {
        const config = ports.configs.peek(guildId)
        if (!config) return null
        const last = registered.get(guildId)
        const requestedAt = config.registration.requestedAt
        if (
            requestedAt !== null &&
            (last?.handledRequestAt === undefined ||
                requestedAt > last.handledRequestAt)
        )
            return config.registration.requestKind === "save"
                ? "saved"
                : "request"
        const { language, settings } = registrationInput(
            config,
            preferredLocale
        )
        const signature = commandDefinitionsSignature(
            buildCommandDefinitions({ language, settings })
        )
        if (last?.signature === signature) return null
        // Never registered by this process: the stored signature says
        // whether the commands Discord has are already these.
        if (!last && config.registration.signature === signature) return null
        return last && last.language !== language ? "language" : "settings"
    }

    return {
        registerGuild,

        /** Every server the bot is in, one after another (ClientReady). */
        async registerAll(guilds: Iterable<RegistrationGuild>) {
            for (const guild of guilds) await registerGuild(guild, "ready")
        },

        /**
         * Settings of these servers changed: register the ones whose
         * definitions differ or that asked for it, after a short pause.
         */
        configsChanged(guildIds: readonly string[]) {
            for (const guildId of guildIds) {
                const guild = ports.guild(guildId)
                if (!guild) continue
                const reason = pendingReason(guildId, guild.preferredLocale)
                if (!reason) continue
                const previous = timers.get(guildId)
                if (previous !== undefined) cancel(previous)
                timers.set(
                    guildId,
                    schedule(
                        () => {
                            timers.delete(guildId)
                            const current = ports.guild(guildId)
                            if (current) void registerGuild(current, reason)
                        },
                        reason === "request" ? 0 : (ports.debounceMs ?? 3_000)
                    )
                )
            }
        },
    }
}
