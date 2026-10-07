import type { ReactNode } from "react"

import {
    SETTINGS_PREVIEW_NOW,
    settingsPreview,
    type SettingsPreviewClan,
    type SettingsPreviewKind,
} from "@/domain/discord-messages/settings-previews"
import {
    applicationPanelDefaults,
    getApplicationMessages,
} from "@/lib/clan-language/application"
import { DiscordMessagePreview } from "@/components/app/discord-preview/discord-message-preview"
import type { RosterMessageVariant } from "@/domain/discord-messages/roster-message"
import type { MessageStyle } from "@/domain/discord-messages/message-style"
import { getAnnouncementMessages } from "@/lib/clan-language/announcements"
import { getDirectMessages } from "@/lib/clan-language/direct-messages"
import { getIntlLocaleForClanLanguage } from "@/lib/clan-language/core"
import { getTicketMessages } from "@/lib/clan-language/tickets"
import { getRosterMessages } from "@/lib/clan-language/rosters"
import { getSystemMessages } from "@/lib/clan-language/system"
import { getPanelMessages } from "@/lib/clan-language/panels"
import type { Dictionary } from "@/i18n/dictionaries"

/**
 * The sample message of one row, as the bot draws it with its own builder,
 * with the clan's look and, where set, the clan's membership and ticket
 * panels (N1-08, N1-B07).
 */
export function SettingsMessagePreview({
    kind,
    language,
    style,
    rosterVariant,
    timeZone,
    siteUrl,
    clan,
    dictionary,
}: {
    kind: SettingsPreviewKind
    language: string
    style: MessageStyle
    rosterVariant: RosterMessageVariant
    timeZone: string
    siteUrl: string
    /** The clan's membership and ticket panels; samples without them. */
    clan?: SettingsPreviewClan
    dictionary: Dictionary
}) {
    const system = getSystemMessages(language)
    const preview = settingsPreview({
        kind,
        samples: system.previews,
        dm: getDirectMessages(language),
        roster: getRosterMessages(language),
        errors: system.errorsChannel,
        teamRequests: system.teamRequests,
        announcement: getAnnouncementMessages(language),
        applications: getApplicationMessages(language),
        applicationPanelDefaults,
        tickets: getTicketMessages(language),
        reports: getPanelMessages(language).report,
        clan,
        layout: {
            copy: system.kit,
            locale: getIntlLocaleForClanLanguage(language),
            style,
        },
        timeZone,
        now: SETTINGS_PREVIEW_NOW,
        rosterVariant,
        siteUrl,
    })
    return (
        <DiscordMessagePreview
            view={preview.view}
            language={language}
            style={style}
            labels={dictionary.discordPreview}
            now={SETTINGS_PREVIEW_NOW}
            timeZone={timeZone}
            mentions={{
                channels: preview.channels,
                users: preview.users,
                roles: preview.roles,
            }}
            author={{ time: dictionary.settingsHub.messagesPage.previewTime }}
            content={preview.content}
        />
    )
}

/** The open preview under a row: the sample and, optionally, a side note. */
export function PreviewPanel({
    id,
    label,
    title,
    aside,
    children,
}: {
    id: string
    label: string
    title?: string
    aside?: ReactNode
    children: ReactNode
}) {
    return (
        <section
            id={id}
            aria-label={label}
            className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]"
        >
            <div className="min-w-0 space-y-2">
                {title ? (
                    <h4 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                        {title}
                    </h4>
                ) : null}
                {children}
            </div>
            {aside ? (
                <div className="min-w-0 text-[13px] leading-5">{aside}</div>
            ) : null}
        </section>
    )
}
