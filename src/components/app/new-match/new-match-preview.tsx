"use client"

import { useSyncExternalStore, type ReactNode } from "react"

import {
    messageLineIcon,
    type MessageIconDensity,
    type MessageLine,
} from "@/domain/discord-messages/message-style"
import {
    NEUTRAL_FACTION_MARKER,
    panelFactionOf,
} from "@/domain/discord-publications/panel-presentation"
import { resolveMessageAccentColor } from "@/domain/discord-messages/format"
import type { NewMatchStep } from "@/domain/events/new-match-flow"
import { getClanDiscordMessages } from "@/lib/clan-language"
import type { Dictionary } from "@/i18n/dictionaries"
import { cn } from "@/lib/utils"

export type NewMatchPreviewModel = {
    kind: "match" | "training"
    /** The clan's bot language; the message is written in it. */
    language: string
    /** The event name; the bot adds the category label after it. */
    title: string
    categoryLabel?: string | null
    /** Teams by slot with their stored side ("Allies", "Valkyra", ...). */
    teams: Array<{ code: string; side: string | null }>
    /** Map name and time-of-day key ("day", "night", ...). */
    map: { name: string; time: string | null } | null
    cap: string | null
    meetingStart: string | null
    gameStart: string | null
    registrationEnd: string | null
    groups: Array<{ name: string; max?: number }>
    /** Role names the announcement pings, shown above the card. */
    mentions: string[]
    forum: boolean
    /** The event category's colour, before the clan's accent colour. */
    categoryColor?: string
    /** The clan's message style (Settings › Discord messages). */
    messageStyle?: { accentColor?: string; iconDensity?: MessageIconDensity }
    /** The notes (or the description) the bot shows below the times. */
    notes?: string | null
    thumbnailUrl?: string | null
    /** Sign-ups of a published match; a new one shows zero. */
    signups?: { total: number; byGroup: Record<string, number> }
}

const subscribeNever = () => () => undefined
/** Discord shows times in each reader's zone, so they render in the browser only. */
function useIsBrowser() {
    return useSyncExternalStore(
        subscribeNever,
        () => true,
        () => false
    )
}

/** The bot's emblem before a side: HLL team colours, a marker for Wardogs factions. */
function sideEmblem(side: string | null) {
    const faction = panelFactionOf(side)
    if (!faction) return null
    if (faction === "allies") return "🟦"
    if (faction === "axis") return "🟥"
    return NEUTRAL_FACTION_MARKER
}

function relativeTime(iso: string, locale: string) {
    const minutes = Math.round((Date.parse(iso) - Date.now()) / 60000)
    const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
    if (Math.abs(minutes) < 60) return relative.format(minutes, "minute")
    const hours = Math.round(minutes / 60)
    if (Math.abs(hours) < 48) return relative.format(hours, "hour")
    return relative.format(Math.round(hours / 24), "day")
}

function Section({
    active,
    children,
    className,
}: {
    active: boolean
    children: ReactNode
    className?: string
}) {
    return (
        <div
            className={cn(
                "rounded-md outline-offset-4 transition-[outline-color]",
                active
                    ? "outline-2 outline-sky-400 outline-solid"
                    : "outline-transparent",
                className
            )}
        >
            {children}
        </div>
    )
}

/**
 * The registration announcement as the bot posts it (design D2, message style
 * H1): the ping above the card, the title, the teams with their sides, the
 * start, map, meeting and sign-up deadline on one line, the sign-up counts
 * with group caps, the buttons and the footer. Values the match does not have
 * yet (sign-ups, the forum link) show as they will right after publishing. The
 * part the current step changes is outlined.
 */
export function NewMatchPreview({
    model,
    step,
    dictionary,
    copy,
    hint,
    note,
}: {
    model: NewMatchPreviewModel
    /** The step whose part is outlined; the review step outlines nothing. */
    step: NewMatchStep
    dictionary: Dictionary
    /** The preview copy in the clan's bot language. */
    copy: Dictionary["newMatch"]["preview"]
    /** Replaces the hint beside the title. */
    hint?: string
    /** Replaces the note below the message; null leaves it out. */
    note?: string | null
}) {
    const isBrowser = useIsBrowser()
    const text = dictionary.newMatch.preview
    const messages = getClanDiscordMessages(model.language)
    const intl = messages.locale
    const valid = (iso: string | null): iso is string =>
        Boolean(iso && Number.isFinite(Date.parse(iso)))
    const formatFull = (iso: string) =>
        new Intl.DateTimeFormat(intl, {
            dateStyle: "full",
            timeStyle: "short",
        }).format(new Date(iso))
    const formatTime = (iso: string) =>
        new Intl.DateTimeFormat(intl, {
            hour: "2-digit",
            minute: "2-digit",
        }).format(new Date(iso))
    const sideLabel = (side: string) => {
        const faction = panelFactionOf(side)
        return faction === "allies" || faction === "axis"
            ? copy.factions[faction]
            : side
    }
    const isMatch = model.kind === "match"
    const icon = (line: MessageLine) =>
        messageLineIcon(line, model.messageStyle?.iconDensity)
    const accentColor = `#${resolveMessageAccentColor({
        categoryColor: model.categoryColor,
        messageStyle: model.messageStyle,
    })
        .toString(16)
        .padStart(6, "0")}`
    const title =
        model.categoryLabel && model.categoryLabel !== model.title.trim()
            ? `${model.title || dictionary.newMatch.untitled} · ${model.categoryLabel}`
            : model.title || dictionary.newMatch.untitled
    const timeLabel = (time: string) =>
        (copy.times as Record<string, string>)[time] ?? time
    const facts = isBrowser
        ? [
              isMatch && model.map
                  ? [
                        model.map.name,
                        model.map.time ? timeLabel(model.map.time) : null,
                    ]
                        .filter(Boolean)
                        .join(" · ")
                  : null,
              isMatch && model.cap
                  ? `${messages.embed.cap} ${model.cap}`
                  : null,
              valid(model.meetingStart)
                  ? copy.meetingAt.replace(
                        "{time}",
                        formatTime(model.meetingStart)
                    )
                  : null,
              valid(model.registrationEnd)
                  ? copy.registrationCloses.replace(
                        "{time}",
                        relativeTime(model.registrationEnd, intl)
                    )
                  : null,
          ].filter(Boolean)
        : []
    const footer = [
        model.forum ? `${icon("forum")}#${copy.forum}` : null,
        copy.managedShort,
    ]
        .filter(Boolean)
        .join(" · ")

    return (
        <aside aria-labelledby="new-match-preview" className="space-y-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="new-match-preview" className="text-sm font-semibold">
                    {text.title}
                </h2>
                <span className="text-muted-foreground text-xs">
                    {hint ?? text.hint}
                </span>
            </div>
            <div className="rounded-2xl bg-[#313338] p-4 text-sm leading-5 text-[#dbdee1]">
                <div className="flex gap-3">
                    <span
                        aria-hidden="true"
                        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#171717] font-semibold text-[#fafafa]"
                    >
                        L
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-[#f2f3f5]">
                                Logi
                            </span>
                            <span className="rounded-[3px] bg-[#5865f2] px-1 py-px text-[10px] font-semibold text-white">
                                APP
                            </span>
                            <span className="text-xs text-[#949ba4]">
                                {copy.today}
                            </span>
                        </div>
                        {model.mentions.length ? (
                            <Section
                                active={step === "discord"}
                                className="flex flex-wrap gap-1"
                            >
                                {model.mentions.map((mention) => (
                                    <span
                                        key={mention}
                                        className="rounded-[3px] bg-[#5865f2]/30 px-0.5 font-medium text-[#c9cdfb]"
                                    >
                                        @{mention}
                                    </span>
                                ))}
                            </Section>
                        ) : null}
                        <div
                            className="flex flex-col gap-3 rounded-md border-l-4 bg-[#2b2d31] px-3.5 pt-3 pb-3.5"
                            style={{
                                borderLeftColor: accentColor,
                            }}
                        >
                            <Section
                                active={step === "match"}
                                className="flex flex-col gap-2"
                            >
                                <span className="flex items-start justify-between gap-3">
                                    <span className="min-w-0 text-base leading-snug font-semibold break-words text-[#f2f3f5]">
                                        {title}
                                    </span>
                                    {model.thumbnailUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={model.thumbnailUrl}
                                            alt=""
                                            className="size-12 shrink-0 rounded-md object-cover"
                                        />
                                    ) : null}
                                </span>
                                {isMatch && model.teams.length ? (
                                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                                        {icon("side") ? (
                                            <span aria-hidden>
                                                {icon("side")}
                                            </span>
                                        ) : null}
                                        {model.teams.map((team, index) => (
                                            <span
                                                key={`${team.code}-${index}`}
                                                className="inline-flex items-center gap-1.5"
                                            >
                                                {index ? (
                                                    <span className="mr-1 text-[#949ba4]">
                                                        vs
                                                    </span>
                                                ) : null}
                                                {sideEmblem(team.side) ? (
                                                    <span aria-hidden>
                                                        {sideEmblem(team.side)}
                                                    </span>
                                                ) : null}
                                                <strong className="text-[#f2f3f5]">
                                                    {team.code}
                                                </strong>
                                                {team.side ? (
                                                    <span>
                                                        {sideLabel(team.side)}
                                                    </span>
                                                ) : null}
                                            </span>
                                        ))}
                                    </span>
                                ) : null}
                            </Section>
                            <Section
                                active={step === "time"}
                                className="flex flex-col gap-0.5"
                            >
                                <span className="font-semibold text-[#f2f3f5]">
                                    {isBrowser && valid(model.gameStart)
                                        ? `${icon("start")}${formatFull(model.gameStart)}`
                                        : "…"}
                                </span>
                                {facts.length ? (
                                    <span className="text-[13px] text-[#b5bac1]">
                                        {icon("details")}
                                        {facts.join(" · ")}
                                    </span>
                                ) : null}
                            </Section>
                            {model.notes ? (
                                <Section
                                    active={step === "match"}
                                    className="border-t border-[#3f4147] pt-2.5"
                                >
                                    <span className="line-clamp-4 text-[13px] break-words whitespace-pre-line text-[#dbdee1]">
                                        {model.notes}
                                    </span>
                                </Section>
                            ) : null}
                            <Section
                                active={step === "signups"}
                                className="flex flex-col gap-2.5"
                            >
                                <span className="text-[13px]">
                                    {icon("status")}
                                    {[
                                        <strong
                                            key="total"
                                            className="text-[#f2f3f5]"
                                        >
                                            {copy.signedUpTotal.replace(
                                                "{count}",
                                                String(
                                                    model.signups?.total ?? 0
                                                )
                                            )}
                                        </strong>,
                                        ...(isMatch
                                            ? model.groups.map((group) => {
                                                  const count =
                                                      model.signups?.byGroup[
                                                          group.name
                                                      ] ?? 0
                                                  return group.max
                                                      ? `${group.name} ${count}/${group.max}`
                                                      : `${group.name} ${count}`
                                              })
                                            : []),
                                    ].map((part, index) => (
                                        <span key={index}>
                                            {index ? " · " : null}
                                            {part}
                                        </span>
                                    ))}
                                </span>
                                <div className="flex flex-wrap gap-2">
                                    <span className="inline-flex h-8 items-center rounded bg-[#248046] px-3.5 text-[13px] font-medium text-white">
                                        {isMatch
                                            ? messages.embed.chooseSignup
                                            : messages.buttons.attend}
                                    </span>
                                    <span className="inline-flex h-8 items-center rounded bg-[#4e5058] px-3.5 text-[13px] font-medium text-white">
                                        {messages.buttons.checkSignup}
                                    </span>
                                    <span className="inline-flex h-8 items-center rounded bg-[#b3302f] px-3.5 text-[13px] font-medium text-white">
                                        {messages.buttons.decline}
                                    </span>
                                    <span className="inline-flex h-8 items-center rounded bg-[#4e5058] px-3.5 text-[13px] font-medium text-white">
                                        {messages.buttons.addToCalendar}
                                    </span>
                                </div>
                            </Section>
                            <Section
                                active={step === "discord"}
                                className="text-xs text-[#949ba4]"
                            >
                                {footer}
                            </Section>
                        </div>
                    </div>
                </div>
            </div>
            {note === null ? null : (
                <p className="text-muted-foreground text-xs leading-[18px]">
                    {note ?? text.note}
                </p>
            )}
        </aside>
    )
}
