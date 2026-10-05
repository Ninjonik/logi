"use client"

import { useSyncExternalStore } from "react"

import type {
    AnnouncementPreview,
    PreviewValue,
} from "@/lib/discord-announcement-preview"
import type { Dictionary } from "@/i18n/dictionaries"
import { cn } from "@/lib/utils"

const buttonStyles = {
    success: "bg-[#248046] text-white",
    primary: "bg-[#5865f2] text-white",
    danger: "bg-[#da373c] text-white",
    link: "bg-muted text-foreground border border-border",
} as const

function intlLocale(locale: string) {
    return locale === "cs" ? "cs-CZ" : locale === "de" ? "de-DE" : "en-GB"
}

/** Discord renders `<t:…>` timestamps in the reader's own time zone and language. */
function formatTimestamp(
    iso: string,
    style: "F" | "f" | "t" | "R",
    locale: string
) {
    const date = new Date(iso)
    if (!Number.isFinite(date.getTime())) return "—"
    const intl = intlLocale(locale)
    if (style === "R") {
        const minutes = Math.round((date.getTime() - Date.now()) / 60000)
        const relative = new Intl.RelativeTimeFormat(intl, { numeric: "auto" })
        if (Math.abs(minutes) < 60) return relative.format(minutes, "minute")
        const hours = Math.round(minutes / 60)
        if (Math.abs(hours) < 48) return relative.format(hours, "hour")
        return relative.format(Math.round(hours / 24), "day")
    }
    return new Intl.DateTimeFormat(
        intl,
        style === "t"
            ? { hour: "2-digit", minute: "2-digit" }
            : style === "f"
              ? { dateStyle: "long", timeStyle: "short" }
              : { dateStyle: "full", timeStyle: "short" }
    ).format(date)
}

const subscribeNever = () => () => undefined

/** Timestamps depend on the reader's clock and time zone, so they render only in the browser. */
function useIsBrowser() {
    return useSyncExternalStore(
        subscribeNever,
        () => true,
        () => false
    )
}

function Value({ value, locale }: { value: PreviewValue; locale: string }) {
    const isBrowser = useIsBrowser()
    if (value.kind === "code")
        return (
            <code className="bg-muted rounded px-1 py-0.5 text-[0.8em]">
                {value.text}
            </code>
        )
    if (value.kind === "time")
        return (
            <span className="bg-muted/70 rounded px-1">
                {isBrowser
                    ? formatTimestamp(value.iso, value.style, locale)
                    : "…"}
            </span>
        )
    return <span className="whitespace-pre-line">{value.text}</span>
}

/**
 * How the bot's registration announcement will look (design D2). It renders
 * the model from `buildAnnouncementPreview`, so the lines match the bot.
 */
export function DiscordAnnouncementPreview({
    preview,
    locale,
    dictionary,
}: {
    preview: AnnouncementPreview
    locale: string
    dictionary: Dictionary
}) {
    const text = dictionary.matchTemplates.preview
    return (
        <aside aria-labelledby="discord-preview-title" className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2
                    id="discord-preview-title"
                    className="text-sm font-semibold"
                >
                    {text.title}
                </h2>
                <span className="text-muted-foreground text-xs">
                    {text.hint}
                </span>
            </div>
            <div className="bg-muted/40 border-border/60 rounded-2xl border p-3 sm:p-4">
                <div className="flex gap-3">
                    <span
                        className="bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                        aria-hidden="true"
                    >
                        L
                    </span>
                    <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-1.5 text-sm">
                            <span className="font-semibold">Logi</span>
                            <span className="rounded bg-[#5865f2] px-1 text-[10px] font-semibold text-white">
                                APP
                            </span>
                            <span className="text-muted-foreground text-xs">
                                {text.today}
                            </span>
                        </div>
                        <div
                            className="bg-background border-border/60 space-y-3 rounded-lg border border-l-4 p-3 text-sm"
                            style={{ borderLeftColor: preview.accentColor }}
                        >
                            {preview.mentions.length ? (
                                <p className="flex flex-wrap gap-1">
                                    {preview.mentions.map((mention) => (
                                        <span
                                            key={mention}
                                            className="rounded bg-[#5865f2]/15 px-1 font-medium text-[#4752c4] dark:text-[#c9cdfb]"
                                        >
                                            @{mention}
                                        </span>
                                    ))}
                                </p>
                            ) : null}
                            <div className="flex gap-3">
                                <div className="min-w-0 flex-1 space-y-1">
                                    <p className="text-lg leading-tight font-bold break-words">
                                        {preview.title}
                                    </p>
                                    {preview.blocks[0]?.map((line) => (
                                        <p
                                            key={`${line.emoji}${line.label}`}
                                            className="leading-snug break-words"
                                        >
                                            <strong>
                                                {line.emoji} {line.label}:
                                            </strong>{" "}
                                            {line.values.map((value, index) => (
                                                <span key={index}>
                                                    {index ? " (" : null}
                                                    <Value
                                                        value={value}
                                                        locale={locale}
                                                    />
                                                    {index ? ")" : null}
                                                </span>
                                            ))}
                                        </p>
                                    ))}
                                </div>
                                {preview.thumbnailUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={preview.thumbnailUrl}
                                        alt=""
                                        className="size-16 shrink-0 rounded-md object-cover"
                                    />
                                ) : null}
                            </div>
                            {preview.blocks.slice(1).map((block, index) => (
                                <div
                                    key={index}
                                    className="border-border/60 space-y-1 border-t pt-3"
                                >
                                    {block.map((line) => (
                                        <p
                                            key={`${line.emoji}${line.label}`}
                                            className="leading-snug break-words"
                                        >
                                            <strong>
                                                {line.emoji} {line.label}:
                                            </strong>{" "}
                                            {line.values.map(
                                                (value, valueIndex) => (
                                                    <span key={valueIndex}>
                                                        {valueIndex
                                                            ? " ("
                                                            : null}
                                                        <Value
                                                            value={value}
                                                            locale={locale}
                                                        />
                                                        {valueIndex
                                                            ? ")"
                                                            : null}
                                                    </span>
                                                )
                                            )}
                                        </p>
                                    ))}
                                </div>
                            ))}
                            <div className="border-border/60 space-y-2 border-t pt-3">
                                {preview.signupSections.map((section) => (
                                    <p
                                        key={section.title}
                                        className="leading-snug"
                                    >
                                        <strong>{section.title}</strong>
                                        <br />
                                        {/* The bot's "nobody yet" text is Discord italics (`*…*`). */}
                                        <em className="text-muted-foreground">
                                            {section.text.replace(
                                                /^\*(.*)\*$/,
                                                "$1"
                                            )}
                                        </em>
                                    </p>
                                ))}
                            </div>
                            {preview.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={preview.imageUrl}
                                    alt=""
                                    className="max-h-48 w-full rounded-md object-cover"
                                />
                            ) : null}
                            <div className="flex flex-wrap gap-1.5">
                                {preview.buttons.map((button) => (
                                    <span
                                        key={button.label}
                                        className={cn(
                                            "inline-flex h-8 items-center gap-1 rounded-md px-3 text-xs font-medium",
                                            buttonStyles[button.style]
                                        )}
                                    >
                                        {button.emoji ? (
                                            <span aria-hidden="true">
                                                {button.emoji}
                                            </span>
                                        ) : null}
                                        {button.label}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <p className="text-muted-foreground text-xs">{text.note}</p>
        </aside>
    )
}
