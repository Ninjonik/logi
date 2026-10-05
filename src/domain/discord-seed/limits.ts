const MINUTE_MS = 60 * 1000

/**
 * Cooldown between seed starts on one server (P5-B02, default 2 h). It applies
 * to every trigger, the manual one included, and the refusal names when a seed
 * may start again.
 */
export type SeedCooldown =
    { ok: true } | { ok: false; retryAt: number; remainingMs: number }

export function seedCooldown(
    lastStartedAt: number | null,
    cooldownMinutes: number,
    now: number
): SeedCooldown {
    if (lastStartedAt === null) return { ok: true }
    const retryAt = lastStartedAt + cooldownMinutes * MINUTE_MS
    return now >= retryAt
        ? { ok: true }
        : { ok: false, retryAt, remainingMs: retryAt - now }
}

/**
 * Ping protection (P3-15, default 4 h): the Seed role is pinged at most once
 * per window, counted over every plan of the clan that pings the same role. A
 * seed started inside the window still runs; its call goes out without a ping.
 */
export type SeedPing =
    | { kind: "role"; roleId: string }
    | {
          kind: "silent"
          reason: "ping_window"
          windowMinutes: number
          nextPingAt: number
      }
    | { kind: "silent"; reason: "no_role" }

export function decideSeedPing(input: {
    roleId: string | null
    lastRolePingAt: number | null
    pingWindowMinutes: number
    now: number
}): SeedPing {
    if (!input.roleId) return { kind: "silent", reason: "no_role" }
    if (input.lastRolePingAt !== null) {
        const nextPingAt =
            input.lastRolePingAt + input.pingWindowMinutes * MINUTE_MS
        if (input.now < nextPingAt)
            return {
                kind: "silent",
                reason: "ping_window",
                windowMinutes: input.pingWindowMinutes,
                nextPingAt,
            }
    }
    return { kind: "role", roleId: input.roleId }
}

/** The moment a run ends even below the live threshold (P3-18, P3-B05). */
export function seedDeadline(startedAt: number, maxDurationMinutes: number) {
    return startedAt + maxDurationMinutes * MINUTE_MS
}
