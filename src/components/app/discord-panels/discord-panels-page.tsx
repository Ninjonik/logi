"use client"

import { useMemo, useState } from "react"
import { useLocale } from "next-intl"
import { toast } from "sonner"

import { useDiscordMetadata } from "@/hooks/use-discord-metadata"
import type { Dictionary } from "@/i18n/dictionaries"

import { refreshControlMessage, requestPanelAction } from "./panels-api"
import { usePanelOverview, useNow } from "./use-panel-overview"
import { panelRows, type PanelRowContext } from "./panel-rows"
import { PanelListCard, type RowAction } from "./panel-list"
import { DataSourcesCard } from "./data-sources-card"
import { BotStatusStrip } from "./bot-status-strip"

export type DiscordPanelsHrefs = {
    /** The panels page; the editor is `${panels}/<panelId>` and `${panels}/new`. */
    panels: string
    gameServers: string
    seed: string
}

/**
 * "Panely v Discordu" (board P1): the bot heartbeat, the data sources and
 * every panel with its state, timing, last error and live actions. The
 * page reads the overview again every few seconds while it is open.
 */
export function DiscordPanelsPage({
    serverId,
    guildId,
    hrefs,
    categories,
    competitions,
    calendarSetting = null,
    dictionary,
}: {
    serverId: string
    guildId: string
    hrefs: DiscordPanelsHrefs
    categories: ReadonlyArray<{ id: string; label: string }>
    competitions: ReadonlyArray<{ id: string; name: string }>
    /** The calendar channel saved before panels existed (N1-47). */
    calendarSetting?: PanelRowContext["calendarSetting"]
    dictionary: Dictionary
}) {
    const locale = useLocale()
    const now = useNow()
    const metadata = useDiscordMetadata(serverId)
    const { overview, status, refresh } = usePanelOverview(serverId)
    const [busy, setBusy] = useState(false)
    const text = dictionary.discordPanelsPage

    const groups = useMemo(
        () =>
            overview
                ? panelRows(overview, {
                      dictionary,
                      locale,
                      guildId,
                      channels: metadata?.channels ?? null,
                      now,
                      categories,
                      competitions,
                      calendarSetting,
                  })
                : [],
        [
            overview,
            dictionary,
            locale,
            guildId,
            metadata,
            now,
            categories,
            competitions,
            calendarSetting,
        ]
    )

    async function onAction(action: RowAction) {
        setBusy(true)
        try {
            if (action.kind === "control") {
                const ok = await refreshControlMessage(
                    serverId,
                    action.connectionId
                )
                if (ok) toast.success(text.actions.accepted.control)
                else toast.error(text.actions.failed)
            } else {
                const result = await requestPanelAction(
                    serverId,
                    action.panelId,
                    action.action
                )
                if (result.ok)
                    toast.success(text.actions.accepted[action.action])
                else
                    toast.error(
                        result.error === "not_sent"
                            ? text.actions.notSent
                            : result.error === "removing"
                              ? text.actions.removing
                              : result.error === "not_found"
                                ? text.actions.notFound
                                : text.actions.failed
                    )
            }
            await refresh()
        } finally {
            setBusy(false)
        }
    }

    if (!overview)
        return (
            <p
                role={status === "failed" ? "alert" : "status"}
                className="text-muted-foreground rounded-2xl border px-5 py-6 text-sm"
            >
                {status === "failed" ? text.list.loadFailed : text.list.loading}
            </p>
        )

    return (
        <div className="space-y-4">
            <BotStatusStrip
                bot={overview.bot}
                botInServer={overview.botInServer}
                now={now}
                locale={locale}
                dictionary={dictionary}
            />
            <DataSourcesCard
                overview={overview}
                gameServersHref={hrefs.gameServers}
                now={now}
                locale={locale}
                dictionary={dictionary}
            />
            <PanelListCard
                groups={groups}
                editHref={(row) =>
                    row.panelId
                        ? `${hrefs.panels}/${encodeURIComponent(row.panelId)}`
                        : row.source === "control" && row.connectionId
                          ? `${hrefs.seed}?server=${encodeURIComponent(row.connectionId)}`
                          : // The calendar saved before panels existed becomes a panel.
                            `${hrefs.panels}/new?type=calendar`
                }
                busy={busy}
                onAction={(action) => void onAction(action)}
                now={now}
                locale={locale}
                dictionary={dictionary}
            />
        </div>
    )
}
