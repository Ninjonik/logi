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
    PROVIDERS_BY_GAME,
    PUBLIC_DIRECTORY_ORIGIN,
    readCommandResult,
    type CommandResult,
    type GameId,
} from "@/lib/game-data/game-server-form"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useCallback, useEffect, useId, useState } from "react"
import type { Dictionary } from "@/i18n/dictionaries"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

type Props = {
    serverId: string
    dictionary: Dictionary
    /** Called after a change that affects collection, so the connection list can reload. */
    onChanged?: () => void
}
type Copy = Dictionary["gameData"]["servers"]
type CollectionErrors = Dictionary["gameData"]["errors"]
type Notice = { kind: "error" | "status"; text: string }
type Post = (body: Record<string, unknown>) => Promise<CommandResult>

const emptyDraft = {
    displayName: "",
    gameId: "wardogs" as GameId,
    provider: "wardogs_warcon" as DataProvider,
    origin: "",
    providerServerId: "",
}
const GAMES: readonly GameId[] = ["wardogs", "hell_let_loose"]
const date = (value: string) => new Date(value).toLocaleString()

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

function Servers({ serverId, dictionary, onChanged }: Props) {
    const t = dictionary.gameData.servers
    const url = `/api/servers/${encodeURIComponent(serverId)}/game-data-sources`
    const [list, setList] = useState<GameServerSourceList | null>(null)
    const [loading, setLoading] = useState(true)
    const [pending, setPending] = useState(false)
    const [notice, setNotice] = useState<Notice | null>(null)

    const load = useCallback(
        async (signal?: AbortSignal) => {
            const response = await fetch(url, { cache: "no-store", signal })
            if (!response.ok) throw new Error()
            const value = gameServerSourceListSchema.parse(
                await response.json()
            )
            if (!signal?.aborted) setList(value)
        },
        [url]
    )
    useEffect(() => {
        const controller = new AbortController()
        void load(controller.signal)
            .catch(() => {
                if (!controller.signal.aborted)
                    setNotice({ kind: "error", text: t.errors.unavailable })
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false)
            })
        return () => controller.abort()
    }, [load, t])

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
    return (
        <section className="space-y-4 rounded-lg border p-4" aria-busy={busy}>
            <div className="space-y-1">
                <h3 className="font-medium">{t.title}</h3>
                <p className="text-muted-foreground text-sm">{t.description}</p>
            </div>
            {list?.encryption === "unavailable" && (
                <p
                    role="note"
                    className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
                >
                    {t.encryptionUnavailable}
                </p>
            )}
            <p
                role={notice?.kind === "error" ? "alert" : "status"}
                className={
                    notice?.kind === "error"
                        ? "text-destructive text-sm"
                        : "text-sm"
                }
            >
                {notice?.text}
            </p>
            {list?.sources.length === 0 && (
                <p className="text-muted-foreground text-sm">{t.none}</p>
            )}
            {list?.sources.map((source) => (
                <ServerRow
                    key={`${source.ref}:${source.revision}`}
                    source={source}
                    copy={t}
                    disabled={busy}
                    encryption={list.encryption}
                    errors={dictionary.gameData.errors}
                    post={post}
                    report={report}
                />
            ))}
            {list && (
                <AddServer
                    copy={t}
                    disabled={busy || workspaceCount >= list.limit}
                    limit={list.limit}
                    encryption={list.encryption}
                    post={post}
                    report={report}
                />
            )}
        </section>
    )
}

function AddServer({
    copy: t,
    disabled,
    limit,
    encryption,
    post,
    report,
}: {
    copy: Copy
    disabled: boolean
    limit: number
    encryption: GameServerSourceList["encryption"]
    post: Post
    report(result: CommandResult, success: string): void
}) {
    const id = useId()
    const field = (name: string) => `${id}-${name}`
    const [draft, setDraft] = useState(emptyDraft)
    // The key lives only in this field's state and is cleared after every request.
    const [key, setKey] = useState("")
    const [enable, setEnable] = useState(true)
    const [tested, setTested] = useState<ConnectionTestOutcome | null>(null)
    const requirement = keyField(draft.provider)
    const body = () => ({
        draft: {
            ...draft,
            origin:
                draft.provider === "wardogs_public_directory"
                    ? PUBLIC_DIRECTORY_ORIGIN
                    : draft.origin,
        },
        key: requirement === "hidden" || !key.trim() ? null : key,
    })
    const canSaveKey = encryption === "active" || requirement === "hidden"
    return (
        <form
            className="space-y-3 border-t pt-4"
            onSubmit={async (event) => {
                event.preventDefault()
                const result = await post({
                    action: "create",
                    ...body(),
                    enable,
                })
                setKey("")
                setTested(result.test)
                if (result.ok) {
                    setDraft(emptyDraft)
                    report(
                        result,
                        result.enabled ? t.saved.created : t.saved.draft
                    )
                } else report(result, "")
            }}
        >
            <h4 className="text-sm font-medium">{t.add}</h4>
            <p className="text-muted-foreground text-xs">
                {fill(t.limit, { limit })}
            </p>
            <fieldset disabled={disabled} className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                    <Label htmlFor={field("name")}>
                        {t.fields.displayName}
                    </Label>
                    <Input
                        id={field("name")}
                        value={draft.displayName}
                        maxLength={80}
                        required
                        onChange={(event) =>
                            setDraft({
                                ...draft,
                                displayName: event.target.value,
                            })
                        }
                    />
                </div>
                <div className="space-y-1">
                    <Label htmlFor={field("game")}>{t.fields.game}</Label>
                    <Select
                        value={draft.gameId}
                        onValueChange={(value) => {
                            const gameId = GAMES.find((game) => game === value)
                            if (!gameId) return
                            setDraft({
                                ...draft,
                                gameId,
                                provider: PROVIDERS_BY_GAME[gameId][0]!,
                            })
                            setTested(null)
                        }}
                    >
                        <SelectTrigger id={field("game")} className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {GAMES.map((game) => (
                                <SelectItem key={game} value={game}>
                                    {t.games[game]}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1">
                    <Label htmlFor={field("provider")}>
                        {t.fields.provider}
                    </Label>
                    <Select
                        value={draft.provider}
                        onValueChange={(value) => {
                            const provider = PROVIDERS_BY_GAME[
                                draft.gameId
                            ].find((entry) => entry === value)
                            if (!provider) return
                            setDraft({ ...draft, provider })
                            setTested(null)
                        }}
                    >
                        <SelectTrigger
                            id={field("provider")}
                            className="w-full"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {PROVIDERS_BY_GAME[draft.gameId].map((provider) => (
                                <SelectItem key={provider} value={provider}>
                                    {t.providers[provider]}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                {draft.provider !== "wardogs_public_directory" && (
                    <div className="space-y-1">
                        <Label htmlFor={field("origin")}>
                            {t.fields.origin}
                        </Label>
                        <Input
                            id={field("origin")}
                            type="url"
                            inputMode="url"
                            value={draft.origin}
                            maxLength={200}
                            required
                            placeholder="https://panel.example.com"
                            aria-describedby={field("origin-hint")}
                            onChange={(event) =>
                                setDraft({
                                    ...draft,
                                    origin: event.target.value,
                                })
                            }
                        />
                        <p
                            id={field("origin-hint")}
                            className="text-muted-foreground text-xs"
                        >
                            {t.hints.origin}
                        </p>
                    </div>
                )}
                <div className="space-y-1">
                    <Label htmlFor={field("server")}>{t.fields.serverId}</Label>
                    <Input
                        id={field("server")}
                        value={draft.providerServerId}
                        maxLength={200}
                        required
                        aria-describedby={field("server-hint")}
                        onChange={(event) =>
                            setDraft({
                                ...draft,
                                providerServerId: event.target.value,
                            })
                        }
                    />
                    <p
                        id={field("server-hint")}
                        className="text-muted-foreground text-xs"
                    >
                        {t.hints.serverId[draft.provider]}
                    </p>
                </div>
                {requirement === "hidden" ? (
                    <p className="text-muted-foreground self-end text-xs">
                        {t.hints.keyNone}
                    </p>
                ) : (
                    <div className="space-y-1">
                        <Label htmlFor={field("key")}>{t.fields.key}</Label>
                        <Input
                            id={field("key")}
                            type="password"
                            autoComplete="new-password"
                            spellCheck={false}
                            value={key}
                            maxLength={4200}
                            required={requirement === "required"}
                            aria-describedby={field("key-hint")}
                            onChange={(event) => setKey(event.target.value)}
                        />
                        <p
                            id={field("key-hint")}
                            className="text-muted-foreground text-xs"
                        >
                            {requirement === "optional"
                                ? t.hints.keyOptional
                                : t.hints.key}
                        </p>
                    </div>
                )}
            </fieldset>
            <div className="flex items-center gap-2">
                <Checkbox
                    id={field("enable")}
                    checked={enable}
                    disabled={disabled}
                    onCheckedChange={(value) => setEnable(value === true)}
                />
                <Label
                    htmlFor={field("enable")}
                    className="text-sm font-normal"
                >
                    {t.enableAfterTest}
                </Label>
            </div>
            {tested && (
                <p
                    role="status"
                    className={
                        tested === "ok" ? "text-sm" : "text-destructive text-sm"
                    }
                >
                    {t.outcomes[tested]}
                </p>
            )}
            <div className="flex flex-wrap gap-2">
                <Button
                    type="button"
                    variant="outline"
                    disabled={disabled}
                    onClick={async () => {
                        const result = await post({ action: "test", ...body() })
                        setTested(result.test)
                        if (!result.ok) report(result, "")
                    }}
                >
                    {t.actions.test}
                </Button>
                <Button type="submit" disabled={disabled || !canSaveKey}>
                    {t.actions.save}
                </Button>
            </div>
        </form>
    )
}

function ServerRow({
    source,
    copy: t,
    disabled,
    encryption,
    errors,
    post,
    report,
}: {
    source: GameServerSource
    copy: Copy
    disabled: boolean
    encryption: GameServerSourceList["encryption"]
    errors: CollectionErrors
    post: Post
    report(result: CommandResult, success: string): void
}) {
    const id = useId()
    const [mode, setMode] = useState<"view" | "key" | "rename">("view")
    const [key, setKey] = useState("")
    const [allowUnverified, setAllowUnverified] = useState(false)
    const [name, setName] = useState(source.displayName)
    const workspace = source.managed === "workspace"
    const requirement = keyField(source.provider)
    const enabled = source.collection?.enabled ?? false
    const base = { ref: source.ref, expectedRevision: source.revision }
    return (
        <article
            className="space-y-2 rounded-md border p-3"
            aria-labelledby={`${id}-name`}
        >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4 id={`${id}-name`} className="text-sm font-medium break-all">
                    {source.displayName}
                </h4>
                <span className="text-muted-foreground text-xs">
                    {t.managed[source.managed]}
                </span>
            </div>
            <p className="text-muted-foreground text-xs break-all">
                {t.games[source.gameId]} · {t.providers[source.provider]} ·{" "}
                {source.providerServerId} · {new URL(source.origin).host}
            </p>
            <ul className="space-y-0.5 text-xs">
                <li>
                    {t.key[source.key.state]}
                    {source.key.changedAt &&
                        ` · ${fill(t.keyChanged, { date: date(source.key.changedAt) })}`}
                    {source.key.state === "set" &&
                        ` · ${source.key.verified ? t.verified : t.unverified}`}
                </li>
                {source.key.failure && (
                    <li className="text-destructive">
                        {t.failure[source.key.failure]}
                    </li>
                )}
                <li>
                    {source.collection
                        ? source.collection.enabled
                            ? t.collection.enabled
                            : t.collection.disabled
                        : t.collection.none}
                    {" · "}
                    {source.collection?.lastSuccessAt
                        ? fill(t.collection.lastSuccess, {
                              date: date(source.collection.lastSuccessAt),
                          })
                        : t.collection.never}
                </li>
                {source.collection?.errorCategory && (
                    <li className="text-destructive">
                        {errors[source.collection.errorCategory]}
                    </li>
                )}
                {source.lastTest && (
                    <li>
                        {fill(t.lastTest, {
                            date: date(source.lastTest.at),
                            outcome: t.outcomes[source.lastTest.outcome],
                        })}
                    </li>
                )}
            </ul>
            <div className="flex flex-wrap gap-2">
                <Button
                    size="sm"
                    variant="outline"
                    disabled={disabled}
                    onClick={async () => {
                        const result = await post({
                            action: "test_stored",
                            ref: source.ref,
                        })
                        report(
                            result,
                            result.test ? t.outcomes[result.test] : ""
                        )
                    }}
                >
                    {t.actions.testStored}
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    disabled={disabled}
                    onClick={async () => {
                        const result = await post({
                            action: "set_enabled",
                            ref: source.ref,
                            enabled: !enabled,
                        })
                        report(
                            result,
                            enabled ? t.saved.disabled : t.saved.enabled
                        )
                    }}
                >
                    {enabled ? t.actions.disable : t.actions.enable}
                </Button>
                {requirement !== "hidden" && encryption === "active" && (
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={disabled}
                        aria-expanded={mode === "key"}
                        onClick={() => setMode(mode === "key" ? "view" : "key")}
                    >
                        {t.actions.changeKey}
                    </Button>
                )}
                {workspace && (
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={disabled}
                        aria-expanded={mode === "rename"}
                        onClick={() =>
                            setMode(mode === "rename" ? "view" : "rename")
                        }
                    >
                        {t.actions.rename}
                    </Button>
                )}
                {workspace && source.key.state === "set" && (
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={disabled}
                        onClick={async () => {
                            if (
                                !window.confirm(
                                    fill(t.confirm.removeKey, {
                                        name: source.displayName,
                                    })
                                )
                            )
                                return
                            report(
                                await post({ action: "remove_key", ...base }),
                                t.saved.removedKey
                            )
                        }}
                    >
                        {t.actions.removeKey}
                    </Button>
                )}
                {workspace && (
                    <Button
                        size="sm"
                        variant="destructive"
                        disabled={disabled}
                        onClick={async () => {
                            if (
                                !window.confirm(
                                    fill(t.confirm.remove, {
                                        name: source.displayName,
                                    })
                                )
                            )
                                return
                            report(
                                await post({ action: "remove", ...base }),
                                t.saved.removed
                            )
                        }}
                    >
                        {t.actions.remove}
                    </Button>
                )}
            </div>
            {mode === "key" && (
                <form
                    className="grid gap-2 md:grid-cols-[1fr_auto]"
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
                            autoComplete="new-password"
                            spellCheck={false}
                            value={key}
                            maxLength={4200}
                            required
                            disabled={disabled}
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
                    className="flex flex-wrap items-end gap-2"
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
        </article>
    )
}
