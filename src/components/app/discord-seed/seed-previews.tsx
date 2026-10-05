import type { ReactNode } from "react"

import { DiscordMessagePreview } from "@/components/app/discord-preview/discord-message-preview"
import type { MessageStyle } from "@/domain/discord-messages/message-style"
import type { MessageView } from "@/domain/discord-messages/message-view"
import type { Dictionary } from "@/i18n/dictionaries"

import { fillSeedText } from "./seed-page-state"

type PreviewContext = {
    /** The clan language of the bot's words. */
    language: string
    style: MessageStyle | null
    labels: Dictionary["discordPreview"]
    now: number
    timeZone: string
    /** "dnes v 17:00" beside the bot's name. */
    authorTime: string
}

function PreviewFrame({
    caption,
    children,
}: {
    caption: string
    children: ReactNode
}) {
    return (
        <figure className="m-0 min-w-0 space-y-2">
            <figcaption className="text-[13px] font-semibold">
                {caption}
            </figcaption>
            <div className="flex min-w-0 flex-col gap-1 rounded-xl bg-[#313338]">
                {children}
            </div>
        </figure>
    )
}

/**
 * The call as the bot posts it and the same message at the live threshold
 * (P3-19, P3-20), rebuilt from the plan as it is typed. The "@Seed" line is
 * the ping above the card; edits never ping again.
 */
export function SeedCallPreviews({
    seeding,
    live,
    leadRole,
    channel,
    liveFrom,
    context,
    text,
}: {
    seeding: MessageView
    live: MessageView | null
    /** "Seed" for the "@Seed" line, or null for a silent call. */
    leadRole: string | null
    /** "#seed", or a placeholder until a channel is chosen. */
    channel: string
    liveFrom: number
    context: PreviewContext
    text: Dictionary["seedPage"]["previews"]
}) {
    const shared = {
        language: context.language,
        style: context.style,
        labels: context.labels,
        now: context.now,
        timeZone: context.timeZone,
    }
    return (
        <div className="min-w-0 space-y-4">
            <PreviewFrame caption={fillSeedText(text.call, { channel })}>
                {leadRole ? (
                    <p className="m-0 px-4 pt-3 text-[13px] leading-5">
                        <span className="rounded-[3px] bg-[#5865f2]/30 px-0.5 font-medium text-[#c9cdfb]">
                            @{leadRole}
                        </span>
                    </p>
                ) : null}
                <DiscordMessagePreview
                    {...shared}
                    view={seeding}
                    author={{ time: context.authorTime }}
                    className={leadRole ? "pt-2" : undefined}
                />
            </PreviewFrame>
            {live ? (
                <PreviewFrame
                    caption={fillSeedText(text.live, { count: liveFrom })}
                >
                    <DiscordMessagePreview
                        {...shared}
                        view={live}
                        author={{ time: context.authorTime, edited: true }}
                    />
                </PreviewFrame>
            ) : (
                <p className="bg-muted/50 rounded-xl border px-3 py-2.5 text-[13px]">
                    {fillSeedText(text.deleted, { count: liveFrom })}
                </p>
            )}
            <p className="text-muted-foreground text-xs">{text.note}</p>
        </div>
    )
}

/** "Ovládání serveru" as the admins see it in the private channel (P3-24, P5-26). */
export function SeedControlPreview({
    view,
    channel,
    context,
    text,
}: {
    view: MessageView
    channel: string
    context: PreviewContext
    text: Dictionary["seedPage"]["previews"]
}) {
    return (
        <PreviewFrame caption={fillSeedText(text.control, { channel })}>
            <DiscordMessagePreview
                language={context.language}
                style={context.style}
                labels={context.labels}
                now={context.now}
                timeZone={context.timeZone}
                view={view}
                author={{ time: context.authorTime, edited: true }}
            />
        </PreviewFrame>
    )
}
