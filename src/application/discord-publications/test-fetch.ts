import {
    hllLiveFacts,
    snapshotLiveFacts,
    wardogsLiveFacts,
    type LiveServerFacts,
} from "@/domain/discord-publications/live-panel"
import { minutesLeft } from "@/domain/discord-publications/panel-graphics"
import type { WarconServed } from "@/application/game-data/read-warcon"
import type { HllServed } from "@/application/game-data/read-hll-live"
import type { ServerSnapshot } from "@/domain/game-data/contracts"

/**
 * "Načíst data ze serveru" (P2-29, P2-B10): the same read the bot does,
 * started from the dashboard, for HLL (CRCON) and Wardogs (Warcon). It
 * returns what came back, the provider status and the facts the preview is
 * drawn from. Never a key, a password or a provider address.
 */
export type PanelTestStatus =
    | "ok"
    | "stale"
    | "unavailable"
    | "busy"
    | "denied"
    | "failed"
    /** No live read for this provider; the collected snapshot is shown. */
    | "snapshot"

export type PanelTestSummary = {
    serverName: string | null
    map: string | null
    players: number | null
    capacity: number | null
    queue: number | null
    timeLeftMinutes: number | null
    /** "3 : 2" (HLL) or "23 · 12 · 7" (Wardogs factions). */
    score: string | null
    nextMap: string | null
    /** Players in the live statistics of the current round. */
    playersInStats: number | null
}

export type PanelTestResult = {
    provider: string
    status: PanelTestStatus
    readAt: number
    /** When the shown data was observed. */
    dataAt: number | null
    errorCategory: string | null
    retryAfterMs: number | null
    warnings: string[]
    summary: PanelTestSummary
    facts: LiveServerFacts | null
}

export type PanelTestPorts = {
    readHll(): Promise<HllServed>
    readWarcon(): Promise<WarconServed>
}

function summary(facts: LiveServerFacts | null): PanelTestSummary {
    if (!facts)
        return {
            serverName: null,
            map: null,
            players: null,
            capacity: null,
            queue: null,
            timeLeftMinutes: null,
            score: null,
            nextMap: null,
            playersInStats: null,
        }
    const score = facts.hll
        ? facts.hll.allies !== null && facts.hll.axis !== null
            ? `${facts.hll.allies} : ${facts.hll.axis}`
            : null
        : facts.wardogs?.factions.length
          ? facts.wardogs.factions.map((faction) => faction.points).join(" · ")
          : null
    return {
        serverName: facts.serverName,
        map: facts.map?.name ?? null,
        players: facts.players,
        capacity: facts.capacity,
        queue: facts.queue,
        timeLeftMinutes: minutesLeft(facts.timeLeftSeconds),
        score,
        nextMap: facts.nextMap?.name ?? null,
        playersInStats: facts.rosterFresh ? facts.roster.length : null,
    }
}

export async function testPanelFetch(
    input: {
        provider: string
        snapshot: ServerSnapshot | null
        now: number
    },
    ports: PanelTestPorts
): Promise<PanelTestResult> {
    const fallback = input.snapshot ? snapshotLiveFacts(input.snapshot) : null
    const result = (
        status: PanelTestStatus,
        facts: LiveServerFacts | null,
        extra: Partial<PanelTestResult> = {}
    ): PanelTestResult => ({
        provider: input.provider,
        status,
        readAt: input.now,
        dataAt: facts?.dataAt ?? null,
        errorCategory: null,
        retryAfterMs: null,
        warnings: [],
        summary: summary(facts),
        facts,
        ...extra,
    })
    const fresh = (facts: LiveServerFacts) =>
        facts.freshness === "fresh"
            ? "ok"
            : facts.freshness === "stale"
              ? "stale"
              : "unavailable"
    try {
        if (input.provider === "hll_crcon") {
            const served = await ports.readHll()
            if (served.kind === "ready") {
                const facts = hllLiveFacts(served.envelope.data)
                return result(fresh(facts), facts, {
                    warnings: served.envelope.data.warnings,
                })
            }
            return result(served.kind, fallback, {
                retryAfterMs:
                    served.kind === "busy" ? served.retryAfterMs : null,
            })
        }
        if (input.provider === "wardogs_warcon") {
            const served = await ports.readWarcon()
            if (
                served.kind === "ready" &&
                served.envelope.result.view === "live"
            ) {
                const facts = wardogsLiveFacts(served.envelope.result.data)
                return result(fresh(facts), facts)
            }
            if (served.kind === "failed")
                return result("failed", fallback, {
                    errorCategory: served.errorCategory,
                    retryAfterMs: served.retryAfterMs,
                })
            return result(
                served.kind === "ready" ? "unavailable" : served.kind,
                fallback,
                {
                    retryAfterMs:
                        served.kind === "busy" ? served.retryAfterMs : null,
                }
            )
        }
    } catch {
        return result("failed", fallback, { errorCategory: "network" })
    }
    return result("snapshot", fallback)
}
