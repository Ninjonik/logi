import type {
    PanelError,
    PanelErrorCode,
    PanelPermission,
} from "../../../src/domain/discord-publications/panel-delivery"
import { InvalidMessageViewError } from "../../../src/domain/discord-messages/message-validation"
import { PublicationChannelError } from "../sync/publication"

/**
 * Turns what went wrong on a panel pass into a code the dashboard explains
 * in plain words with a fix step (P1-16, P2-32): never an internal message.
 */
export class PanelPassError extends Error {
    constructor(
        readonly code: PanelErrorCode,
        readonly category?: string
    ) {
        super(`Panel pass failed: ${code}`)
        this.name = "PanelPassError"
    }
}

const PERMISSION_NAMES: Record<string, PanelPermission> = {
    ViewChannel: "view_channel",
    SendMessages: "send_messages",
    EmbedLinks: "embed_links",
    AttachFiles: "attach_files",
    ReadMessageHistory: "read_message_history",
}

function field(error: unknown, name: string): unknown {
    return typeof error === "object" && error !== null && name in error
        ? (error as Record<string, unknown>)[name]
        : undefined
}

/** The error and its causes, outermost first (bounded). */
function chain(error: unknown) {
    const all: unknown[] = []
    let current: unknown = error
    while (current && all.length < 5) {
        all.push(current)
        current = field(current, "cause")
    }
    return all
}

/**
 * The panel error for a failure, or null for a benign collision (another
 * pass holds the publication lease) that is simply retried.
 */
export function classifyPanelError(
    error: unknown,
    now: number
): PanelError | null {
    for (const item of chain(error)) {
        if (item instanceof PanelPassError)
            return {
                code: item.code,
                at: now,
                ...(item.category ? { category: item.category } : {}),
            }
        if (item instanceof PublicationChannelError) {
            const permissions = [
                ...new Set(
                    item.permissions
                        .map((name) => PERMISSION_NAMES[name])
                        .filter((name): name is PanelPermission =>
                            Boolean(name)
                        )
                ),
            ]
            return {
                code: item.reason,
                at: now,
                ...(item.reason === "missing_permissions"
                    ? { permissions }
                    : {}),
            }
        }
        if (item instanceof InvalidMessageViewError)
            return { code: "render_failed", at: now }
        const message = item instanceof Error ? item.message : ""
        if (message.startsWith("Delivery uncertain"))
            return { code: "delivery_uncertain", at: now }
        if (message.startsWith("Publication busy")) return null
        const code = field(item, "code")
        if (code === 10004) return { code: "bot_not_in_server", at: now }
        if (code === 10003) return { code: "channel_missing", at: now }
        if (code === 50001)
            return {
                code: "missing_permissions",
                at: now,
                permissions: ["view_channel"],
            }
        if (code === 50013)
            return { code: "missing_permissions", at: now, permissions: [] }
        const status = field(item, "status")
        if (
            (typeof status === "number" && status >= 500) ||
            code === "ECONNRESET" ||
            code === "ETIMEDOUT" ||
            (item instanceof Error && item.name === "AbortError")
        )
            return { code: "discord_unavailable", at: now }
    }
    return { code: "unknown", at: now }
}
