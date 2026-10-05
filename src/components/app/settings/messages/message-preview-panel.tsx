import type { ReactNode } from "react"

import {
    SETTINGS_PREVIEW_NOW,
    settingsPreview,
    type SettingsPreviewKind,
} from "@/domain/discord-messages/settings-previews"
import { DiscordMessagePreview } from "@/components/app/discord-preview/discord-message-preview"
import type { RosterMessageVariant } from "@/domain/discord-messages/roster-message"
import type { MessageStyle } from "@/domain/discord-messages/message-style"
import { getDirectMessages } from "@/lib/clan-language/direct-messages"
import { getIntlLocaleForClanLanguage } from "@/lib/clan-language/core"
import { getRosterMessages } from "@/lib/clan-language/rosters"
import { getSystemMessages } from "@/lib/clan-language/system"
import type { Dictionary } from "@/i18n/dictionaries"

/** The sample message of one row, as the bot draws it, with the clan's look. */
export function SettingsMessagePreview({
    kind,
    language,
    style,
    rosterVariant,
    timeZone,
    siteUrl,
    dictionary,
}: {
    kind: SettingsPreviewKind
    language: string
    style: MessageStyle
    rosterVariant: RosterMessageVariant
    timeZone: string
    siteUrl: string
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
            mentions={{ channels: preview.channels }}
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
