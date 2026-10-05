"use client"

import {
    TriangleAlert,
    Bell,
    Bug,
    Info,
    Megaphone,
    Radio,
    Trophy,
} from "lucide-react"
import { useState, type ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import Link from "next/link"

import {
    SettingsField,
    SettingsPanel,
} from "@/components/app/settings/settings-panel"
import { DiscordPublicPanelsForm } from "@/components/app/discord-public-panels-form"
import { withGameOverrides, type GameId } from "@/domain/games/game"
import { useDiscordMetadata } from "@/hooks/use-discord-metadata"
import type { Dictionary } from "@/i18n/dictionaries"
import type { DiscordConfig } from "@/types/domain"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function MessageRow({
    icon: Icon,
    title,
    detail,
    warning = false,
    action,
    children,
}: {
    icon: LucideIcon
    title: string
    detail: ReactNode
    warning?: boolean
    action?: ReactNode
    children?: ReactNode
}) {
    return (
        <li className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-start gap-3">
                <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
                    <Icon className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="text-sm font-medium">{title}</div>
                    <div
                        className={cn(
                            "flex items-start gap-1.5 text-[13px]",
                            warning
                                ? "text-amber-800 dark:text-amber-200"
                                : "text-muted-foreground"
                        )}
                    >
                        {warning ? (
                            <TriangleAlert
                                className="mt-0.5 size-3.5 shrink-0"
                                aria-hidden="true"
                            />
                        ) : null}
                        <span className="min-w-0 break-words">{detail}</span>
                    </div>
                </div>
                {action ? <div className="shrink-0">{action}</div> : null}
            </div>
            {children ? <div className="mt-4">{children}</div> : null}
        </li>
    )
}

/**
 * Discord messages (design D4): the language every bot message uses and the
 * messages the bot sends, with where each goes and where to change it. The
 * public panel editor opens inline under its row.
 */
export function DiscordMessagesSettings({
    serverId,
    gameId,
    config,
    enabledGames,
    hrefs,
    dictionary,
}: {
    serverId: string
    gameId?: GameId
    config: DiscordConfig | null
    enabledGames: readonly GameId[]
    hrefs: { channels: string; league: string }
    dictionary: Dictionary
}) {
    const text = dictionary.settingsHub.messagesPage
    const metadata = useDiscordMetadata(serverId)
    const [panelsOpen, setPanelsOpen] = useState(false)
    const scoped = config
        ? withGameOverrides(config, config.gameOverrides, gameId)
        : null

    function channel(channelId: string | undefined, offText: string) {
        if (!channelId) return { label: offText, set: false }
        const found = metadata?.channels.find((item) => item.id === channelId)
        return {
            label: found ? `#${found.name}` : text.channelUnknown,
            set: true,
        }
    }
    const announcements = channel(
        scoped?.announcementsChannelId,
        text.channelNotSet
    )
    const eventInfo = channel(scoped?.eventInfoChannelId, text.channelOff)
    const errors = channel(config?.errorsChannelId, text.channelOff)
    const editLink = (href: string) => (
        <Button asChild variant="outline" size="sm" className="rounded-lg">
            <Link href={href}>{text.edit}</Link>
        </Button>
    )

    return (
        <div className="space-y-6">
            <SettingsPanel id="messages-look" title={text.lookTitle}>
                <SettingsField
                    label={text.language}
                    help={
                        <>
                            {text.languageHelp}{" "}
                            <Link
                                href={hrefs.channels}
                                className="text-foreground underline underline-offset-3"
                            >
                                {text.languageLink}
                            </Link>
                        </>
                    }
                >
                    <div className="bg-muted/40 rounded-xl border px-3 py-2 text-sm font-medium">
                        {text.languages[config?.defaultLanguage ?? "en"]}
                    </div>
                </SettingsField>
            </SettingsPanel>
            <SettingsPanel id="messages-list" title={text.listTitle}>
                <ul className="divide-y">
                    <MessageRow
                        icon={Megaphone}
                        title={text.announcement}
                        detail={
                            announcements.set
                                ? `${announcements.label} · ${text.announcementDetail}`
                                : announcements.label
                        }
                        warning={!announcements.set}
                        action={editLink(hrefs.channels)}
                    />
                    <MessageRow
                        icon={Info}
                        title={text.eventInfo}
                        detail={
                            eventInfo.set
                                ? `${eventInfo.label} · ${text.eventInfoDetail}`
                                : eventInfo.label
                        }
                        action={editLink(hrefs.channels)}
                    />
                    <MessageRow
                        icon={Bell}
                        title={text.reminders}
                        detail={
                            <>
                                {text.remindersDetail}
                                <span className="block">
                                    {text.remindersNote}
                                </span>
                            </>
                        }
                    />
                    <MessageRow
                        icon={Radio}
                        title={text.panels}
                        detail={text.panelsDetail}
                        action={
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="rounded-lg"
                                aria-expanded={panelsOpen}
                                aria-controls="messages-panels-editor"
                                onClick={() => setPanelsOpen((open) => !open)}
                            >
                                {panelsOpen ? text.close : text.edit}
                            </Button>
                        }
                    >
                        {panelsOpen ? (
                            <div id="messages-panels-editor">
                                <DiscordPublicPanelsForm
                                    serverId={serverId}
                                    gameId={gameId}
                                    dictionary={dictionary}
                                />
                            </div>
                        ) : null}
                    </MessageRow>
                    {enabledGames.includes("wardogs") ? (
                        <MessageRow
                            icon={Trophy}
                            title={text.league}
                            detail={text.leagueDetail}
                            action={editLink(hrefs.league)}
                        />
                    ) : null}
                    <MessageRow
                        icon={Bug}
                        title={text.errors}
                        detail={
                            errors.set
                                ? `${errors.label} · ${text.errorsDetail}`
                                : errors.label
                        }
                        action={editLink(hrefs.channels)}
                    />
                </ul>
            </SettingsPanel>
        </div>
    )
}
