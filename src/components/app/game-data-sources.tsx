"use client"

import {
    gameServerSourceListSchema,
    type ConnectionTestOutcome,
    type DataProvider,
    type GameServerSource,
    type GameServerSourceList,
} from "@/domain/game-data/credentials"
import {
    fill,
    keyField,
    PUBLIC_DIRECTORY_ORIGIN,
    readCommandResult,
    type CommandResult,
} from "@/lib/game-data/game-server-form"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    useCallback,
    useEffect,
    useId,
    useRef,
    useState,
    type RefObject,
} from "react"
import { SettingsSectionHeader } from "@/components/app/settings/settings-section-header"
import { SegmentedControl } from "@/components/app/settings/segmented-control"
import { ConfirmActionDialog } from "@/components/app/confirm-action-dialog"
import { Ellipsis, Plus, Server, TriangleAlert, X } from "lucide-react"
import { MobileActionBar } from "@/components/app/mobile-action-bar"
import { formatRelativeTime } from "@/lib/format/relative-time"
import { EmptyState } from "@/components/app/empty-state"
import { WarconScoreboard } from "./warcon-scoreboard"
import type { Dictionary } from "@/i18n/dictionaries"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { useLocale } from "next-intl"
import { cn } from "@/lib/utils"

/** What the collector last saw on a server, from the live connection. */
export type ServerLastGame = {
    map: string | null
    at: string | null
    /** The live connection, for the Warcon scoreboard. */
    connectionId: string
}

type Props = {
    serverId: string
    dictionary: Dictionary
    /** The last game seen on each server, by source reference. */
    lastGames?: Record<string, ServerLastGame>
    /** Called after a change that affects collection, so the connection list can reload. */
    onChanged?: () => void
    /**
     * `setup`: the last step of the setup guide (design B). No page header,
     * the add form stays closed until "Connect a server", and an empty list
     * is one dashed row with that button.
     */
    variant?: "page" | "setup"
}
type Copy = Dictionary["gameData"]["servers"]
type CollectionErrors = Dictionary["gameData"]["errors"]
type Notice = { kind: "error" | "status"; text: string }
type Post = (body: Record<string, unknown>) => Promise<CommandResult>

/** Server types in the order the add form offers them; each implies its game. */
const SERVER_TYPES = [
    "hll_crcon",
    "wardogs_warcon",
    "wardogs_rcon",
    "wardogs_public_directory",
] as const satisfies readonly DataProvider[]
const gameFor = (provider: DataProvider) =>
    provider === "hll_crcon" ? "hell_let_loose" : "wardogs"

const emptyDraft = {
    displayName: "",
    provider: "hll_crcon" as DataProvider,
    origin: "",
    providerServerId: "",
}

/** The message for a failed command, including a failed connection test. */
function failureText(t: Copy, result: CommandResult): string {
    const error = result.error ?? "unavailable"
    const text = fill(t.errors[error], {
        seconds: result.retryAfterSeconds ?? 60,
    })
    return result.test && result.test !== "ok"
        ? `${text} ${t.outcomes[result.test]}`
        : text
}

export function GameDataSources(props: Props) {
    return <Servers key={props.serverId} {...props} />
}

function Servers({
    serverId,
    dictionary,
    lastGames,
    onChanged,
    variant = "page",
}: Props) {
    const setup = variant === "setup"
    const t = dictionary.gameData.servers
    const section = dictionary.settingsHub.sections["game-servers"]
    const url = `/api/servers/${encodeURIComponent(serverId)}/game-data-sources`
    const [list, setList] = useState<GameServerSourceList | null>(null)
    const [loading, setLoading] = useState(true)
    const [pending, setPending] = useState(false)
    const [notice, setNotice] = useState<Notice | null>(null)
    const [formOpen, setFormOpen] = useState(false)
    const formRef = useRef<HTMLFormElement>(null)

    const load = useCallback(
        async (signal?: AbortSignal) => {
            const response = await fetch(url, { cache: "no-store", signal })
            if (!response.ok) throw new Error()
            const value = gameServerSourceListSchema.parse(
                await response.json()
            )
            if (!signal?.aborted) setList(value)
            return value
        },
        [url]
    )
    useEffect(() => {
        const controller = new AbortController()
        void load(controller.signal)
            .then((value) => {
                if (value && !controller.signal.aborted && !setup)
                    setFormOpen(value.sources.length === 0)
            })
            .catch(() => {
                if (!controller.signal.aborted)
                    setNotice({ kind: "error", text: t.errors.unavailable })
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false)
            })
        return () => controller.abort()
    }, [load, t, setup])

    const post: Post = async (body) => {
        setPending(true)
        setNotice(null)
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(body),
            })
            const result = readCommandResult(
                response.status,
                await response.json().catch(() => null)
            )
            if (body.action !== "test" && body.action !== "test_stored") {
                await load().catch(() => undefined)
                onChanged?.()
            }
            return result
        } catch {
            return readCommandResult(503, null)
        } finally {
            setPending(false)
        }
    }
    const report = (result: CommandResult, success: string) =>
        setNotice(
            result.ok
                ? { kind: "status", text: success }
                : { kind: "error", text: failureText(t, result) }
        )

    const busy = loading || pending
    const workspaceCount =
        list?.sources.filter((source) => source.managed === "workspace")
            .length ?? 0
    function openForm() {
        setFormOpen(true)
        requestAnimationFrame(() => {
            formRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "center",
            })
            formRef.current?.querySelector("input")?.focus()
        })
    }
    const setupCopy = dictionary.settingsHub.guidedSetup.steps.gameServers
    const connectButton = (
        <Button
            type="button"
            variant="outline"
            className="rounded-lg"
            aria-controls="game-server-add"
            disabled={!list}
            onClick={openForm}
        >
            <Plus className="size-4" aria-hidden="true" />
            {setupCopy.connect}
        </Button>
    )
    return (
        <section className={setup ? "space-y-4" : "space-y-5"} aria-busy={busy}>
            {setup ? null : (
                <SettingsSectionHeader
                    title={section.title}
                    description={section.description}
                    actions={
                        <MobileActionBar>
                            <Button
                                type="button"
                                className="rounded-lg"
                                aria-controls="game-server-add"
                                disabled={!list}
                                onClick={openForm}
                            >
                                <Plus className="size-4" aria-hidden="true" />
                                {t.add}
                            </Button>
                        </MobileActionBar>
                    }
                />
            )}
            {setup && !list && loading ? (
                <div className="bg-muted/60 h-[70px] animate-pulse rounded-xl" />
            ) : null}
            {setup && list?.sources.length === 0 && !formOpen ? (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed p-4">
                    <span className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-[10px]">
                        <Server className="size-[18px]" aria-hidden="true" />
                    </span>
                    <p className="text-foreground/80 min-w-0 flex-[1_1_200px] text-sm leading-5">
                        {setupCopy.empty}
                    </p>
                    {connectButton}
                </div>
            ) : null}
            {list?.encryption === "unavailable" && (
                <p
                    role="note"
                    className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
                >
                    {t.encryptionUnavailable}
                </p>
            )}
            {notice ? (
                <p
                    role={notice.kind === "error" ? "alert" : "status"}
                    className={
                        notice.kind === "error"
                            ? "text-destructive text-sm"
                            : "text-sm"
                    }
                >
                    {notice.text}
                </p>
            ) : null}
            {!setup && list?.sources.length === 0 && !formOpen && (
                <EmptyState
                    icon={Server}
                    title={t.emptyTitle}
                    description={t.emptyDescription}
                />
            )}
            {list?.sources.map((source) => (
                <ServerCard
                    key={`${source.ref}:${source.revision}`}
                    serverId={serverId}
                    source={source}
                    lastGame={lastGames?.[source.ref]}
                    dictionary={dictionary}
                    disabled={busy}
                    encryption={list.encryption}
                    errors={dictionary.gameData.errors}
                    post={post}
                    report={report}
                />
            ))}
            {setup && list?.sources.length && !formOpen ? (
                <div>{connectButton}</div>
            ) : null}
            {list && formOpen && (
                <AddServer
                    formRef={formRef}
                    onClose={() => setFormOpen(false)}
                    onSaved={() => setFormOpen(false)}
                    copy={t}
                    disabled={busy || workspaceCount >= list.limit}
                    limit={list.limit}
                    encryption={list.encryption}
                    post={post}
                    report={report}
                    // Inside the guide's card on a phone the form drops its own
                    // frame, so the server type options still fit.
                    className={
                        setup
                            ? "max-sm:rounded-none max-sm:border-0 max-sm:bg-transparent max-sm:p-0"
                            : undefined
                    }
                />
            )}
        </section>
    )
}

function AddServer({
    formRef,
    onClose,
    onSaved,
    copy: t,
    disabled,
    limit,
    encryption,
    post,
    report,
    className,
}: {
    formRef: RefObject<HTMLFormElement | null>
    onClose(): void
    onSaved(): void
    copy: Copy
    disabled: boolean
    limit: number
    encryption: GameServerSourceList["encryption"]
    post: Post
    report(result: CommandResult, success: string): void
    className?: string
}) {
    const id = useId()
    const field = (name: string) => `${id}-${name}`
    const [draft, setDraft] = useState(emptyDraft)
    // The key lives only in this field's state: kept after a test so it can be
    // saved, cleared after every save attempt, and never stored elsewhere.
    const [key, setKey] = useState("")
    // A test result counts only for the exact draft and key it tested.
    const [tested, setTested] = useState<{
        outcome: ConnectionTestOutcome
        input: string
    } | null>(null)
    const requirement = keyField(draft.provider)
    const body = () => ({
        draft: {
            ...draft,
            gameId: gameFor(draft.provider),
            origin:
                draft.provider === "wardogs_public_directory"
                    ? PUBLIC_DIRECTORY_ORIGIN
                    : draft.origin,
        },
        key: requirement === "hidden" || !key.trim() ? null : key,
    })
    const input = JSON.stringify(body())
    const outcome = tested && tested.input === input ? tested.outcome : null
    const canSaveKey = encryption === "active" || requirement === "hidden"
    const passed = outcome === "ok"
    return (
        <form
            id="game-server-add"
            ref={formRef}
            aria-labelledby={field("title")}
            className={cn(
                "bg-card border-foreground space-y-5 rounded-2xl border p-5 sm:p-6",
                className
            )}
            onSubmit={async (event) => {
                event.preventDefault()
                if (!passed) return
                const result = await post({
                    action: "create",
                    ...body(),
                    enable: true,
                })
                setKey("")
                setTested(null)
                if (result.ok) {
                    setDraft(emptyDraft)
                    report(
                        result,
                        result.enabled ? t.saved.created : t.saved.draft
                    )
                    onSaved()
                } else report(result, "")
            }}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                    <h2 id={field("title")} className="text-base font-semibold">
                        {t.add}
                    </h2>
                    <p className="text-muted-foreground text-xs">
                        {fill(t.limit, { limit })}
                    </p>
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-lg"
                    aria-label={t.closeForm}
                    onClick={onClose}
                >
                    <X className="size-4" />
                </Button>
            </div>
            <fieldset disabled={disabled} className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                    <div className="space-y-2">
                        <Label htmlFor={field("name")}>
                            {t.fields.displayName}
                        </Label>
                        <Input
                            id={field("name")}
                            value={draft.displayName}
                            maxLength={80}
                            required
                            placeholder={t.form.namePlaceholder}
                            onChange={(event) =>
                                setDraft({
                                    ...draft,
                                    displayName: event.target.value,
                                })
                            }
                        />
                    </div>
                    <div className="space-y-2">
                        <Label id={field("type")}>{t.form.type}</Label>
                        <SegmentedControl
                            labelledBy={field("type")}
                            value={draft.provider}
                            onChange={(provider) =>
                                setDraft({ ...draft, provider })
                            }
                            options={SERVER_TYPES.map((provider) => ({
                                value: provider,
                                label: t.form.types[provider],
                            }))}
                            className="lg:w-auto"
                        />
                    </div>
                    {draft.provider !== "wardogs_public_directory" ? (
                        <div className="space-y-2">
                            <Label htmlFor={field("origin")}>
                                {t.form.address}
                            </Label>
                            <Input
                                id={field("origin")}
                                type="url"
                                inputMode="url"
                                value={draft.origin}
                                maxLength={200}
                                required
                                placeholder="https://"
                                aria-describedby={field("origin-hint")}
                                onChange={(event) =>
                                    setDraft({
                                        ...draft,
                                        origin: event.target.value,
                                    })
                                }
                            />
                            <p id={field("origin-hint")} className="sr-only">
                                {t.hints.origin}
                            </p>
                        </div>
                    ) : null}
                </div>
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                    <div className="space-y-2">
                        <Label htmlFor={field("server")}>
                            {t.form.serverNumber[draft.provider]}
                        </Label>
                        <Input
                            id={field("server")}
                            value={draft.providerServerId}
                            maxLength={200}
                            required
                            placeholder={
                                draft.provider === "hll_crcon" ? "1" : undefined
                            }
                            aria-describedby={field("server-hint")}
                            onChange={(event) =>
                                setDraft({
                                    ...draft,
                                    providerServerId: event.target.value,
                                })
                            }
                        />
                        <p id={field("server-hint")} className="sr-only">
                            {t.hints.serverId[draft.provider]}
                        </p>
                    </div>
                </div>
                {requirement === "hidden" ? (
                    <p className="text-muted-foreground text-xs">
                        {t.hints.keyNone}
                    </p>
                ) : (
                    <div className="space-y-2">
                        <Label htmlFor={field("key")}>{t.fields.key}</Label>
                        <Input
                            id={field("key")}
                            type="password"
                            autoComplete="off"
                            data-1p-ignore=""
                            data-lpignore="true"
                            data-bwignore="true"
                            data-form-type="other"
                            spellCheck={false}
                            value={key}
                            maxLength={4200}
                            required={requirement === "required"}
                            placeholder={t.form.keyPlaceholder}
                            aria-describedby={field("key-hint")}
                            onChange={(event) => setKey(event.target.value)}
                        />
                        <p
                            id={field("key-hint")}
                            className="text-muted-foreground text-xs"
                        >
                            {t.form.help}
                            {requirement === "optional"
                                ? ` ${t.hints.keyOptional}`
                                : ""}
                        </p>
                    </div>
                )}
            </fieldset>
            {outcome ? (
                <p
                    role="status"
                    className={
                        passed
                            ? "text-sm text-emerald-700 dark:text-emerald-400"
                            : "text-destructive text-sm"
                    }
                >
                    {passed ? t.form.testPassed : t.outcomes[outcome]}
                </p>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <Button
                    type="button"
                    variant="outline"
                    className="rounded-lg"
                    disabled={disabled}
                    onClick={async () => {
                        const tested = input
                        const result = await post({ action: "test", ...body() })
                        if (result.test)
                            setTested({ outcome: result.test, input: tested })
                        if (!result.ok) report(result, "")
                    }}
                >
                    {t.actions.test}
                </Button>
                <div className="flex flex-wrap items-center gap-3">
                    {!passed ? (
                        <span className="text-muted-foreground text-xs">
                            {t.form.testFirst}
                        </span>
                    ) : null}
                    <Button
                        type="submit"
                        className="rounded-lg"
                        disabled={disabled || !canSaveKey || !passed}
                    >
                        {t.form.saveAndCollect}
                    </Button>
                </div>
            </div>
        </form>
    )
}

type Status = "collecting" | "stopped" | "off" | "none"

function statusOf(source: GameServerSource): Status {
    if (!source.collection) return "none"
    if (!source.collection.enabled) return "off"
    return source.collection.errorCategory || source.key.failure
        ? "stopped"
        : "collecting"
}

function StatusPill({ status, copy }: { status: Status; copy: Copy }) {
    return (
        <span
            className={cn(
                "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium",
                status === "collecting"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                    : status === "stopped"
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200"
                      : "bg-muted text-muted-foreground border-transparent"
            )}
        >
            {status === "collecting" ? (
                <span
                    aria-hidden="true"
                    className="size-2 rounded-full bg-emerald-500"
                />
            ) : status === "stopped" ? (
                <TriangleAlert className="size-3.5" aria-hidden="true" />
            ) : null}
            {copy.card.status[status]}
        </span>
    )
}

function ServerCard({
    serverId,
    source,
    lastGame,
    dictionary,
    disabled,
    encryption,
    errors,
    post,
    report,
}: {
    serverId: string
    source: GameServerSource
    lastGame?: ServerLastGame
    dictionary: Dictionary
    disabled: boolean
    encryption: GameServerSourceList["encryption"]
    errors: CollectionErrors
    post: Post
    report(result: CommandResult, success: string): void
}) {
    const t = dictionary.gameData.servers
    const locale = useLocale()
    const id = useId()
    const [mode, setMode] = useState<"view" | "key" | "rename">("view")
    const [live, setLive] = useState(false)
    const [key, setKey] = useState("")
    const [allowUnverified, setAllowUnverified] = useState(false)
    const [name, setName] = useState(source.displayName)
    const [confirm, setConfirm] = useState<"removeKey" | "remove" | null>(null)
    const [now] = useState(() => Date.now())
    const workspace = source.managed === "workspace"
    const requirement = keyField(source.provider)
    const enabled = source.collection?.enabled ?? false
    const status = statusOf(source)
    const stopped = status === "stopped"
    const canChangeKey = requirement !== "hidden" && encryption === "active"
    const base = { ref: source.ref, expectedRevision: source.revision }
    const ago = (iso: string) => formatRelativeTime(iso, now, locale)
    const shortDate = (iso: string) =>
        new Intl.DateTimeFormat(locale, {
            day: "numeric",
            month: "numeric",
        }).format(new Date(iso))
    const host = (() => {
        try {
            return new URL(source.origin).host
        } catch {
            return source.origin
        }
    })()
    const keyText = [
        t.card.key[source.key.state],
        source.key.state === "set" && !source.key.verified
            ? t.card.unverified
            : null,
        source.key.changedAt
            ? fill(t.card.changed, { date: shortDate(source.key.changedAt) })
            : null,
    ]
        .filter(Boolean)
        .join(" · ")
    const testText = source.lastTest
        ? `${source.lastTest.outcome === "ok" ? t.card.testOk : t.card.testFailed} · ${ago(source.lastTest.at)}`
        : t.notTested
    const gameText =
        lastGame?.map && lastGame.at
            ? `${lastGame.map} · ${ago(lastGame.at)}`
            : t.card.noGame
    const problem = source.key.failure
        ? t.failure[source.key.failure]
        : source.collection?.errorCategory === "unauthorized"
          ? t.card.fixUnauthorized[
                source.provider === "hll_crcon" ? "crcon" : "other"
            ]
          : source.collection?.errorCategory
            ? errors[source.collection.errorCategory]
            : null
    const testStored = async () => {
        const result = await post({ action: "test_stored", ref: source.ref })
        report(result, result.test ? t.outcomes[result.test] : "")
    }
    const toggleCollection = async () => {
        const result = await post({
            action: "set_enabled",
            ref: source.ref,
            enabled: !enabled,
        })
        report(result, enabled ? t.saved.disabled : t.saved.enabled)
    }
    const liveAvailable =
        enabled && source.provider === "wardogs_warcon" && lastGame
    return (
        <article
            className={cn(
                "bg-card space-y-4 rounded-2xl border p-5",
                stopped && "border-amber-400/70 dark:border-amber-500/50"
            )}
            aria-labelledby={`${id}-name`}
        >
            <div className="flex flex-wrap items-start gap-3">
                <span className="bg-muted/50 flex size-10 shrink-0 items-center justify-center rounded-xl border">
                    <Server className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                    <h3 id={`${id}-name`} className="font-semibold break-words">
                        {source.displayName}
                    </h3>
                    <p className="text-muted-foreground text-sm break-words">
                        {t.games[source.gameId]} ·{" "}
                        {t.form.types[source.provider]} · {host}
                        {source.provider === "hll_crcon"
                            ? ` · ${fill(t.card.serverNumber, { id: source.providerServerId })}`
                            : ""}
                    </p>
                </div>
                <StatusPill status={status} copy={t} />
            </div>
            {stopped && problem ? (
                <p className="rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
                    {problem}
                </p>
            ) : (
                <dl className="grid gap-3 border-b pb-4 text-sm sm:grid-cols-3">
                    <div className="min-w-0">
                        <dt className="text-muted-foreground text-xs">
                            {t.keyLabel}
                        </dt>
                        <dd>{keyText}</dd>
                    </div>
                    <div className="min-w-0">
                        <dt className="text-muted-foreground text-xs">
                            {t.lastTestLabel}
                        </dt>
                        <dd>{testText}</dd>
                    </div>
                    <div className="min-w-0">
                        <dt className="text-muted-foreground text-xs">
                            {t.card.lastGame}
                        </dt>
                        <dd className="break-words">{gameText}</dd>
                    </div>
                </dl>
            )}
            {problem && !stopped ? (
                <p className="text-destructive text-sm">{problem}</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
                {stopped ? (
                    canChangeKey ? (
                        <Button
                            size="sm"
                            className="rounded-lg"
                            disabled={disabled}
                            aria-expanded={mode === "key"}
                            onClick={() =>
                                setMode(mode === "key" ? "view" : "key")
                            }
                        >
                            {t.actions.changeKey}
                        </Button>
                    ) : null
                ) : (
                    <>
                        <Button
                            size="sm"
                            variant="outline"
                            className="rounded-lg"
                            disabled={disabled}
                            onClick={() => void testStored()}
                        >
                            {t.card.testKey}
                        </Button>
                        {canChangeKey ? (
                            <Button
                                size="sm"
                                variant="outline"
                                className="rounded-lg"
                                disabled={disabled}
                                aria-expanded={mode === "key"}
                                onClick={() =>
                                    setMode(mode === "key" ? "view" : "key")
                                }
                            >
                                {t.actions.changeKey}
                            </Button>
                        ) : null}
                        <Button
                            size="sm"
                            variant="outline"
                            className="rounded-lg"
                            disabled={disabled}
                            onClick={() => void toggleCollection()}
                        >
                            {enabled ? t.actions.disable : t.actions.enable}
                        </Button>
                    </>
                )}
                <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                        <Button
                            size="icon"
                            variant="outline"
                            className="size-8 rounded-lg"
                            disabled={disabled}
                            aria-label={fill(t.moreActions, {
                                name: source.displayName,
                            })}
                        >
                            <Ellipsis className="size-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                        {stopped ? (
                            <>
                                <DropdownMenuItem
                                    onSelect={() => void testStored()}
                                >
                                    {t.card.testKey}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onSelect={() => void toggleCollection()}
                                >
                                    {t.actions.disable}
                                </DropdownMenuItem>
                            </>
                        ) : null}
                        {liveAvailable ? (
                            <DropdownMenuItem onSelect={() => setLive(!live)}>
                                {live ? t.card.liveHide : t.card.live}
                            </DropdownMenuItem>
                        ) : null}
                        {workspace ? (
                            <DropdownMenuItem
                                onSelect={() => setMode("rename")}
                            >
                                {t.actions.rename}
                            </DropdownMenuItem>
                        ) : null}
                        {workspace && source.key.state === "set" ? (
                            <DropdownMenuItem
                                onSelect={() => setConfirm("removeKey")}
                            >
                                {t.actions.removeKey}
                            </DropdownMenuItem>
                        ) : null}
                        {workspace ? (
                            <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => setConfirm("remove")}
                            >
                                {t.actions.remove}
                            </DropdownMenuItem>
                        ) : null}
                    </DropdownMenuContent>
                </DropdownMenu>
                {!workspace ? (
                    <span className="text-muted-foreground ml-auto text-xs">
                        {t.managed.operator}
                    </span>
                ) : null}
            </div>
            <ConfirmActionDialog
                open={confirm === "removeKey"}
                onOpenChange={(open) => setConfirm(open ? "removeKey" : null)}
                title={fill(t.confirm.removeKeyTitle, {
                    name: source.displayName,
                })}
                description={t.confirm.removeKey}
                confirmLabel={t.actions.removeKey}
                cancelLabel={t.confirm.cancel}
                onConfirm={async () => {
                    const result = await post({ action: "remove_key", ...base })
                    report(result, t.saved.removedKey)
                }}
            />
            <ConfirmActionDialog
                open={confirm === "remove"}
                onOpenChange={(open) => setConfirm(open ? "remove" : null)}
                title={fill(t.confirm.removeTitle, {
                    name: source.displayName,
                })}
                description={t.confirm.remove}
                confirmLabel={t.actions.remove}
                cancelLabel={t.confirm.cancel}
                onConfirm={async () => {
                    const result = await post({ action: "remove", ...base })
                    report(result, t.saved.removed)
                }}
            />
            {mode === "key" && (
                <form
                    className="grid gap-2 border-t pt-4 md:grid-cols-[1fr_auto]"
                    onSubmit={async (event) => {
                        event.preventDefault()
                        const result = await post({
                            action: "set_key",
                            ...base,
                            key,
                            allowUnverified,
                        })
                        setKey("")
                        if (result.ok) setMode("view")
                        report(
                            result,
                            result.test === "ok"
                                ? t.saved.key
                                : t.saved.keyUnverified
                        )
                    }}
                >
                    <div className="space-y-1">
                        <Label htmlFor={`${id}-key`} className="text-xs">
                            {t.fields.newKey}
                        </Label>
                        <Input
                            id={`${id}-key`}
                            type="password"
                            autoComplete="off"
                            data-1p-ignore=""
                            data-lpignore="true"
                            data-bwignore="true"
                            data-form-type="other"
                            spellCheck={false}
                            value={key}
                            maxLength={4200}
                            required
                            disabled={disabled}
                            placeholder={t.form.keyPlaceholder}
                            aria-describedby={`${id}-key-hint`}
                            onChange={(event) => setKey(event.target.value)}
                        />
                        <p
                            id={`${id}-key-hint`}
                            className="text-muted-foreground text-xs"
                        >
                            {t.hints.key}
                        </p>
                    </div>
                    <div className="flex items-end gap-2">
                        <Button type="submit" size="sm" disabled={disabled}>
                            {t.actions.saveKey}
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={disabled}
                            onClick={() => {
                                setKey("")
                                setMode("view")
                            }}
                        >
                            {t.actions.cancel}
                        </Button>
                    </div>
                    <div className="flex items-center gap-2 md:col-span-2">
                        <Checkbox
                            id={`${id}-unverified`}
                            checked={allowUnverified}
                            disabled={disabled}
                            onCheckedChange={(value) =>
                                setAllowUnverified(value === true)
                            }
                        />
                        <Label
                            htmlFor={`${id}-unverified`}
                            className="text-xs font-normal"
                        >
                            {t.allowUnverified}
                        </Label>
                    </div>
                </form>
            )}
            {mode === "rename" && (
                <form
                    className="flex flex-wrap items-end gap-2 border-t pt-4"
                    onSubmit={async (event) => {
                        event.preventDefault()
                        const result = await post({
                            action: "rename",
                            ...base,
                            displayName: name,
                        })
                        if (result.ok) setMode("view")
                        report(result, t.saved.renamed)
                    }}
                >
                    <div className="space-y-1">
                        <Label htmlFor={`${id}-rename`} className="text-xs">
                            {t.fields.displayName}
                        </Label>
                        <Input
                            id={`${id}-rename`}
                            value={name}
                            maxLength={80}
                            required
                            disabled={disabled}
                            onChange={(event) => setName(event.target.value)}
                        />
                    </div>
                    <Button type="submit" size="sm" disabled={disabled}>
                        {t.actions.saveName}
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={disabled}
                        onClick={() => {
                            setName(source.displayName)
                            setMode("view")
                        }}
                    >
                        {t.actions.cancel}
                    </Button>
                </form>
            )}
            {live && liveAvailable ? (
                <div className="border-t pt-4">
                    <WarconScoreboard
                        serverId={serverId}
                        connectionId={lastGame.connectionId}
                        dictionary={dictionary}
                    />
                </div>
            ) : null}
        </article>
    )
}
