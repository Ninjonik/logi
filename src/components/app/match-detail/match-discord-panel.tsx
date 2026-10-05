import { ExternalLink, MessageSquare } from "lucide-react"

import {
    discordUrl,
    type EventDiscordMessages,
} from "@/lib/read-models/match-detail"
import { EmptyState } from "@/components/app/empty-state"
import type { Dictionary } from "@/i18n/dictionaries"
import type { EventRecord } from "@/types/domain"
import { Button } from "@/components/ui/button"

/** Where the bot posted a match, with links into Discord. */
export function MatchDiscordPanel({
    event,
    guildDiscordId,
    messages,
    eventInfoChannelId,
    meetingChannelId,
    dictionary,
}: {
    event: EventRecord
    guildDiscordId: string
    messages: EventDiscordMessages | null
    eventInfoChannelId?: string
    meetingChannelId?: string
    dictionary: Dictionary
}) {
    const t = dictionary.matchDetail.discord
    const announcementChannelId =
        messages?.announcementChannelId ?? event.announcementChannelId
    const rows: Array<{ label: string; href?: string; status?: string }> = [
        {
            label: t.announcement,
            href:
                announcementChannelId && messages?.announcementMessageId
                    ? discordUrl(
                          guildDiscordId,
                          announcementChannelId,
                          messages.announcementMessageId
                      )
                    : undefined,
        },
        {
            label: t.eventInfo,
            href:
                eventInfoChannelId && messages?.eventInfoMessageId
                    ? discordUrl(
                          guildDiscordId,
                          eventInfoChannelId,
                          messages.eventInfoMessageId
                      )
                    : undefined,
        },
        {
            label: t.forumThread,
            href: messages?.forumThreadId
                ? discordUrl(guildDiscordId, messages.forumThreadId)
                : undefined,
        },
        {
            label: t.rosterUpdate,
            href:
                messages?.rosterUpdateChannelId &&
                messages.rosterUpdateMessageId
                    ? discordUrl(
                          guildDiscordId,
                          messages.rosterUpdateChannelId,
                          messages.rosterUpdateMessageId
                      )
                    : undefined,
        },
        {
            label: t.scheduledEvent,
            href: messages?.scheduledEventId
                ? `https://discord.com/events/${guildDiscordId}/${messages.scheduledEventId}`
                : undefined,
            status: messages?.scheduledEventStatus
                ? t.scheduledStatus[messages.scheduledEventStatus]
                : undefined,
        },
    ]
    const channels = [
        { label: t.announcementChannel, id: announcementChannelId },
        { label: t.eventInfoChannel, id: eventInfoChannelId },
        { label: t.meetingChannel, id: meetingChannelId },
    ]

    return (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
            {messages ? (
                <section
                    aria-labelledby="match-discord-title"
                    className="border-border/60 bg-card rounded-2xl border p-4 sm:p-5"
                >
                    <h2
                        id="match-discord-title"
                        className="text-base font-semibold"
                    >
                        {t.title}
                    </h2>
                    <p className="text-muted-foreground mt-1 text-sm">
                        {t.description}
                    </p>
                    <ul className="divide-border/60 mt-4 divide-y">
                        {rows.map((row) => (
                            <li
                                key={row.label}
                                className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                            >
                                <span className="text-sm font-medium">
                                    {row.label}
                                    {row.status ? (
                                        <span className="text-muted-foreground font-normal">
                                            {` · ${row.status}`}
                                        </span>
                                    ) : null}
                                </span>
                                {row.href ? (
                                    <Button
                                        asChild
                                        size="sm"
                                        variant="outline"
                                        className="rounded-lg"
                                    >
                                        <a
                                            href={row.href}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            {t.open}
                                            <ExternalLink className="size-3.5" />
                                        </a>
                                    </Button>
                                ) : (
                                    <span className="text-muted-foreground text-sm">
                                        {t.notPosted}
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                </section>
            ) : (
                <EmptyState
                    icon={MessageSquare}
                    title={t.noSyncTitle}
                    description={t.noSyncDescription}
                />
            )}
            <aside
                aria-labelledby="match-discord-channels"
                className="border-border/60 bg-card h-fit rounded-2xl border p-4 sm:p-5"
            >
                <h2
                    id="match-discord-channels"
                    className="text-base font-semibold"
                >
                    {t.channels}
                </h2>
                <dl className="mt-3 space-y-2 text-sm">
                    {channels.map((channel) => (
                        <div
                            key={channel.label}
                            className="flex items-center justify-between gap-3"
                        >
                            <dt className="text-muted-foreground">
                                {channel.label}
                            </dt>
                            <dd>
                                {channel.id ? (
                                    <a
                                        className="text-primary underline-offset-4 hover:underline"
                                        href={discordUrl(
                                            guildDiscordId,
                                            channel.id
                                        )}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        {t.open}
                                    </a>
                                ) : (
                                    <span className="text-muted-foreground">
                                        {t.notSet}
                                    </span>
                                )}
                            </dd>
                        </div>
                    ))}
                </dl>
            </aside>
        </div>
    )
}
