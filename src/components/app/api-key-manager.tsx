"use client"

import { useCallback, useEffect, useId, useState } from "react"
import { Copy, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    API_KEY_READ_RESOURCES,
    isApiKeyReadAccess,
    type ApiKeyReadAccess,
} from "@/domain/api/key-access"
import { GAME_IDS, GAME_LABELS, type GameId } from "@/domain/games/game"
import type { Dictionary } from "@/i18n/dictionaries"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

type ApiKey = {
    id: string
    name: string
    keyPrefix: string
    createdAt: string
    lastUsedAt?: string
    revokedAt?: string
    readAccess?: ApiKeyReadAccess
}

type Props = { serverId: string; dictionary: Dictionary }
type Resource = ApiKeyReadAccess["resources"][number]
const summaryResources: Resource[] = ["event-summaries", "match-summaries"]
const resources = [
    ...summaryResources,
    ...API_KEY_READ_RESOURCES.filter(
        (resource) => !summaryResources.includes(resource)
    ),
]

export function ApiKeyManager(props: Props) {
    // Workspace navigation must discard revealed credentials and pending form state.
    return <ApiKeyManagerForm key={props.serverId} {...props} />
}

function ApiKeyManagerForm({ serverId, dictionary }: Props) {
    const t = dictionary.apiKeys
    const id = useId()
    const [keys, setKeys] = useState<ApiKey[]>([])
    const [name, setName] = useState("")
    const [mode, setMode] = useState<"read-only" | "legacy">("read-only")
    const [selectedResources, setSelectedResources] =
        useState<Resource[]>(summaryResources)
    const [games, setGames] = useState<GameId[]>([])
    const [newKey, setNewKey] = useState<string | null>(null)
    const [pending, setPending] = useState(false)
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState(false)
    const url = `/api/servers/${encodeURIComponent(serverId)}/api-keys`
    const readAccess = { resources: selectedResources, gameIds: games }
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
        void load(controller.signal)
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
            await load()
        } catch {
            toast.error(t.createFailed)
        } finally {
            setPending(false)
        }
    }

    async function revoke(keyId: string) {
        if (pending) return
        setPending(true)
        try {
            const response = await fetch(
                `${url}?keyId=${encodeURIComponent(keyId)}`,
                { method: "DELETE" }
            )
            if (!response.ok) throw new Error(t.revokeFailed)
            await load()
        } catch {
            toast.error(t.revokeFailed)
        } finally {
            setPending(false)
        }
    }

    return (
        <div className="space-y-5">
            <p className="text-muted-foreground text-sm">{t.description}</p>
            {newKey ? (
                <div
                    className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3"
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
            <form
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
                            <Label htmlFor={`${id}-access`}>{t.access}</Label>
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
                        <div className="space-y-4 rounded-lg border p-4">
                            <p className="text-muted-foreground text-sm">
                                {t.readOnlyHelp}
                            </p>
                            <fieldset className="space-y-3">
                                <legend className="text-sm font-medium">
                                    {t.resources}
                                </legend>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {resources.map((resource) => (
                                        <div
                                            key={resource}
                                            className="flex items-center gap-2"
                                        >
                                            <Checkbox
                                                id={`${id}-${resource}`}
                                                checked={selectedResources.includes(
                                                    resource
                                                )}
                                                disabled={pending}
                                                onCheckedChange={(checked) =>
                                                    setSelectedResources(
                                                        (current) =>
                                                            checked === true
                                                                ? [
                                                                      ...current,
                                                                      resource,
                                                                  ]
                                                                : current.filter(
                                                                      (value) =>
                                                                          value !==
                                                                          resource
                                                                  )
                                                    )
                                                }
                                            />
                                            <Label
                                                htmlFor={`${id}-${resource}`}
                                            >
                                                {t.resourceLabels[resource]}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-muted-foreground text-xs">
                                    {t.privateData}
                                </p>
                            </fieldset>
                            <fieldset className="space-y-3">
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
                                                checked={games.includes(game)}
                                                disabled={pending}
                                                onCheckedChange={(checked) =>
                                                    setGames((current) =>
                                                        checked === true
                                                            ? [...current, game]
                                                            : current.filter(
                                                                  (value) =>
                                                                      value !==
                                                                      game
                                                              )
                                                    )
                                                }
                                            />
                                            <Label htmlFor={`${id}-${game}`}>
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
            <div className="space-y-2">
                <h3 className="text-sm font-medium">{t.existingKeys}</h3>
                <p className="text-muted-foreground text-xs">{t.rotateHelp}</p>
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
                    <p className="text-muted-foreground text-sm">{t.empty}</p>
                ) : null}
                {keys.map((key) => (
                    <div
                        key={key.id}
                        className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3"
                    >
                        <div className="min-w-0 flex-1 space-y-1">
                            <p className="font-medium break-words">
                                {key.name}
                            </p>
                            <p className="text-muted-foreground text-xs">
                                {key.keyPrefix}… · {t.created}{" "}
                                {new Date(key.createdAt).toLocaleDateString()}
                                {key.revokedAt ? ` · ${t.revoked}` : ""}
                            </p>
                            {key.readAccess === undefined ? (
                                <p className="text-sm font-medium">
                                    {t.fullAccess} — {t.allGames}
                                </p>
                            ) : isApiKeyReadAccess(key.readAccess) ? (
                                <div className="space-y-1 text-sm">
                                    <p className="font-medium">{t.readOnly}</p>
                                    <p>
                                        {key.readAccess.resources
                                            .map(
                                                (resource) =>
                                                    t.resourceLabels[resource]
                                            )
                                            .join(", ")}
                                    </p>
                                    <p className="text-muted-foreground">
                                        {key.readAccess.gameIds
                                            .map((game) => GAME_LABELS[game])
                                            .join(", ")}
                                    </p>
                                </div>
                            ) : (
                                <p className="text-sm">{t.invalidPolicy}</p>
                            )}
                        </div>
                        {!key.revokedAt ? (
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={pending || loadError}
                                aria-label={`${t.revoke}: ${key.name}`}
                                onClick={() => void revoke(key.id)}
                            >
                                <Trash2 className="size-4" />
                                {t.revoke}
                            </Button>
                        ) : null}
                    </div>
                ))}
            </div>
        </div>
    )
}
