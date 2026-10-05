"use client"

import { useSyncExternalStore, type ReactNode } from "react"

import type { NewMatchStep } from "@/domain/events/new-match-flow"
import { getClanDiscordMessages } from "@/lib/clan-language"
import type { Dictionary } from "@/i18n/dictionaries"
import { cn } from "@/lib/utils"

export type NewMatchPreviewModel = {
    kind: "match" | "training"
    /** The clan's bot language; the message is written in it. */
    language: string
    title: string
    teams: Array<{ code: string; side: string | null; own: boolean }>
    mapLine: string | null
    meetingStart: string | null
    gameStart: string | null
    registrationEnd: string | null
    groups: Array<{ name: string; max?: number }>
    mention: string | null
    forum: boolean
    accentColor?: string
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

function capitalize(value: string) {
    return value.charAt(0).toLocaleUpperCase() + value.slice(1)
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
 * The registration announcement as players will see it in Discord (design
 * D2): title, teams and map, the start and deadlines, sign-up groups with
 * their caps and the buttons, then who is pinged and where it lives. The part
 * the current step changes is outlined.
 */
export function NewMatchPreview({
    model,
    step,
    dictionary,
    copy,
}: {
    model: NewMatchPreviewModel
    step: NewMatchStep
    dictionary: Dictionary
    /** The preview copy in the clan's bot language. */
    copy: Dictionary["newMatch"]["preview"]
}) {
    const isBrowser = useIsBrowser()
    const text = dictionary.newMatch.preview
    const messages = getClanDiscordMessages(model.language)
    const intl = messages.locale
    const formatDay = (iso: string) =>
        capitalize(
            new Intl.DateTimeFormat(intl, {
                weekday: "long",
                day: "numeric",
                month: "numeric",
            }).format(new Date(iso))
        )
    const formatTime = (iso: string) =>
        new Intl.DateTimeFormat(intl, {
            hour: "2-digit",
            minute: "2-digit",
        }).format(new Date(iso))
    const formatShort = (iso: string) =>
        new Intl.DateTimeFormat(intl, {
            weekday: "short",
            day: "numeric",
            month: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        }).format(new Date(iso))
    const valid = (iso: string | null): iso is string =>
        Boolean(iso && Number.isFinite(Date.parse(iso)))
    const start = model.kind === "match" ? model.gameStart : model.meetingStart
    const hasGroups = model.kind === "match" && model.groups.length > 0
    const footer = [
        model.mention ? `@${model.mention}` : copy.noPing,
        model.forum ? copy.forumThread : null,
        copy.managedInLogi,
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
                    {text.hint}
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
                        <div
                            className="flex flex-col gap-3 rounded-md border-l-4 bg-[#2b2d31] px-3.5 pt-3 pb-3.5"
                            style={{
                                borderLeftColor: model.accentColor ?? "#e8a33d",
                            }}
                        >
                            <Section
                                active={step === "match"}
                                className="flex flex-col gap-2.5"
                            >
                                <span className="text-base leading-snug font-semibold break-words text-[#f2f3f5]">
                                    {model.title ||
                                        dictionary.newMatch.untitled}
                                </span>
                                {model.kind === "match" &&
                                model.teams.length ? (
                                    <div className="flex flex-wrap items-center gap-2.5">
                                        {model.teams.map((team, index) => (
                                            <span
                                                key={`${team.code}-${index}`}
                                                className="inline-flex items-center gap-1.5"
                                            >
                                                {index ? (
                                                    <span className="mr-1 text-xs text-[#949ba4]">
                                                        vs
                                                    </span>
                                                ) : null}
                                                <span
                                                    className={cn(
                                                        "flex h-6 min-w-6 items-center justify-center rounded-md px-1 text-[9px] font-bold",
                                                        team.own
                                                            ? "bg-[#f2f3f5] text-[#171717]"
                                                            : "bg-[#4e5058] text-[#f2f3f5]"
                                                    )}
                                                >
                                                    {team.code}
                                                </span>
                                                {team.side ? (
                                                    <span className="text-[13px]">
                                                        {team.side}
                                                    </span>
                                                ) : null}
                                            </span>
                                        ))}
                                    </div>
                                ) : null}
                                {model.kind === "match" && model.mapLine ? (
                                    <span className="text-[13px] text-[#b5bac1]">
                                        {model.mapLine}
                                    </span>
                                ) : null}
                            </Section>
                            <Section
                                active={step === "time"}
                                className="flex flex-col gap-0.5"
                            >
                                <span className="font-semibold text-[#f2f3f5]">
                                    {isBrowser && valid(start)
                                        ? `${formatDay(start)} · ${copy.start.replace("{time}", formatTime(start))}`
                                        : "…"}
                                </span>
                                <span className="text-[13px] text-[#b5bac1]">
                                    {isBrowser
                                        ? [
                                              model.kind === "match" &&
                                              valid(model.meetingStart)
                                                  ? copy.meeting.replace(
                                                        "{time}",
                                                        formatTime(
                                                            model.meetingStart
                                                        )
                                                    )
                                                  : null,
                                              valid(model.registrationEnd)
                                                  ? copy.signupsUntil.replace(
                                                        "{date}",
                                                        formatShort(
                                                            model.registrationEnd
                                                        )
                                                    )
                                                  : null,
                                          ]
                                              .filter(Boolean)
                                              .join(" · ")
                                        : "…"}
                                </span>
                            </Section>
                            <Section
                                active={step === "signups"}
                                className="flex flex-col gap-2.5"
                            >
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs font-semibold tracking-wide text-[#b5bac1] uppercase">
                                        {copy.signedUp.replace("{count}", "0")}
                                    </span>
                                    {hasGroups ? (
                                        <span className="text-[13px]">
                                            {model.groups
                                                .map((group) =>
                                                    group.max
                                                        ? `${group.name} 0/${group.max}`
                                                        : `${group.name} 0`
                                                )
                                                .join(" · ")}
                                        </span>
                                    ) : null}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <span className="inline-flex h-8 items-center rounded bg-[#248046] px-3.5 text-[13px] font-medium text-white">
                                        {model.kind === "match"
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
            <p className="text-muted-foreground text-xs leading-[18px]">
                {text.note}
            </p>
        </aside>
    )
}
