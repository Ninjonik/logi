import type { StartSeedResult } from "./start-seed"
import type { StopSeedResult } from "./stop-seed"

/**
 * The answer to "Seed teď" / "Ukončit seed" for the dashboard and the bot's
 * private replies (P5-30, P5-31): no actor IDs, times as ISO strings.
 */
export type SeedActionResult =
    | { status: "started"; runId: string; startedAt: string; pinged: boolean }
    | { status: "duplicate"; runId: string }
    | { status: "stopped"; runId: string }
    | { status: "running"; runId: string | null }
    | { status: "cooldown"; retryAt: string }
    | {
          status: "unavailable"
          reason:
              | "disabled"
              | "not_configured"
              | "offline"
              | "already_live"
              | "not_running"
      }
    | { status: "not_found" }

export function startResultView(result: StartSeedResult): SeedActionResult {
    switch (result.kind) {
        case "started":
            return {
                status: "started",
                runId: result.run.id,
                startedAt: new Date(result.run.startedAt).toISOString(),
                pinged: result.run.ping.kind === "role",
            }
        case "duplicate":
            return { status: "duplicate", runId: result.run.id }
        case "not_found":
            return { status: "not_found" }
        case "refused":
            switch (result.refusal.kind) {
                case "running":
                    return { status: "running", runId: result.run?.id ?? null }
                case "cooldown":
                    return {
                        status: "cooldown",
                        retryAt: new Date(result.refusal.retryAt).toISOString(),
                    }
                default:
                    return {
                        status: "unavailable",
                        reason: result.refusal.kind,
                    }
            }
    }
}

export function stopResultView(result: StopSeedResult): SeedActionResult {
    return result.kind === "stopped"
        ? { status: "stopped", runId: result.run.id }
        : { status: "unavailable", reason: "not_running" }
}
