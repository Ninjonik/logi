import { z } from "zod"

import type {
    SeedPlanIssue,
    SeedPlanIssueCode,
    SeedPlanSettings,
} from "@/domain/discord-seed/plan"
import type {
    SeedChannelProblem,
    SeedChannelReport,
} from "@/domain/discord-seed/channels"

/**
 * The browser side of `/api/servers/{serverId}/discord-seed/{connectionId}`
 * for the "Seed serverů" page: save the plan, check its channels while the
 * admin edits, and the live actions "Seed teď" and "Ukončit seed".
 */

const route = (serverId: string, connectionId: string) =>
    `/api/servers/${encodeURIComponent(serverId)}/discord-seed/${encodeURIComponent(connectionId)}`

const PROBLEMS = [
    "seed_channel_unpublishable",
    "seed_role_missing",
    "seed_role_not_mentionable",
    "seed_role_unmanageable",
    "control_channel_unpublishable",
    "control_channel_public",
] as const satisfies readonly SeedChannelProblem[]

const ISSUES = [
    "invalid",
    "start_below_not_under_live",
    "auto_below_above_start",
    "auto_window_empty",
    "schedule_without_slots",
    "duplicate_day",
    "duplicate_slot",
    "seed_channel_required",
    "control_channel_same_as_seed",
    "unknown_placeholder",
    "live_above_capacity",
] as const satisfies readonly SeedPlanIssueCode[]

const channelReportSchema = z.object({
    seedChannel: z
        .object({
            canPublish: z.boolean(),
            canMentionRole: z.boolean().nullable(),
        })
        .nullable(),
    controlChannel: z
        .object({ canPublish: z.boolean(), private: z.boolean() })
        .nullable(),
    role: z.object({ exists: z.boolean(), canManage: z.boolean() }).nullable(),
    problems: z.array(z.enum(PROBLEMS)),
}) satisfies z.ZodType<SeedChannelReport>
const issuesSchema = z.array(
    z.object({ path: z.string(), code: z.enum(ISSUES) })
) satisfies z.ZodType<SeedPlanIssue[]>

async function send(
    url: string,
    body: unknown,
    method: "PUT" | "POST",
    fetcher: typeof fetch
): Promise<{ status: number; body: unknown } | null> {
    try {
        const response = await fetcher(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        })
        return {
            status: response.status,
            body: await response.json().catch(() => null),
        }
    } catch {
        return null
    }
}

const errorOf = (body: unknown) =>
    z.object({ error: z.string() }).safeParse(body).data?.error ?? null

export type SeedChannelCheck =
    | { ok: true; channels: SeedChannelReport }
    | { ok: false; error: "verification_unavailable" | "unavailable" }

/** Checks the channels and the role in Discord without saving (P3-12, P3-22). */
export async function checkSeedPlanChannels(
    serverId: string,
    connectionId: string,
    settings: Pick<
        SeedPlanSettings,
        "seedChannelId" | "controlChannelId" | "seedRoleId" | "roleSelfService"
    >,
    fetcher: typeof fetch = fetch
): Promise<SeedChannelCheck> {
    const answer = await send(
        route(serverId, connectionId),
        { expectedRevision: null, settings, verifyOnly: true },
        "PUT",
        fetcher
    )
    const channels = z
        .object({ channels: channelReportSchema })
        .safeParse(answer?.body)
    if (answer?.status === 200 && channels.success)
        return { ok: true, channels: channels.data.channels }
    return {
        ok: false,
        error:
            errorOf(answer?.body) === "verification_unavailable"
                ? "verification_unavailable"
                : "unavailable",
    }
}

export type SeedPlanSaveOutcome =
    | { ok: true; revision: number; channels: SeedChannelReport }
    | { ok: false; error: "invalid_plan"; issues: SeedPlanIssue[] }
    | { ok: false; error: "channels"; channels: SeedChannelReport }
    | {
          ok: false
          error:
              | "conflict"
              | "not_found"
              | "forbidden"
              | "verification_unavailable"
              | "unavailable"
      }

/** Saves one server's plan and control channel ("Uložit", P3-25). */
export async function saveSeedPlan(
    serverId: string,
    connectionId: string,
    input: { expectedRevision: number | null; settings: SeedPlanSettings },
    fetcher: typeof fetch = fetch
): Promise<SeedPlanSaveOutcome> {
    const answer = await send(
        route(serverId, connectionId),
        input,
        "PUT",
        fetcher
    )
    if (!answer) return { ok: false, error: "unavailable" }
    const saved = z
        .object({ revision: z.number().int(), channels: channelReportSchema })
        .safeParse(answer.body)
    if (answer.status === 200 && saved.success)
        return { ok: true, ...saved.data }
    const error = errorOf(answer.body)
    if (error === "invalid_plan") {
        const issues = z.object({ issues: issuesSchema }).safeParse(answer.body)
        if (issues.success)
            return { ok: false, error, issues: issues.data.issues }
    }
    if (error === "channels") {
        const channels = z
            .object({ channels: channelReportSchema })
            .safeParse(answer.body)
        if (channels.success)
            return { ok: false, error, channels: channels.data.channels }
    }
    switch (error) {
        case "conflict":
        case "not_found":
        case "forbidden":
        case "verification_unavailable":
            return { ok: false, error }
        default:
            return {
                ok: false,
                error: answer.status === 403 ? "forbidden" : "unavailable",
            }
    }
}

/** Why a live action was refused; the page shows one sentence for each. */
export type SeedActionError =
    | "cooldown"
    | "running"
    | "duplicate"
    | "not_configured"
    | "offline"
    | "already_live"
    | "not_running"
    | "not_found"
    | "forbidden"
    | "unavailable"

export type SeedActionOutcome =
    | { ok: true; action: "started"; channelId: string; pinged: boolean }
    | { ok: true; action: "stopped" }
    | { ok: false; error: SeedActionError; retryAt?: string }

const REASONS = [
    "not_configured",
    "offline",
    "already_live",
    "not_running",
] as const

/**
 * "Seed teď" and "Ukončit seed" (P3-05, P3-23). They act in Discord at once,
 * so they stay outside `/api/v1`. `requestKey` is new for each click; a
 * retried request with the same key starts nothing twice.
 */
export async function runSeedAction(
    serverId: string,
    connectionId: string,
    action: { action: "start"; requestKey: string } | { action: "stop" },
    fetcher: typeof fetch = fetch
): Promise<SeedActionOutcome> {
    const answer = await send(
        route(serverId, connectionId),
        action,
        "POST",
        fetcher
    )
    if (!answer) return { ok: false, error: "unavailable" }
    const result = z
        .discriminatedUnion("status", [
            z.object({
                status: z.literal("started"),
                channelId: z.string(),
                pinged: z.boolean(),
            }),
            z.object({ status: z.literal("duplicate") }),
            z.object({ status: z.literal("stopped") }),
        ])
        .safeParse(answer.body)
    if (answer.status === 200 && result.success)
        switch (result.data.status) {
            case "started":
                return {
                    ok: true,
                    action: "started",
                    channelId: result.data.channelId,
                    pinged: result.data.pinged,
                }
            case "duplicate":
                return { ok: false, error: "duplicate" }
            case "stopped":
                return { ok: true, action: "stopped" }
        }
    const refusal = z
        .object({
            error: z.string(),
            retryAt: z.string().optional(),
            reason: z.enum(REASONS).optional(),
        })
        .safeParse(answer.body)
    if (!refusal.success) return { ok: false, error: "unavailable" }
    const { error, retryAt, reason } = refusal.data
    switch (error) {
        case "cooldown":
            return retryAt
                ? { ok: false, error, retryAt }
                : { ok: false, error: "unavailable" }
        case "running":
        case "not_found":
        case "forbidden":
            return { ok: false, error }
        case "unavailable":
            return { ok: false, error: reason ?? "unavailable" }
        default:
            return { ok: false, error: "unavailable" }
    }
}
