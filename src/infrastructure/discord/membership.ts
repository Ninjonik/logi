import type {
    MembershipSubject,
    ProviderObservation,
} from "@/domain/membership/observation"

export async function fetchDiscordMembership(
    subject: Pick<MembershipSubject, "guildId" | "discordUserId">,
    ports: { token?: string; fetch?: typeof fetch; now?: () => number }
): Promise<ProviderObservation> {
    const unavailable: ProviderObservation = {
        state: "unknown",
        roleIds: [],
        observedAt: null,
    }
    if (
        !ports.token ||
        ![subject.guildId, subject.discordUserId].every((id) =>
            /^\d{17,20}$/.test(id)
        )
    )
        return unavailable
    const started = (ports.now ?? Date.now)()
    try {
        const response = await (ports.fetch ?? fetch)(
            `https://discord.com/api/v10/guilds/${subject.guildId}/members/${subject.discordUserId}`,
            {
                headers: { Authorization: `Bot ${ports.token}` },
                redirect: "error",
                cache: "no-store",
                signal: AbortSignal.timeout(10_000),
            }
        )
        const reader = response.body?.getReader()
        if (!reader) return unavailable
        const chunks: Uint8Array[] = []
        let length = 0
        try {
            while (true) {
                const next = await reader.read()
                if (next.done) break
                length += next.value.byteLength
                if (length > 64 * 1024) {
                    await reader.cancel()
                    return unavailable
                }
                chunks.push(next.value)
            }
        } finally {
            reader.releaseLock()
        }
        const bytes = new Uint8Array(length)
        let offset = 0
        for (const chunk of chunks) {
            bytes.set(chunk, offset)
            offset += chunk.length
        }
        const body: unknown = JSON.parse(new TextDecoder().decode(bytes))
        if (!body || typeof body !== "object") return unavailable
        const value = body as Record<string, unknown>
        if (response.status === 429) {
            const seconds =
                typeof value.retry_after === "number"
                    ? value.retry_after
                    : Number(response.headers.get("retry-after"))
            return {
                ...unavailable,
                retryAfterMs:
                    Number.isFinite(seconds) && seconds > 0
                        ? Math.min(86400000, Math.ceil(seconds * 1000))
                        : 60000,
            }
        }
        if (response.status === 404 && value.code === 10007)
            return {
                state: "left",
                roleIds: [],
                observedAt: new Date(started).toISOString(),
            }
        if (!response.ok) return unavailable
        if (
            !Array.isArray(value.roles) ||
            value.roles.length > 250 ||
            !value.roles.every(
                (role) => typeof role === "string" && /^\d{17,20}$/.test(role)
            ) ||
            !value.user ||
            typeof value.user !== "object" ||
            (value.user as { id?: unknown }).id !== subject.discordUserId
        )
            return unavailable
        return {
            state: "present",
            roleIds: [...new Set(value.roles as string[])],
            observedAt: new Date(started).toISOString(),
        }
    } catch {
        return unavailable
    }
}
