import type {
    PanelOverviewResponse,
    PanelServerSaveResult,
    PanelTestResponse,
} from "../../../../convex/discordPanels"
import type { PanelImageRequest } from "@/domain/discord-publications/panel-image-model"
import type { PanelAction } from "@/domain/discord-publications/panel-delivery"
import type { PanelChannelCheck } from "@/lib/gateways/discord-public-channel"
import type { GameServerSourceList } from "@/domain/game-data/credentials"
import type { LeagueOverview } from "@/domain/wardogs-league/panels"

/**
 * The browser side of "Panely v Discordu": typed calls to
 * `/api/servers/{serverId}/discord-panels` (see PANELS-API.md). Every write
 * goes through the dashboard origin; the server re-checks the admin right.
 */
export type { PanelOverviewResponse, PanelTestResponse, PanelChannelCheck }
export type PanelOverviewItem = PanelOverviewResponse["panels"][number]
export type PanelTestResult = Exclude<
    PanelTestResponse,
    { status: "not_found" }
>

export type PanelSaveOutcome =
    | { ok: true; id: string; revision: number; sent: boolean }
    | { ok: false; error: string }

const base = (serverId: string) =>
    `/api/servers/${encodeURIComponent(serverId)}/discord-panels`

async function json<T>(response: Response): Promise<T | null> {
    try {
        return (await response.json()) as T
    } catch {
        return null
    }
}

const post = (url: string, body: unknown, method = "POST") =>
    fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
    })

export async function readPanelOverview(
    serverId: string
): Promise<PanelOverviewResponse | null> {
    const response = await fetch(base(serverId), { cache: "no-store" })
    return response.ok ? json<PanelOverviewResponse>(response) : null
}

export async function requestPanelAction(
    serverId: string,
    panelId: string,
    action: PanelAction
): Promise<{ ok: true } | { ok: false; error: string }> {
    const response = await post(
        `${base(serverId)}/${encodeURIComponent(panelId)}/actions`,
        { action }
    )
    if (response.ok) return { ok: true }
    const body = await json<{ error?: string }>(response)
    return { ok: false, error: body?.error ?? "unavailable" }
}

export async function refreshControlMessage(
    serverId: string,
    connectionId: string
): Promise<boolean> {
    const response = await post(
        `${base(serverId)}/controls/${encodeURIComponent(connectionId)}`,
        { action: "refresh" }
    )
    return response.ok
}

export async function savePanelSettings(
    serverId: string,
    input: {
        panelId: string | null
        settings: unknown
        send: boolean
        expectedRevision: number | null
    }
): Promise<PanelSaveOutcome> {
    const response = await post(base(serverId), input)
    const body = await json<{
        id?: string
        revision?: number
        sent?: boolean
        error?: string
    }>(response)
    if (response.ok && body?.id)
        return {
            ok: true,
            id: body.id,
            revision: body.revision ?? 0,
            sent: Boolean(body.sent),
        }
    return { ok: false, error: body?.error ?? "unavailable" }
}

export async function saveServerJoin(
    serverId: string,
    connectionId: string,
    patch: {
        address?: string | null
        joinCode?: string | null
        password?: string | null
    }
): Promise<
    | Extract<PanelServerSaveResult, { status: "saved" }>
    | { status: "error"; error: string; field?: string }
> {
    const response = await post(
        `${base(serverId)}/servers/${encodeURIComponent(connectionId)}`,
        patch,
        "PUT"
    )
    const body = await json<{
        status?: string
        slug?: string
        joinUrl?: string | null
        error?: string
        field?: string
    }>(response)
    if (response.ok && body?.status === "saved" && body.slug)
        return {
            status: "saved",
            slug: body.slug,
            joinUrl: body.joinUrl ?? null,
        }
    return {
        status: "error",
        error: body?.error ?? "unavailable",
        ...(body?.field ? { field: body.field } : {}),
    }
}

export async function testPanelFetch(
    serverId: string,
    input: { connectionId: string; panelId: string | null }
): Promise<PanelTestResult | null> {
    const response = await post(`${base(serverId)}/test-fetch`, input)
    const body = await json<PanelTestResponse>(response)
    return response.ok && body && body.status !== "not_found" ? body : null
}

export async function checkPanelChannel(
    serverId: string,
    channelId: string
): Promise<PanelChannelCheck | null> {
    const response = await post(`${base(serverId)}/channel-check`, {
        channelId,
    })
    return response.ok ? json<PanelChannelCheck>(response) : null
}

export async function readLeaguePreview(
    serverId: string,
    count: number
): Promise<LeagueOverview | null> {
    const response = await fetch(
        `${base(serverId)}/league-preview?count=${encodeURIComponent(String(count))}`,
        { cache: "no-store" }
    )
    return response.ok ? json<LeagueOverview>(response) : null
}

/** An object URL of the rendered preview image; the caller revokes it. */
export async function renderPreviewImage(
    serverId: string,
    request: PanelImageRequest
): Promise<string | null> {
    const response = await post(`${base(serverId)}/preview-image`, request)
    if (!response.ok) return null
    return URL.createObjectURL(await response.blob())
}

/** Herní servery: provider address and key state per source (P2-30). */
export async function readGameServerSources(
    serverId: string
): Promise<GameServerSourceList | null> {
    const response = await fetch(
        `/api/servers/${encodeURIComponent(serverId)}/game-data-sources`,
        { cache: "no-store" }
    )
    return response.ok ? json<GameServerSourceList>(response) : null
}

/** Source ref → connection ID, from the collected snapshots (`/game-data`). */
export async function readConnectionRefs(
    serverId: string
): Promise<Record<string, string> | null> {
    const response = await fetch(
        `/api/servers/${encodeURIComponent(serverId)}/game-data`,
        { cache: "no-store" }
    )
    if (!response.ok) return null
    const body = await json<{
        connections?: Array<{ sourceRef: string; snapshot: { id: string } }>
    }>(response)
    return Object.fromEntries(
        (body?.connections ?? []).map((connection) => [
            connection.snapshot.id,
            connection.sourceRef,
        ])
    )
}
