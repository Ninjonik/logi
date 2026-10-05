import type { DiscordConfigIdField } from "@/domain/workspaces/discord-config-patch"

/**
 * Body for `POST /api/servers/{serverId}/discord-settings`. Pages send only the
 * settings they own; omitted settings keep their stored values.
 */
export type DiscordSettingsSubmission = Partial<
    Record<DiscordConfigIdField, string | null>
> &
    Record<string, unknown>

/** An emptied picker sends `null` so the stored ID is cleared rather than kept. */
export function clearableId(value?: string) {
    return value?.trim() || null
}

export async function saveDiscordSettings(
    serverId: string,
    submission: DiscordSettingsSubmission
): Promise<{ ok: true } | { ok: false; error?: string }> {
    const response = await fetch(`/api/servers/${serverId}/discord-settings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(submission),
    })
    if (response.ok) return { ok: true }
    const body = (await response.json().catch(() => null)) as {
        error?: unknown
    } | null
    return {
        ok: false,
        error: typeof body?.error === "string" ? body.error : undefined,
    }
}
