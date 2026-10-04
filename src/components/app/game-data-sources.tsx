"use client"

import {
    registeredSourceListSchema,
    sourceRegistrationSchema,
    sourceRotationSchema,
    type RegisteredSource,
} from "@/domain/game-data/source-registration"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useCallback, useEffect, useId, useState } from "react"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

type Props = { serverId: string; dictionary: Dictionary }
type Copy = Dictionary["gameData"]
type ErrorCode = keyof Copy["sourceErrors"]
const PROVIDERS = [
    "hll_crcon",
    "wardogs_warcon",
    "wardogs_rcon",
    "wardogs_public_directory",
] as const
const GAME_FOR_PROVIDER: Record<
    (typeof PROVIDERS)[number],
    "hell_let_loose" | "wardogs"
> = {
    hll_crcon: "hell_let_loose",
    wardogs_warcon: "wardogs",
    wardogs_rcon: "wardogs",
    wardogs_public_directory: "wardogs",
}
const emptyForm = {
    ref: "",
    provider: "wardogs_warcon" as (typeof PROVIDERS)[number],
    providerServerId: "",
    origin: "",
    secretRef: "",
    allowedAddresses: "",
}
const split = (value: string) => [
    ...new Set(
        value
            .split(/[\s,]+/)
            .map((item) => item.trim())
            .filter(Boolean)
    ),
]
function errorCode(body: unknown): ErrorCode {
    const code =
        body && typeof body === "object" && "error" in body
            ? (body as { error?: unknown }).error
            : null
    return typeof code === "string" &&
        [
            "invalid_source",
            "duplicate_ref",
            "duplicate_identity",
            "limit_reached",
            "not_found",
        ].includes(code)
        ? (code as ErrorCode)
        : "unavailable"
}

export function GameDataSources(props: Props) {
    return <Sources key={props.serverId} {...props} />
}

function Sources({ serverId, dictionary }: Props) {
    const t = dictionary.gameData,
        id = useId()
    const url = `/api/servers/${encodeURIComponent(serverId)}/game-data-sources`
    const [sources, setSources] = useState<RegisteredSource[] | null>(null)
    const [form, setForm] = useState(emptyForm)
    const [loading, setLoading] = useState(true),
        [pending, setPending] = useState(false),
        [failure, setFailure] = useState<ErrorCode | null>(null),
        [saved, setSaved] = useState(false)
    const load = useCallback(
        async (signal?: AbortSignal) => {
            const response = await fetch(url, { cache: "no-store", signal })
            if (!response.ok) throw new Error()
            const value = registeredSourceListSchema.parse(
                await response.json()
            )
            if (!signal?.aborted) setSources(value.sources)
        },
        [url]
    )
    useEffect(() => {
        const controller = new AbortController()
        void load(controller.signal)
            .catch(() => {
                if (!controller.signal.aborted) setFailure("unavailable")
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false)
            })
        return () => controller.abort()
    }, [load])

    async function post(body: unknown) {
        setPending(true)
        setFailure(null)
        setSaved(false)
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(body),
            })
            const result: unknown = await response.json().catch(() => null)
            if (!response.ok) {
                setFailure(errorCode(result))
                return false
            }
            await load()
            setSaved(true)
            return true
        } catch {
            setFailure("unavailable")
            return false
        } finally {
            setPending(false)
        }
    }

    const busy = loading || pending
    const field = (name: string) => `${id}-${name}`
    return (
        <section className="space-y-4 rounded-lg border p-4">
            <h3 className="font-medium">{t.sourcesTitle}</h3>
            <p className="text-muted-foreground text-sm">
                {t.sourcesDescription}
            </p>
            {failure && (
                <p role="alert" className="text-destructive text-sm">
                    {t.sourceErrors[failure]}
                </p>
            )}
            {saved && (
                <p role="status" className="text-sm">
                    {t.sourceSaved}
                </p>
            )}
            {sources?.length === 0 && (
                <p className="text-muted-foreground text-sm">{t.sourceNone}</p>
            )}
            {sources?.map((source) => (
                <SourceRow
                    key={`${source.managed}:${source.ref}:${source.updatedAt ?? ""}`}
                    source={source}
                    copy={t}
                    disabled={busy}
                    rotate={(rotation) => post({ action: "rotate", rotation })}
                    remove={() => post({ action: "remove", ref: source.ref })}
                />
            ))}
            <form
                className="space-y-3 border-t pt-4"
                onSubmit={async (event) => {
                    event.preventDefault()
                    const registration = sourceRegistrationSchema.safeParse({
                        ref: form.ref.trim(),
                        gameId: GAME_FOR_PROVIDER[form.provider],
                        provider: form.provider,
                        providerServerId: form.providerServerId,
                        origin: form.origin,
                        secretRef: form.secretRef.trim() || null,
                        allowedAddresses: split(form.allowedAddresses),
                    })
                    if (!registration.success) {
                        setFailure("invalid_source")
                        return
                    }
                    if (
                        await post({
                            action: "register",
                            registration: registration.data,
                        })
                    )
                        setForm(emptyForm)
                }}
            >
                <h4 className="text-sm font-medium">{t.sourceRegister}</h4>
                <fieldset disabled={busy} className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                        <Label htmlFor={field("ref")}>{t.sourceRef}</Label>
                        <Input
                            id={field("ref")}
                            value={form.ref}
                            maxLength={64}
                            placeholder="warcon-main"
                            onChange={(event) =>
                                setForm({ ...form, ref: event.target.value })
                            }
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor={field("provider")}>
                            {t.sourceProvider}
                        </Label>
                        <Select
                            value={form.provider}
                            onValueChange={(value) =>
                                setForm({
                                    ...form,
                                    provider:
                                        value as (typeof PROVIDERS)[number],
                                })
                            }
                        >
                            <SelectTrigger
                                id={field("provider")}
                                className="w-full"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {PROVIDERS.map((provider) => (
                                    <SelectItem key={provider} value={provider}>
                                        {t.sourceProviders[provider]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor={field("server")}>
                            {t.sourceServerId}
                        </Label>
                        <Input
                            id={field("server")}
                            value={form.providerServerId}
                            maxLength={200}
                            onChange={(event) =>
                                setForm({
                                    ...form,
                                    providerServerId: event.target.value,
                                })
                            }
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor={field("origin")}>
                            {t.sourceOrigin}
                        </Label>
                        <Input
                            id={field("origin")}
                            value={form.origin}
                            maxLength={200}
                            placeholder="https://panel.example.com"
                            onChange={(event) =>
                                setForm({ ...form, origin: event.target.value })
                            }
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor={field("secret")}>
                            {t.sourceSecretRef}
                        </Label>
                        <Input
                            id={field("secret")}
                            value={form.secretRef}
                            maxLength={120}
                            placeholder="LOGI_GAME_DATA_WARCON_TOKEN"
                            className="font-mono"
                            onChange={(event) =>
                                setForm({
                                    ...form,
                                    secretRef: event.target.value.toUpperCase(),
                                })
                            }
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor={field("allow")}>
                            {t.sourceAllowlist}
                        </Label>
                        <Input
                            id={field("allow")}
                            value={form.allowedAddresses}
                            maxLength={1100}
                            onChange={(event) =>
                                setForm({
                                    ...form,
                                    allowedAddresses: event.target.value,
                                })
                            }
                        />
                    </div>
                </fieldset>
                <p className="text-muted-foreground text-xs">
                    {t.sourceSecretRefHelp}
                </p>
                <Button type="submit" disabled={busy}>
                    {pending ? t.sourceSaving : t.sourceRegister}
                </Button>
            </form>
        </section>
    )
}

function SourceRow({
    source,
    copy: t,
    disabled,
    rotate,
    remove,
}: {
    source: RegisteredSource
    copy: Copy
    disabled: boolean
    rotate(rotation: unknown): Promise<boolean>
    remove(): Promise<boolean>
}) {
    const id = useId()
    const [secretRef, setSecretRef] = useState(source.secretRef ?? "")
    const [allowlist, setAllowlist] = useState(
        source.allowedAddresses.join(", ")
    )
    const [invalid, setInvalid] = useState(false)
    const workspace = source.managed === "workspace"
    return (
        <article
            className="space-y-2 rounded-md border p-3"
            aria-label={source.ref}
        >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4 className="font-mono text-sm font-medium break-all">
                    {source.ref}
                </h4>
                <span className="text-muted-foreground text-xs">
                    {workspace
                        ? t.sourceWorkspaceManaged
                        : t.sourceOperatorManaged}
                </span>
            </div>
            <p className="text-muted-foreground text-xs break-all">
                {t.sourceProviders[source.provider]} ·{" "}
                {source.gameId === "wardogs" ? "Wardogs" : "Hell Let Loose"} ·{" "}
                {source.providerServerId} · {source.origin}
            </p>
            {workspace ? (
                <form
                    className="grid gap-2 md:grid-cols-[1fr_1fr_auto_auto]"
                    onSubmit={async (event) => {
                        event.preventDefault()
                        const rotation = sourceRotationSchema.safeParse({
                            ref: source.ref,
                            secretRef: secretRef.trim() || null,
                            allowedAddresses: split(allowlist),
                        })
                        setInvalid(!rotation.success)
                        if (rotation.success) await rotate(rotation.data)
                    }}
                >
                    <div className="space-y-1">
                        <Label htmlFor={`${id}-secret`} className="text-xs">
                            {t.sourceSecretRef}
                        </Label>
                        <Input
                            id={`${id}-secret`}
                            value={secretRef}
                            maxLength={120}
                            className="font-mono"
                            disabled={disabled}
                            onChange={(event) =>
                                setSecretRef(event.target.value.toUpperCase())
                            }
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor={`${id}-allow`} className="text-xs">
                            {t.sourceAllowlist}
                        </Label>
                        <Input
                            id={`${id}-allow`}
                            value={allowlist}
                            maxLength={1100}
                            disabled={disabled}
                            onChange={(event) =>
                                setAllowlist(event.target.value)
                            }
                        />
                    </div>
                    <Button
                        type="submit"
                        variant="outline"
                        className="self-end"
                        disabled={disabled}
                    >
                        {t.sourceRotate}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        className="self-end"
                        disabled={disabled}
                        onClick={() => void remove()}
                    >
                        {t.sourceRemove}
                    </Button>
                    {invalid && (
                        <p
                            role="alert"
                            className="text-destructive text-xs md:col-span-4"
                        >
                            {t.sourceErrors.invalid_source}
                        </p>
                    )}
                </form>
            ) : (
                <p className="text-xs">
                    {t.sourceSecretRef}:{" "}
                    <span className="font-mono">{source.secretRef ?? "—"}</span>
                </p>
            )}
        </article>
    )
}
