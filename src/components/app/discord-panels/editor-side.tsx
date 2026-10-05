"use client"

import {
    Activity,
    ArrowRight,
    Check,
    CircleDashed,
    ExternalLink,
    Lock,
    Play,
    RefreshCw,
    TriangleAlert,
} from "lucide-react"
import type { ReactNode } from "react"
import Link from "next/link"

import {
    DiscordMessagePreview,
    type DiscordPreviewMentions,
} from "@/components/app/discord-preview/discord-message-preview"
import type { MessageStyle } from "@/domain/discord-messages/message-style"
import type { MessageView } from "@/domain/discord-messages/message-view"
import type { GameServerSource } from "@/domain/game-data/credentials"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import type {
    PanelOverviewItem,
    PanelOverviewResponse,
    PanelTestResult,
} from "./panels-api"
import { dayTime, duration, shortDay, timeAgo, timeIn } from "./panel-time"
import { fill, panelErrorText } from "./panel-copy"
import { GameChip } from "./panel-chips"

function Card({
    title,
    actions,
    children,
    className,
}: {
    title: ReactNode
    actions?: ReactNode
    children: ReactNode
    className?: string
}) {
    return (
        <section
            className={cn(
                "bg-card space-y-3 rounded-2xl border p-4",
                className
            )}
        >
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                    {title}
                </h2>
                {actions}
            </div>
            {children}
        </section>
    )
}

// ---- Náhled -------------------------------------------------------------------------

/** "Náhled v #servery · skutečná data z Vlci #1" (P2-27, P2-43, P2-54/55). */
export function PreviewCard({
    title,
    views,
    placeholder,
    note,
    language,
    messageStyle,
    labels,
    now,
    timeZone,
    mentions,
    authorTime,
    edited,
}: {
    title: string
    views: MessageView[]
    placeholder: string | null
    note?: string | null
    language: string
    messageStyle: MessageStyle | null
    labels: Dictionary["discordPreview"]
    now: number
    timeZone: string
    mentions: DiscordPreviewMentions
    authorTime: string
    edited: boolean
}) {
    return (
        <section aria-label={title} className="space-y-2">
            <h2 className="text-[13px] font-semibold">{title}</h2>
            {views.length ? (
                <div className="space-y-1 rounded-2xl bg-[#313338] p-1.5">
                    {views.map((view, index) => (
                        <DiscordMessagePreview
                            key={index}
                            view={view}
                            language={language}
                            style={messageStyle}
                            labels={labels}
                            now={now}
                            timeZone={timeZone}
                            mentions={mentions}
                            author={{ time: authorTime, edited }}
                        />
                    ))}
                </div>
            ) : (
                <div className="flex min-h-32 items-center justify-center rounded-2xl bg-[#313338] px-6 py-8 text-center text-sm text-[#b5bac1]">
                    {placeholder}
                </div>
            )}
            {note ? (
                <p className="text-muted-foreground text-xs">{note}</p>
            ) : null}
        </section>
    )
}

// ---- Stránka Připojit se ------------------------------------------------------------

/** "Po kliknutí na Připojit se · stránka Logi" (P2-28): the join page as players see it. */
export function JoinPageMock({
    url,
    name,
    game,
    map,
    players,
    capacity,
    address,
    joinCode,
    dictionary,
}: {
    url: string
    name: string
    game: "hell_let_loose" | "wardogs"
    map: string | null
    players: number | null
    capacity: number | null
    address: string | null
    joinCode: string | null
    dictionary: Dictionary
}) {
    const text = dictionary.discordPanelsPage.editor.joinPage
    const gameName = dictionary.discordPanelsPage.gameNames[game]
    return (
        <section className="space-y-2" aria-label={text.title}>
            <h2 className="text-[13px] font-semibold">{text.title}</h2>
            <div className="bg-card overflow-hidden rounded-2xl border">
                <div className="bg-muted/60 text-muted-foreground flex items-center gap-1.5 border-b px-3 py-1.5 font-mono text-xs">
                    <Lock className="size-3" aria-hidden="true" />
                    {url.replace(/^https?:\/\//, "")}
                </div>
                <div className="space-y-2 px-4 py-3">
                    <p className="text-base font-semibold">{name}</p>
                    <p className="text-muted-foreground text-[13px]">
                        {map && players !== null && capacity !== null
                            ? fill(text.players, {
                                  game: gameName,
                                  map,
                                  players,
                                  capacity,
                              })
                            : gameName}
                    </p>
                    {game === "hell_let_loose" ? (
                        <>
                            <span className="bg-foreground text-background inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium">
                                <Play className="size-3.5" aria-hidden="true" />
                                {text.open}
                            </span>
                            <p className="text-muted-foreground text-xs">
                                {address
                                    ? fill(text.fallback, { address })
                                    : text.noAddress}
                            </p>
                        </>
                    ) : (
                        <p className="text-muted-foreground text-xs">
                            {joinCode
                                ? fill(text.joinCode, { code: joinCode })
                                : text.noAddress}
                        </p>
                    )}
                </div>
            </div>
            <p className="text-muted-foreground text-xs">{text.caption}</p>
        </section>
    )
}

// ---- Data ze serveru ----------------------------------------------------------------

export type ServerTestState =
    | { status: "loading" }
    | { status: "failed" }
    | { status: "done"; result: PanelTestResult }

export function ServerDataCard({
    servers,
    multiple,
    loading,
    onLoad,
    seeds,
    now,
    locale,
    dictionary,
}: {
    servers: Array<{
        connectionId: string
        name: string
        provider: string | null
        state: ServerTestState | null
    }>
    multiple: boolean
    loading: boolean
    onLoad: () => void
    seeds: Record<string, { liveFrom: number } | null>
    now: number
    locale: string
    dictionary: Dictionary
}) {
    const text = dictionary.discordPanelsPage.editor.data
    const loadedAt = Math.max(
        0,
        ...servers.map((server) =>
            server.state?.status === "done" ? server.state.result.readAt : 0
        )
    )
    return (
        <Card
            title={text.title}
            actions={
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    disabled={loading || !servers.length}
                    onClick={onLoad}
                >
                    <RefreshCw
                        className={cn("size-3.5", loading && "animate-spin")}
                        aria-hidden="true"
                    />
                    {loading ? text.loading : text.load}
                </Button>
            }
        >
            <p className="text-muted-foreground text-xs">
                {text.help}
                {loadedAt
                    ? ` ${fill(text.loadedAgo, { ago: timeAgo(loadedAt, now, locale) })}`
                    : ""}
            </p>
            <div className="space-y-2" aria-live="polite">
                {servers.map((server) => (
                    <ServerDataResult
                        key={server.connectionId}
                        server={server}
                        multiple={multiple}
                        seed={seeds[server.connectionId] ?? null}
                        now={now}
                        locale={locale}
                        dictionary={dictionary}
                    />
                ))}
            </div>
        </Card>
    )
}

function ServerDataResult({
    server,
    multiple,
    seed,
    now,
    locale,
    dictionary,
}: {
    server: {
        connectionId: string
        name: string
        provider: string | null
        state: ServerTestState | null
    }
    multiple: boolean
    seed: { liveFrom: number } | null
    now: number
    locale: string
    dictionary: Dictionary
}) {
    const text = dictionary.discordPanelsPage.editor.data
    const state = server.state
    if (!state || state.status === "loading") return null
    if (state.status === "failed")
        return <ResultBox tone="danger" title={text.requestFailed} />
    const result = state.result
    const summary = result.summary
    const ago = timeAgo(result.readAt, now, locale)
    const headline = summary.map
        ? fill(multiple ? text.perServer : text.result, {
              server: server.name,
              ago,
              map: summary.map,
              players: summary.players ?? "—",
              capacity: summary.capacity ?? "—",
          })
        : multiple
          ? server.name
          : fill(text.loadedAgo, { ago })
    const details = [
        seed && summary.players !== null && summary.players < seed.liveFrom
            ? fill(text.seed, {
                  players: summary.players,
                  liveFrom: seed.liveFrom,
              })
            : null,
        summary.score ? fill(text.score, { score: summary.score }) : null,
        summary.timeLeftMinutes !== null && !multiple
            ? fill(text.timeLeft, { minutes: summary.timeLeftMinutes })
            : null,
        summary.queue ? fill(text.queue, { count: summary.queue }) : null,
        summary.playersInStats !== null && !multiple
            ? fill(text.inStats, { count: summary.playersInStats })
            : null,
        summary.nextMap && !multiple
            ? fill(text.nextMap, { map: summary.nextMap })
            : null,
    ].filter(Boolean)
    const provider =
        server.provider === "hll_crcon" || server.provider === "wardogs_warcon"
            ? server.provider
            : null
    if (
        result.status === "failed" &&
        result.errorCategory === "rate_limited" &&
        provider
    )
        return (
            <ResultBox
                tone="danger"
                title={fill(text.rateLimited, {
                    server: server.name,
                    provider:
                        dictionary.discordPanelsPage.sources.providers[
                            provider
                        ],
                })}
                body={fill(text.rateLimitedBody, {
                    ago: result.dataAt
                        ? timeAgo(result.dataAt, now, locale)
                        : "—",
                    seconds: Math.max(
                        1,
                        Math.ceil((result.retryAfterMs ?? 60_000) / 1000)
                    ),
                    providerIn: text.providerIn[provider],
                    server: server.name,
                })}
            />
        )
    const problem =
        result.status === "busy"
            ? fill(text.busy, {
                  seconds: Math.max(
                      1,
                      Math.ceil((result.retryAfterMs ?? 0) / 1000)
                  ),
              })
            : result.status === "denied"
              ? text.denied
              : result.status === "failed"
                ? text.failed
                : result.status === "unavailable"
                  ? text.unavailable
                  : result.status === "stale"
                    ? text.stale
                    : result.status === "snapshot"
                      ? text.snapshot
                      : !result.collecting
                        ? text.notCollecting
                        : null
    const tone =
        result.status === "ok"
            ? "success"
            : result.status === "snapshot" || result.status === "stale"
              ? "warning"
              : "danger"
    return (
        <ResultBox
            tone={tone}
            title={
                multiple && problem && !summary.map
                    ? `${server.name} · ${problem}`
                    : headline
            }
            body={[
                details.join(" · "),
                summary.map || !multiple ? problem : null,
            ]
                .filter(Boolean)
                .join(" ")}
        />
    )
}

function ResultBox({
    tone,
    title,
    body,
}: {
    tone: "success" | "warning" | "danger"
    title: string
    body?: string
}) {
    const Icon = tone === "success" ? Check : TriangleAlert
    return (
        <div
            className={cn(
                "flex items-start gap-2 rounded-lg px-3 py-2 text-xs",
                tone === "success" &&
                    "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
                tone === "warning" &&
                    "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
                tone === "danger" &&
                    "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200"
            )}
        >
            <Icon className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            <div>
                <p className="font-semibold">{title}</p>
                {body ? <p>{body}</p> : null}
            </div>
        </div>
    )
}

// ---- Zdroj --------------------------------------------------------------------------

/** "Zdroj · Vlci #1 · Public" (P2-30): collection, live read, key and address. */
export function SourceCard({
    source,
    detail,
    live,
    lastReadAt,
    gameServersHref,
    now,
    locale,
    dictionary,
}: {
    source: PanelOverviewResponse["sources"][number]
    detail: GameServerSource | null
    live: "ok" | "limited" | null
    lastReadAt: number | null
    gameServersHref: string
    now: number
    locale: string
    dictionary: Dictionary
}) {
    const page = dictionary.discordPanelsPage
    const text = page.editor.source
    const rows: Array<[string, ReactNode, boolean]> = [
        [
            text.collection,
            source.collecting
                ? source.lastDataAt
                    ? fill(page.sources.collecting, {
                          ago: timeAgo(source.lastDataAt, now, locale),
                      })
                    : page.sources.collectingNoData
                : page.sources.notCollecting,
            source.collecting && source.freshness === "fresh",
        ],
        [
            text.live,
            live === "limited"
                ? text.liveLimited
                : lastReadAt
                  ? fill(text.liveOk, { ago: timeAgo(lastReadAt, now, locale) })
                  : text.liveNone,
            live !== "limited" && Boolean(lastReadAt),
        ],
    ]
    if (detail) {
        const key = detail.key
        const keyText =
            key.state === "set"
                ? [
                      text.keySet,
                      key.verified && detail.lastTest
                          ? fill(text.keyVerified, {
                                date: shortDay(
                                    Date.parse(detail.lastTest.at),
                                    locale
                                ),
                            })
                          : key.verified
                            ? null
                            : text.keyNotVerified,
                  ]
                      .filter(Boolean)
                      .join(" · ")
                : key.state === "missing" || key.state === "needs_operator"
                  ? text.keyMissing
                  : key.state === "environment"
                    ? text.keyEnvironment
                    : text.keyNotRequired
        rows.push([text.key, keyText, key.state === "set" && key.verified])
        rows.push([
            text.address,
            fill(text.addressValue, {
                origin: detail.origin,
                id: detail.providerServerId,
            }),
            true,
        ])
    }
    return (
        <Card
            title={
                <>
                    <Activity className="size-4" aria-hidden="true" />
                    {fill(text.title, {
                        server: source.name ?? page.list.titles.unknownServer,
                    })}
                    {source.gameId === "hell_let_loose" ||
                    source.gameId === "wardogs" ? (
                        <GameChip
                            game={source.gameId}
                            label={page.games[source.gameId]}
                        />
                    ) : null}
                </>
            }
            actions={
                <Link
                    href={gameServersHref}
                    className="inline-flex items-center gap-1 text-[13px] underline underline-offset-3"
                >
                    {text.link}
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
            }
        >
            <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[13px]">
                {rows.map(([label, value, ok]) => (
                    <div key={label} className="contents">
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd
                            className={cn(
                                "min-w-0 break-words",
                                ok && label !== text.address
                                    ? "text-emerald-700 dark:text-emerald-400"
                                    : undefined
                            )}
                        >
                            {value}
                        </dd>
                    </div>
                ))}
            </dl>
        </Card>
    )
}

// ---- Doručení -----------------------------------------------------------------------

/**
 * "Doručení" (P2-31..33, P2-48, P2-B11): saved → bot claimed → sent → last
 * refresh with the next one, the last error with its recovery, and the box
 * for a delivery Discord did not confirm.
 */
export function DeliveryCard({
    item,
    channel,
    messageUrl,
    people,
    onRetry,
    busy,
    now,
    locale,
    dictionary,
}: {
    item: PanelOverviewItem | null
    channel: string
    messageUrl: string | null
    people: Record<string, string>
    onRetry: () => void
    busy: boolean
    now: number
    locale: string
    dictionary: Dictionary
}) {
    const page = dictionary.discordPanelsPage
    const text = page.editor.delivery
    const time = page.time
    const t = item?.timeline
    const when = (at: number, seconds = false) =>
        dayTime(at, now, locale, time, seconds)
    const steps: Array<{ label: string; value: ReactNode; done: boolean }> = [
        {
            label: text.saved,
            value:
                item && t?.savedAt
                    ? t.savedBy && people[t.savedBy]
                        ? fill(text.savedBy, {
                              when: when(t.savedAt),
                              name: people[t.savedBy]!,
                          })
                        : when(t.savedAt)
                    : text.notYet,
            done: Boolean(item && t?.savedAt),
        },
        {
            label: text.claimed,
            value: t?.claimedAt ? when(t.claimedAt, true) : text.none,
            done: Boolean(t?.claimedAt),
        },
        {
            label: text.sent,
            value: t?.sentAt ? (
                <>
                    {when(t.sentAt, true)}
                    {messageUrl ? (
                        <>
                            {" · "}
                            <a
                                href={messageUrl}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="text-foreground underline underline-offset-3"
                            >
                                {fill(text.sentIn, { channel })}
                            </a>
                        </>
                    ) : null}
                </>
            ) : (
                text.none
            ),
            done: Boolean(t?.sentAt),
        },
        {
            label: text.lastRefresh,
            value: t?.lastUpdateAt
                ? t.nextUpdateAt
                    ? fill(text.refreshValue, {
                          ago: timeAgo(t.lastUpdateAt, now, locale),
                          in: timeIn(t.nextUpdateAt, now, locale, time),
                      })
                    : timeAgo(t.lastUpdateAt, now, locale)
                : text.none,
            done: Boolean(t?.lastUpdateAt),
        },
    ]
    const lastError = item?.lastError ?? null
    const lastErrorText = lastError
        ? panelErrorText(lastError, { channel, dictionary })
        : null
    const recoveredAt =
        lastError && item?.recoveredAt && item.recoveredAt > lastError.at
            ? item.recoveredAt
            : null
    return (
        <Card title={text.title}>
            <ol className="space-y-0">
                {steps.map((step, index) => (
                    <li
                        key={step.label}
                        className="relative flex gap-3 pb-3 last:pb-0"
                    >
                        {index < steps.length - 1 ? (
                            <span
                                aria-hidden="true"
                                className="bg-border absolute top-6 left-[11px] h-[calc(100%-1.25rem)] w-px"
                            />
                        ) : null}
                        {step.done ? (
                            <span className="relative flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                <Check
                                    className="size-3.5"
                                    aria-hidden="true"
                                />
                            </span>
                        ) : (
                            <CircleDashed
                                className="text-muted-foreground relative size-6 shrink-0"
                                aria-hidden="true"
                            />
                        )}
                        <div className="min-w-0 text-[13px]">
                            <p
                                className={cn(
                                    "font-semibold",
                                    !step.done && "text-muted-foreground"
                                )}
                            >
                                {step.label}
                            </p>
                            <p className="text-muted-foreground text-xs">
                                {step.value}
                            </p>
                        </div>
                    </li>
                ))}
            </ol>
            {!item || item.state === "unsent" ? (
                <p className="text-muted-foreground text-xs">{text.hint}</p>
            ) : null}
            {lastError && lastErrorText ? (
                <p className="text-[13px]">
                    <span className="font-semibold">{text.lastError}</span>{" "}
                    {when(lastError.at)} · {lastErrorText.title}{" "}
                    {recoveredAt
                        ? fill(text.recovered, {
                              after: duration(
                                  recoveredAt - lastError.at,
                                  locale
                              ),
                          })
                        : lastErrorText.fix}
                </p>
            ) : null}
            {item?.uncertain ? (
                <div className="space-y-2 rounded-xl border border-dashed border-amber-300 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                    <p className="text-xs font-semibold tracking-wide uppercase">
                        {text.stuck.title}
                    </p>
                    <p>
                        <span className="font-semibold">{text.stuck.lead}</span>{" "}
                        {fill(text.stuck.body, { channel })}
                    </p>
                    <Button
                        type="button"
                        size="sm"
                        className="rounded-lg"
                        disabled={busy}
                        onClick={onRetry}
                    >
                        <RefreshCw className="size-3.5" aria-hidden="true" />
                        {page.list.buttons.retry}
                    </Button>
                </div>
            ) : null}
        </Card>
    )
}

/** "Otevřít zprávu v Discordu ↗". */
export function OpenInDiscord({
    href,
    label,
}: {
    href: string
    label: string
}) {
    return (
        <a
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className="text-foreground inline-flex items-center gap-1 underline underline-offset-3"
        >
            {label}
            <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>
    )
}
