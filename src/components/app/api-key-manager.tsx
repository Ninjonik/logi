"use client"

import { useCallback, useEffect, useId, useState } from "react"
import { Copy, KeyRound, Plus, X } from "lucide-react"
import { toast } from "sonner"

import {
    API_KEY_RESOURCE_GROUP_IDS,
    groupsOfResources,
    resourcesForGroups,
    type ApiKeyResourceGroup,
} from "@/domain/api/key-access-groups"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    isApiKeyReadAccess,
    type ApiKeyReadAccess,
} from "@/domain/api/key-access"
import { ConfirmActionDialog } from "@/components/app/confirm-action-dialog"
import { GAME_IDS, GAME_LABELS, type GameId } from "@/domain/games/game"
import { SettingsStep } from "@/components/app/settings/settings-step"
import { EmptyState } from "@/components/app/empty-state"
import type { Dictionary } from "@/i18n/dictionaries"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type ApiKey = {
    id: string
    name: string
    keyPrefix: string
    createdAt: string
    lastUsedAt?: string
    revokedAt?: string
    readAccess?: ApiKeyReadAccess
}

type Props = {
    serverId: string
    dictionary: Dictionary
    /** Renders the manager as a numbered step with "New key" in its header (design G5). */
    step?: { id: string; number: number; title: string }
}
const DEFAULT_GROUPS: ApiKeyResourceGroup[] = ["matches"]

export function ApiKeyManager(props: Props) {
    // Workspace navigation must discard revealed credentials and pending form state.
    return <ApiKeyManagerForm key={props.serverId} {...props} />
}

function ApiKeyManagerForm({ serverId, dictionary, step }: Props) {
    const t = dictionary.apiKeys
    const web = dictionary.integrationSettings.web
    const id = useId()
    const [keys, setKeys] = useState<ApiKey[]>([])
    const [name, setName] = useState("")
    const [mode, setMode] = useState<"read-only" | "legacy">("read-only")
    const [groups, setGroups] = useState<ApiKeyResourceGroup[]>(DEFAULT_GROUPS)
    const [games, setGames] = useState<GameId[]>([])
    const [newKey, setNewKey] = useState<string | null>(null)
    const [pending, setPending] = useState(false)
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState(false)
    // The form starts open so a clan without keys sees it at once; once the
    // list loads it folds behind "New key" when keys already exist.
    const [formOpen, setFormOpen] = useState(true)
    const url = `/api/servers/${encodeURIComponent(serverId)}/api-keys`
    const readAccess = { resources: resourcesForGroups(groups), gameIds: games }
    const valid =
        Boolean(name.trim()) &&
        name.trim().length <= 80 &&
        (mode === "legacy" || isApiKeyReadAccess(readAccess))

    const load = useCallback(
        (signal?: AbortSignal) =>
            fetch(url, { cache: "no-store", signal })
                .then(async (response) => {
                    if (!response.ok) throw new Error("Unable to load keys")
                    const body = (await response.json()) as { keys: ApiKey[] }
                    if (!Array.isArray(body.keys))
                        throw new Error("Invalid key list")
                    return body.keys
                })
                .then((loadedKeys) => {
                    if (!signal?.aborted) {
                        setKeys(loadedKeys)
                        setLoadError(false)
                    }
                    return loadedKeys
                })
                .catch(() => {
                    if (!signal?.aborted) setLoadError(true)
                })
                .finally(() => {
                    if (!signal?.aborted) setLoading(false)
                }),
        [url]
    )

    useEffect(() => {
        const controller = new AbortController()
        void load(controller.signal).then((loadedKeys) => {
            if (loadedKeys && !controller.signal.aborted)
                setFormOpen(!loadedKeys.some((key) => !key.revokedAt))
        })
        return () => controller.abort()
    }, [load])

    async function create() {
        if (!valid || pending) return
        setPending(true)
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    ...(mode === "read-only" ? { readAccess } : {}),
                }),
            })
            const body = (await response.json().catch(() => null)) as {
                key?: unknown
            } | null
            if (!response.ok) throw new Error(t.createFailed)
            if (typeof body?.key !== "string") {
                toast.error(t.invalidKey)
                return
            }
            setNewKey(body.key)
            setName("")
            setFormOpen(false)
            await load()
        } catch {
            toast.error(t.createFailed)
        } finally {
            setPending(false)
        }
    }

    async function revoke(keyId: string) {
        if (pending) return false
        setPending(true)
        try {
            const response = await fetch(
                `${url}?keyId=${encodeURIComponent(keyId)}`,
                { method: "DELETE" }
            )
            if (!response.ok) throw new Error(t.revokeFailed)
            await load()
            return true
        } catch {
            toast.error(t.revokeFailed)
            return false
        } finally {
            setPending(false)
        }
    }

    /** "read only · matches, rosters · both games" for a key's policy. */
    function summary(access: ApiKeyReadAccess) {
        const covered = groupsOfResources(access.resources)
        const areas = [
            ...covered.full.map((group) => t.groups[group].short),
            ...covered.partial.map((group) =>
                t.partialGroup.replace("{group}", t.groups[group].short)
            ),
        ].join(", ")
        const gameText = GAME_IDS.every((game) => access.gameIds.includes(game))
            ? t.everyGame
            : access.gameIds.map((game) => GAME_LABELS[game]).join(", ")
        return [t.readOnlyShort, areas, gameText].filter(Boolean).join(" · ")
    }
    const createdOn = (iso: string) =>
        t.createdOn.replace(
            "{date}",
            new Intl.DateTimeFormat(undefined, {
                day: "numeric",
                month: "numeric",
            }).format(new Date(iso))
        )

    const toggle = (
        <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg"
            aria-expanded={formOpen}
            aria-controls={`${id}-form`}
            onClick={() => setFormOpen((open) => !open)}
        >
            {formOpen ? (
                <X className="size-4" aria-hidden="true" />
            ) : (
                <Plus className="size-4" aria-hidden="true" />
            )}
            {formOpen ? web.closeForm : web.newKey}
        </Button>
    )

    const body = (
        <div className="space-y-4">
            {step ? null : (
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="text-muted-foreground max-w-prose min-w-0 flex-1 text-sm">
                        {t.description}
                    </p>
                    {toggle}
                </div>
            )}
            {newKey ? (
                <div
                    className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3"
                    role="status"
                >
                    <p className="text-sm font-medium">{t.copyNow}</p>
                    <div className="flex gap-2">
                        <code className="bg-background min-w-0 flex-1 overflow-x-auto rounded p-2 text-xs">
                            {newKey}
                        </code>
                        <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            onClick={async () => {
                                try {
                                    await navigator.clipboard.writeText(newKey)
                                    toast.success(t.copied)
                                } catch {
                                    toast.error(t.copyFailed)
                                }
                            }}
                        >
                            <Copy className="size-4" />
                            <span className="sr-only">{t.copy}</span>
                        </Button>
                    </div>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setNewKey(null)}
                    >
                        {t.hide}
                    </Button>
                </div>
            ) : null}
            {formOpen ? (
                <form
                    id={`${id}-form`}
                    className="rounded-xl border p-4"
                    onSubmit={(event) => {
                        event.preventDefault()
                        void create()
                    }}
                >
                    <fieldset className="space-y-4" disabled={pending}>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor={`${id}-name`}>{t.name}</Label>
                                <Input
                                    id={`${id}-name`}
                                    value={name}
                                    onChange={(event) =>
                                        setName(event.target.value)
                                    }
                                    placeholder={t.namePlaceholder}
                                    maxLength={80}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor={`${id}-access`}>
                                    {t.access}
                                </Label>
                                <Select
                                    value={mode}
                                    onValueChange={(value) =>
                                        setMode(
                                            value === "legacy"
                                                ? "legacy"
                                                : "read-only"
                                        )
                                    }
                                    disabled={pending}
                                >
                                    <SelectTrigger
                                        id={`${id}-access`}
                                        className="w-full"
                                    >
                                        <SelectValue>
                                            {mode === "read-only"
                                                ? t.readOnly
                                                : t.fullAccess}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="read-only">
                                            {t.readOnly}
                                        </SelectItem>
                                        <SelectItem value="legacy">
                                            {t.fullAccess}
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        {mode === "read-only" ? (
                            <div className="space-y-4">
                                <fieldset className="space-y-2">
                                    <legend className="text-sm font-medium">
                                        {t.groupsLegend}
                                    </legend>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        {API_KEY_RESOURCE_GROUP_IDS.map(
                                            (group) => {
                                                const checked =
                                                    groups.includes(group)
                                                return (
                                                    <label
                                                        key={group}
                                                        htmlFor={`${id}-${group}`}
                                                        className={cn(
                                                            "hover:bg-accent/40 flex cursor-pointer items-start gap-3 rounded-lg border p-3",
                                                            checked &&
                                                                "border-foreground/40 bg-accent/30"
                                                        )}
                                                    >
                                                        <Checkbox
                                                            id={`${id}-${group}`}
                                                            checked={checked}
                                                            disabled={pending}
                                                            className="mt-0.5"
                                                            onCheckedChange={(
                                                                value
                                                            ) =>
                                                                setGroups(
                                                                    (
                                                                        current
                                                                    ) =>
                                                                        value ===
                                                                        true
                                                                            ? [
                                                                                  ...current,
                                                                                  group,
                                                                              ]
                                                                            : current.filter(
                                                                                  (
                                                                                      item
                                                                                  ) =>
                                                                                      item !==
                                                                                      group
                                                                              )
                                                                )
                                                            }
                                                        />
                                                        <span className="space-y-0.5">
                                                            <span className="block text-sm font-medium">
                                                                {
                                                                    t.groups[
                                                                        group
                                                                    ].label
                                                                }
                                                            </span>
                                                            <span className="text-muted-foreground block text-xs">
                                                                {
                                                                    t.groups[
                                                                        group
                                                                    ].help
                                                                }
                                                            </span>
                                                        </span>
                                                    </label>
                                                )
                                            }
                                        )}
                                    </div>
                                    <p className="text-muted-foreground text-xs">
                                        {t.privateData}
                                    </p>
                                </fieldset>
                                <fieldset className="space-y-2">
                                    <legend className="text-sm font-medium">
                                        {t.games}
                                    </legend>
                                    <div className="flex flex-wrap gap-4">
                                        {GAME_IDS.map((game) => (
                                            <div
                                                key={game}
                                                className="flex items-center gap-2"
                                            >
                                                <Checkbox
                                                    id={`${id}-${game}`}
                                                    checked={games.includes(
                                                        game
                                                    )}
                                                    disabled={pending}
                                                    onCheckedChange={(
                                                        checked
                                                    ) =>
                                                        setGames((current) =>
                                                            checked === true
                                                                ? [
                                                                      ...current,
                                                                      game,
                                                                  ]
                                                                : current.filter(
                                                                      (value) =>
                                                                          value !==
                                                                          game
                                                                  )
                                                        )
                                                    }
                                                />
                                                <Label
                                                    htmlFor={`${id}-${game}`}
                                                >
                                                    {GAME_LABELS[game]}
                                                </Label>
                                            </div>
                                        ))}
                                    </div>
                                </fieldset>
                                {!isApiKeyReadAccess(readAccess) ? (
                                    <p className="text-muted-foreground text-sm">
                                        {t.selectScope}
                                    </p>
                                ) : null}
                            </div>
                        ) : (
                            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                                {t.fullAccessHelp}
                            </p>
                        )}
                        <Button type="submit" disabled={pending || !valid}>
                            <Plus className="size-4" />
                            {mode === "read-only"
                                ? t.createReadOnly
                                : t.createFullAccess}
                        </Button>
                    </fieldset>
                </form>
            ) : null}
            {loading ? (
                <p className="text-muted-foreground text-sm" role="status">
                    {t.loading}
                </p>
            ) : null}
            {loadError ? (
                <div role="alert" className="space-y-2 text-sm">
                    <p>{t.loadFailed}</p>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() => void load()}
                    >
                        {t.retry}
                    </Button>
                </div>
            ) : null}
            {!loading && !loadError && keys.length === 0 ? (
                <EmptyState
                    icon={KeyRound}
                    title={t.emptyTitle}
                    description={t.emptyDescription}
                />
            ) : null}
            {keys.length ? (
                <ul className="divide-y rounded-xl border">
                    {keys.map((key) => (
                        <li
                            key={key.id}
                            className={cn(
                                "flex flex-wrap items-center gap-3 p-4",
                                key.revokedAt && "opacity-70"
                            )}
                        >
                            <div className="min-w-0 flex-1 space-y-0.5">
                                <p className="text-sm break-words">
                                    {key.name}
                                    {key.revokedAt ? (
                                        <span className="text-muted-foreground">
                                            {" "}
                                            · {t.revoked}
                                        </span>
                                    ) : null}
                                </p>
                                <p className="text-muted-foreground text-[13px]">
                                    {key.readAccess === undefined
                                        ? `${t.fullAccess} · ${t.allGames}`
                                        : isApiKeyReadAccess(key.readAccess)
                                          ? summary(key.readAccess)
                                          : t.invalidPolicy}
                                </p>
                            </div>
                            <span className="text-muted-foreground text-[13px]">
                                {createdOn(key.createdAt)}
                            </span>
                            {!key.revokedAt ? (
                                <ConfirmActionDialog
                                    trigger={
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="text-destructive border-destructive/40 hover:text-destructive rounded-lg"
                                            disabled={pending || loadError}
                                            aria-label={`${t.revokeConfirm}: ${key.name}`}
                                        >
                                            {t.revokeConfirm}
                                        </Button>
                                    }
                                    title={t.revokeTitle.replace(
                                        "{name}",
                                        key.name
                                    )}
                                    description={t.revokeDescription}
                                    confirmLabel={t.revokeConfirm}
                                    cancelLabel={
                                        dictionary.integrationSettings.cancel
                                    }
                                    onConfirm={() => revoke(key.id)}
                                />
                            ) : null}
                        </li>
                    ))}
                </ul>
            ) : null}
            <p className="text-muted-foreground text-xs">
                {web.keyShownOnce} {t.rotateHelp}
            </p>
        </div>
    )

    return step ? (
        <SettingsStep
            id={step.id}
            number={step.number}
            title={step.title}
            actions={toggle}
        >
            {body}
        </SettingsStep>
    ) : (
        body
    )
}
