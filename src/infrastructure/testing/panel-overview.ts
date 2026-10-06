import {
    buildPanelOverview,
    type PanelOverview,
    type StoredPanel,
    type StoredPublication,
} from "@/application/discord-publications/panel-overview"
import type { PanelStatusRecord } from "@/domain/discord-publications/panel-delivery"

/**
 * The panels of the design boards (P1, N1) as the real read model reports
 * them: two live HLL servers (the second in a private channel with its
 * password), a Wardogs server without Embed Links, "Naše servery" not sent
 * yet, a seed control message, "Výsledky HLL", the WD League panel and the
 * calendar paused by "Hráč 01". Channel IDs are the `channels` below.
 */
export const BOARD_PANEL_CHANNELS = [
    { id: "200000000000000001", name: "servery", type: 0 },
    { id: "200000000000000002", name: "klan-server", type: 0 },
    { id: "200000000000000003", name: "servery-wd", type: 0 },
    { id: "200000000000000004", name: "spravci", type: 0 },
    { id: "200000000000000005", name: "vysledky", type: 0 },
    { id: "200000000000000006", name: "liga", type: 0 },
    { id: "200000000000000007", name: "kalendar", type: 0 },
]

export const BOARD_EVENT_CATEGORIES = [
    { id: "event-category-k3j2x", label: "Zápas" },
    { id: "event-category-9fq1a", label: "Liga" },
]

const channel = (name: string) =>
    BOARD_PANEL_CHANNELS.find((entry) => entry.name === name)!.id

export function boardPanelOverview(
    now: number
): PanelOverview & { botInServer: boolean | null } {
    const panel = (overrides: Partial<StoredPanel>): StoredPanel => ({
        id: "p",
        kind: "server",
        gameId: "hell_let_loose",
        channelId: channel("servery"),
        enabled: true,
        draft: false,
        showPlayers: true,
        showLeaders: true,
        reportCategoryId: "report",
        artwork: true,
        revision: 2,
        createdAt: now - 86_400_000,
        savedAt: now - 3_600_000,
        ...overrides,
    })
    const status = (
        overrides: Partial<PanelStatusRecord> = {}
    ): PanelStatusRecord => ({
        claimedAt: now - 3_600_000,
        attemptAt: now - 12_000,
        successAt: now - 12_000,
        nextAt: now + 48_000,
        dataAt: now - 12_000,
        handledRequestAt: null,
        error: null,
        warnings: [],
        messages: 1,
        sentAt: now - 3_600_000,
        channelPrivate: false,
        ...overrides,
    })
    const delivered = (
        key: string,
        channelId: string,
        messageId: string
    ): StoredPublication => ({
        key,
        channelId,
        messageId,
        pending: false,
        lastSuccessAt: now - 12_000,
        retryAt: 0,
        error: null,
    })
    const view = buildPanelOverview({
        now,
        heartbeat: {
            version: "1.1.0",
            protocol: 2,
            startedAt: now - 86_400_000,
            seenAt: now - 12_000,
        },
        defaultStyle: "a",
        panels: [
            {
                panel: panel({ id: "p-v1", connectionId: "c-v1" }),
                status: status(),
                publications: [
                    delivered(
                        "panel:p-v1",
                        channel("servery"),
                        "300000000000000001"
                    ),
                ],
            },
            {
                panel: panel({
                    id: "p-v2",
                    connectionId: "c-v2",
                    channelId: channel("klan-server"),
                    content: { password: true },
                }),
                status: status({ channelPrivate: true }),
                publications: [
                    delivered(
                        "panel:p-v2",
                        channel("klan-server"),
                        "300000000000000002"
                    ),
                ],
            },
            {
                panel: panel({
                    id: "p-wd",
                    gameId: "wardogs",
                    connectionId: "c-wd",
                    channelId: channel("servery-wd"),
                }),
                status: status({
                    successAt: null,
                    sentAt: null,
                    messages: 0,
                    error: {
                        code: "missing_permissions",
                        at: now - 40_000,
                        permissions: ["embed_links"],
                    },
                }),
                publications: [],
            },
            {
                panel: panel({
                    id: "p-ours",
                    kind: "servers",
                    connectionIds: ["c-v1", "c-v2", "c-wd"],
                    channelId: channel("klan-server"),
                    draft: true,
                }),
                status: null,
                publications: [],
            },
            {
                panel: panel({
                    id: "p-res",
                    kind: "results",
                    channelId: channel("vysledky"),
                }),
                status: status(),
                publications: [
                    delivered(
                        "panel:p-res",
                        channel("vysledky"),
                        "300000000000000005"
                    ),
                ],
            },
            {
                panel: panel({
                    id: "p-league",
                    kind: "league",
                    gameId: "wardogs",
                    channelId: channel("liga"),
                }),
                status: status({ messages: 2 }),
                publications: [
                    delivered(
                        "panel:p-league:standings",
                        channel("liga"),
                        "300000000000000006"
                    ),
                    delivered(
                        "panel:p-league:fixtures",
                        channel("liga"),
                        "300000000000000016"
                    ),
                ],
            },
            {
                panel: panel({
                    id: "p-cal",
                    kind: "calendar",
                    gameId: "any",
                    channelId: channel("kalendar"),
                    paused: true,
                    pausedBy: "u1",
                    pausedAt: now - 3_600_000,
                    calendarCategories: BOARD_EVENT_CATEGORIES.map(
                        (category) => category.id
                    ),
                }),
                status: status(),
                publications: [
                    delivered(
                        "calendar",
                        channel("kalendar"),
                        "300000000000000007"
                    ),
                ],
            },
        ],
        sources: [
            {
                connectionId: "c-v1",
                name: "Vlci #1 · Public",
                gameId: "hell_let_loose",
                provider: "hll_crcon",
                collecting: true,
                lastDataAt: now - 12_000,
                freshness: "fresh",
                errorCategory: null,
            },
            {
                connectionId: "c-v2",
                name: "Vlci #2 · Trénink a zápasy",
                gameId: "hell_let_loose",
                provider: "hll_crcon",
                collecting: true,
                lastDataAt: now - 12_000,
                freshness: "fresh",
                errorCategory: null,
            },
            {
                connectionId: "c-wd",
                name: "Vlci WD",
                gameId: "wardogs",
                provider: "wardogs_warcon",
                collecting: true,
                lastDataAt: now - 52_000,
                freshness: "fresh",
                errorCategory: null,
            },
        ],
        servers: [
            {
                connectionId: "c-v2",
                slug: "vlci-2",
                joinUrl: "https://logi.app/join/vlci-2",
                address: "203.0.113.25:7777",
                joinCode: null,
                hasPassword: true,
            },
        ],
        controls: [
            {
                connectionId: "c-v1",
                channelId: channel("spravci"),
                message: {
                    channelId: channel("spravci"),
                    messageId: "300000000000000004",
                    revision: 3,
                    deliveredRevision: 3,
                    lastSuccessAt: now - 12_000,
                    error: null,
                    pending: false,
                },
            },
        ],
        people: { u1: "Hráč 01" },
    })
    return { ...view, botInServer: true }
}
