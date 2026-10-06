import { z } from "zod"

/**
 * Delivery of the panels in "Panely v Discordu" (P1, P2): what the bot last
 * did with a panel, the state chip the dashboard shows, the actions an admin
 * can request and the bot heartbeat. Pure: the caller passes stored rows and
 * the clock. Discord calls happen only in the bot; the dashboard requests an
 * action by writing a flag the bot's worker consumes idempotently.
 */

// ---- Errors ------------------------------------------------------------------

/**
 * Why the last attempt failed, as a code the dashboard turns into a plain
 * sentence with a fix step (P1-16, P2-32). Never an internal error text.
 */
export const PANEL_ERROR_CODES = [
    "bot_not_in_server",
    "channel_missing",
    "channel_type",
    "missing_permissions",
    "delivery_uncertain",
    "discord_unavailable",
    "source_missing",
    "source_not_collecting",
    "provider_unreachable",
    "provider_rate_limited",
    "render_failed",
    "unsupported_kind",
    "competition_missing",
    /** Wardogs League is turned off in its settings; the panel's messages are gone (L3-55). */
    "league_disabled",
    "unknown",
] as const
export type PanelErrorCode = (typeof PANEL_ERROR_CODES)[number]

/** The channel permissions a panel needs (P2-09); `attach_files` only for images. */
export const PANEL_PERMISSIONS = [
    "view_channel",
    "send_messages",
    "embed_links",
    "attach_files",
    "read_message_history",
] as const
export type PanelPermission = (typeof PANEL_PERMISSIONS)[number]

export const panelErrorSchema = z.strictObject({
    code: z.enum(PANEL_ERROR_CODES),
    at: z.number().int().nonnegative(),
    /** Missing channel permissions, for `missing_permissions`. */
    permissions: z.array(z.enum(PANEL_PERMISSIONS)).max(5).optional(),
    /** The provider failure category, e.g. `timeout` or `rate_limited`. */
    category: z
        .string()
        .regex(/^[a-z_]{1,40}$/)
        .optional(),
})
export type PanelError = z.infer<typeof panelErrorSchema>

/** Not errors: the panel was delivered, with something worth telling the admin. */
export const PANEL_WARNINGS = [
    /** The channel became public, so the password was removed (P4-30). */
    "password_hidden_public_channel",
    /** The live read failed; the panel shows the collected data instead. */
    "live_data_unavailable",
    /** Without Attach Files the panel is text only (P2-B02). */
    "attach_files_missing",
] as const
export type PanelWarning = (typeof PANEL_WARNINGS)[number]

/** What the bot reports after every pass over a panel. */
export const panelAttemptSchema = z.strictObject({
    attemptAt: z.number().int().nonnegative(),
    ok: z.boolean(),
    error: panelErrorSchema.nullable(),
    /** When the bot will look at the panel again. */
    nextAt: z.number().int().nonnegative().nullable(),
    /** When the shown server data was read. */
    dataAt: z.number().int().nonnegative().nullable(),
    /** The admin request (`requestedAt`) this pass answered. */
    handledRequestAt: z.number().int().nonnegative().nullable(),
    warnings: z.array(z.enum(PANEL_WARNINGS)).max(PANEL_WARNINGS.length),
    /** Messages the panel owns in Discord after this pass. */
    messages: z.number().int().min(0).max(1000),
    /**
     * Whether `@everyone` cannot view the panel's channel, as the bot saw it
     * on this pass ("veřejný kanál" / "soukromý kanál", P1-13, P1-14).
     * Absent when the pass did not look at the channel.
     */
    channelPrivate: z.boolean().optional(),
})
export type PanelAttempt = z.infer<typeof panelAttemptSchema>

/** The stored delivery record of one panel (`discordPanelStatus`). */
export type PanelStatusRecord = {
    claimedAt: number | null
    attemptAt: number | null
    successAt: number | null
    nextAt: number | null
    dataAt: number | null
    handledRequestAt: number | null
    error: PanelError | null
    warnings: PanelWarning[]
    messages: number
    /** First time a message of this panel was confirmed in Discord. */
    sentAt: number | null
    /**
     * The most recent failure, kept after a later success so the editor can
     * say "Poslední chyba … Další pokus … prošel" (P2-32). Absent on rows
     * stored before it existed.
     */
    lastError?: PanelError | null
    /** The first success after `lastError` ("Další pokus … prošel"); null while it still fails. */
    recoveredAt?: number | null
    /** The last privacy the bot saw for the channel; null before it looked. */
    channelPrivate?: boolean | null
}

/** Folds one attempt into the stored record; `claimedAt` is when the bot took a request. */
export function nextPanelStatus(
    previous: PanelStatusRecord | null,
    attempt: PanelAttempt
): PanelStatusRecord {
    const handled = attempt.handledRequestAt
    return {
        claimedAt:
            handled !== null && (previous?.handledRequestAt ?? null) !== handled
                ? attempt.attemptAt
                : (previous?.claimedAt ?? null),
        attemptAt: attempt.attemptAt,
        successAt: attempt.ok
            ? attempt.attemptAt
            : (previous?.successAt ?? null),
        nextAt: attempt.nextAt,
        dataAt: attempt.dataAt ?? previous?.dataAt ?? null,
        handledRequestAt: handled ?? previous?.handledRequestAt ?? null,
        error: attempt.ok ? null : attempt.error,
        warnings: attempt.warnings,
        messages: attempt.messages,
        sentAt:
            previous?.sentAt ??
            (attempt.ok && attempt.messages > 0 ? attempt.attemptAt : null),
        lastError: attempt.ok
            ? (previous?.lastError ?? previous?.error ?? null)
            : attempt.error,
        recoveredAt: attempt.ok
            ? previous?.error
                ? attempt.attemptAt
                : (previous?.recoveredAt ?? null)
            : null,
        channelPrivate:
            attempt.channelPrivate ?? previous?.channelPrivate ?? null,
    }
}

// ---- State chip ----------------------------------------------------------------

/** P1-B01: shown for every panel, also before the bot's first pass. */
export const PANEL_DELIVERY_STATES = [
    "published",
    "error",
    "waiting",
    "unsent",
    "paused",
] as const
export type PanelDeliveryState = (typeof PANEL_DELIVERY_STATES)[number]

export type PanelDeliveryInput = {
    draft: boolean
    paused: boolean
    removing: boolean
    requestedAt: number | null
    status: Pick<
        PanelStatusRecord,
        "attemptAt" | "successAt" | "handledRequestAt" | "error"
    > | null
    /** Messages Discord confirmed for this panel. */
    messages: number
    /** A create Discord did not confirm and Logi will not repeat (P2-33). */
    uncertain: boolean
}

/**
 * Zveřejněno, Chyba, Čeká na bota, Neodesláno or Pozastaveno. A request the
 * bot has not answered yet always reads "Čeká na bota", so an admin sees the
 * difference between "not posted yet" and "broken".
 */
export function panelDeliveryState(
    input: PanelDeliveryInput
): PanelDeliveryState {
    if (input.removing) return "waiting"
    if (input.draft) return input.messages > 0 ? "waiting" : "unsent"
    if (input.paused) return "paused"
    const status = input.status
    if (input.uncertain) return "error"
    if (
        status?.error &&
        (status.successAt === null || status.error.at >= status.successAt)
    )
        return "error"
    if (isRequestPending(input.requestedAt, status?.handledRequestAt ?? null))
        return "waiting"
    if (!status?.successAt) return "waiting"
    return "published"
}

/** One message's managed publication, as the overview reads it. */
export type PanelMessagePublication = {
    channelId: string | null
    messageId: string | null
    /** A create Discord has not confirmed yet. */
    pending: boolean
    /** The last delivery of this message failed (stored summary). */
    error: string | null
    lastSuccessAt: number | null
}

/**
 * The state of one message of a panel that owns several (the WD League
 * "tabulka" and "nejbližší zápasy", P1-20, P1-21), from that message's own
 * managed publication. A paused or unsent panel holds every message; a
 * message whose last delivery failed, or that was never posted while the
 * panel fails, reads "Chyba"; one not posted yet reads "Čeká na bota"; a
 * message the bot confirmed after the pending request and after the
 * panel's error reads "Zveřejněno".
 */
export function panelMessageState(input: {
    /** The panel's own state (`panelDeliveryState`). */
    panel: PanelDeliveryState
    requestedAt: number | null
    /** When the panel's current error happened; null without one. */
    errorAt: number | null
    publication: PanelMessagePublication | null
}): PanelDeliveryState {
    if (input.panel === "unsent" || input.panel === "paused") return input.panel
    const publication = input.publication
    if (publication?.error) return "error"
    if (!publication?.channelId || !publication.messageId)
        return input.panel === "error" ? "error" : "waiting"
    const success = publication.lastSuccessAt ?? 0
    if (input.panel === "error")
        return input.errorAt === null || success >= input.errorAt
            ? "published"
            : "error"
    if (input.panel === "waiting")
        return input.requestedAt !== null && success >= input.requestedAt
            ? "published"
            : "waiting"
    return "published"
}

/** A request is pending until the bot reports handling it or a later one. */
export function isRequestPending(
    requestedAt: number | null | undefined,
    handledRequestAt: number | null | undefined
): boolean {
    return (
        typeof requestedAt === "number" &&
        (typeof handledRequestAt !== "number" || handledRequestAt < requestedAt)
    )
}

// ---- Actions -------------------------------------------------------------------

/**
 * The live actions (P1-B04, P2-B12): Odeslat do kanálu, Obnovit teď,
 * Pozastavit / Spustit, Zkusit znovu, Odstranit zprávu and removing the
 * panel itself.
 */
export const PANEL_ACTIONS = [
    "publish",
    "refresh",
    "pause",
    "resume",
    "retry",
    "delete",
    "remove",
] as const
export type PanelAction = (typeof PANEL_ACTIONS)[number]

export type PanelActionTarget = {
    draft: boolean
    paused: boolean
    removing: boolean
}

/** Fields an action writes on the panel row; absent fields stay unchanged. */
export type PanelActionPatch = {
    requestedAt: number
    requestKind: PanelAction
    draft?: boolean
    paused?: boolean
    enabled?: true
    pausedAt?: number | null
    pausedBy?: string | null
    removing?: boolean
}

export type PanelActionDecision =
    | {
          ok: true
          patch: PanelActionPatch
          /** Clear the publications' retry wait so the bot tries at once. */
          resetRetry: boolean
          /** Forget an unconfirmed create so it is sent again (P2-33). */
          abandonPending: boolean
      }
    | { ok: false; reason: "not_sent" | "removing" }

/**
 * What one action changes. Every accepted action stamps `requestedAt`, which
 * the bot answers on its next pass (within 15 s); repeating an action is
 * harmless. A paused panel is edited once more to show "Pozastaveno".
 */
export function panelActionPatch(
    panel: PanelActionTarget,
    action: PanelAction,
    input: { now: number; actorId: string }
): PanelActionDecision {
    if (panel.removing) return { ok: false, reason: "removing" }
    const base = { requestedAt: input.now, requestKind: action }
    const decision = (
        patch: Omit<PanelActionPatch, "requestedAt" | "requestKind"> = {},
        options: { resetRetry?: boolean; abandonPending?: boolean } = {}
    ): PanelActionDecision => ({
        ok: true,
        patch: { ...base, ...patch },
        resetRetry: options.resetRetry ?? false,
        abandonPending: options.abandonPending ?? false,
    })
    switch (action) {
        case "publish":
            // "Odeslat do kanálu": the first post, or a resend of a paused panel.
            return decision(
                {
                    draft: false,
                    paused: false,
                    enabled: true,
                    pausedAt: null,
                    pausedBy: null,
                },
                { resetRetry: true }
            )
        case "remove":
            return decision({ removing: true }, { resetRetry: true })
    }
    if (panel.draft) return { ok: false, reason: "not_sent" }
    switch (action) {
        case "refresh":
            return decision({}, { resetRetry: true })
        case "pause":
            return decision({
                paused: true,
                pausedAt: input.now,
                pausedBy: input.actorId,
            })
        case "resume":
            return decision(
                {
                    paused: false,
                    enabled: true,
                    pausedAt: null,
                    pausedBy: null,
                },
                { resetRetry: true }
            )
        case "retry":
            return decision({}, { resetRetry: true, abandonPending: true })
        case "delete":
            // "Odstranit zprávu": the message goes, the panel stays unsent.
            return decision({ draft: true }, { resetRetry: true })
    }
}

/** What the bot does with a panel on its pass. */
export type PanelWork =
    "remove_panel" | "withdraw" | "skip" | "render_paused" | "render"

/**
 * The worker's decision: a panel being removed loses its messages and row;
 * an unsent panel keeps nothing in Discord; a paused panel is drawn once
 * with the "Pozastaveno" chip and then left alone until a request.
 */
export function panelWork(input: {
    draft: boolean
    paused: boolean
    removing: boolean
    /** A request newer than the last one the bot handled. */
    requestPending: boolean
    /** Whether this process already drew the current paused state. */
    pausedDrawn: boolean
}): PanelWork {
    if (input.removing) return "remove_panel"
    if (input.draft) return "withdraw"
    if (input.paused)
        return input.pausedDrawn && !input.requestPending
            ? "skip"
            : "render_paused"
    return "render"
}

// ---- Bot heartbeat ----------------------------------------------------------

/**
 * The panel protocol the bot implements. The dashboard warns when a running
 * bot reports an older one (P1-06): its panels would not answer requests.
 */
export const PANEL_PROTOCOL = 2
export const REQUIRED_PANEL_PROTOCOL = 2
/**
 * The first bot release that speaks `REQUIRED_PANEL_PROTOCOL`, named in the
 * outdated warning ("potřebují verzi 1.1.0 nebo novější", P1-06). Raise it
 * together with the protocol and the package version the bot reports.
 */
export const MINIMUM_BOT_VERSION = "1.1.0"
/** The bot writes its heartbeat every 30 s; silence for 3 min is "offline" (P1-05). */
export const BOT_HEARTBEAT_INTERVAL_MS = 30_000
export const BOT_OFFLINE_AFTER_MS = 3 * 60_000

export const botHeartbeatSchema = z.strictObject({
    version: z.string().regex(/^[A-Za-z0-9._+-]{1,40}$/),
    protocol: z.number().int().min(1).max(1000),
    startedAt: z.number().int().nonnegative(),
})
export type BotHeartbeat = z.infer<typeof botHeartbeatSchema>

export type BotHeartbeatState =
    | { state: "unknown" }
    | {
          state: "online" | "offline" | "outdated"
          version: string
          protocol: number
          seenAt: number
          requiredProtocol: number
          /** The release the warning asks for (P1-06). */
          requiredVersion: string
      }

/** "Bot online", "Bot neodpovídá" or "Bot běží starší verzi" (P1-04..06). */
export function botHeartbeatState(
    beat: (BotHeartbeat & { seenAt: number }) | null,
    now: number,
    requiredProtocol = REQUIRED_PANEL_PROTOCOL,
    requiredVersion = MINIMUM_BOT_VERSION
): BotHeartbeatState {
    if (!beat) return { state: "unknown" }
    const state =
        now - beat.seenAt > BOT_OFFLINE_AFTER_MS
            ? "offline"
            : beat.protocol < requiredProtocol
              ? "outdated"
              : "online"
    return {
        state,
        version: beat.version,
        protocol: beat.protocol,
        seenAt: beat.seenAt,
        requiredProtocol,
        requiredVersion,
    }
}
