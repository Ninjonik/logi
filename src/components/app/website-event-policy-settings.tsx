"use client"

import {
    eligibleWebsiteEventKeys,
    websiteEventPolicyApplicationsSchema,
    websiteEventPolicyInputSchema,
    websiteEventPolicyKeysSchema,
    websiteEventPolicyListSchema,
    type WebsiteEventPolicyApplication,
    type WebsiteEventPolicyInput,
    type WebsiteEventPolicyKey,
} from "@/domain/events/website-command"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import type { DiscordSelectOption } from "@/components/app/discord-entity-select"
import { PolicyRolePicker } from "@/components/app/settings/policy-role-picker"
import { useDiscordMetadata } from "@/hooks/use-discord-metadata"
import { useCallback, useEffect, useId, useState } from "react"
import type { Dictionary } from "@/i18n/dictionaries"
import { GAME_LABELS } from "@/domain/games/game"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import type { z } from "zod"

type Props = { serverId: string; dictionary: Dictionary }
type PolicyList = z.infer<typeof websiteEventPolicyListSchema>
type Failure = "error" | "denied" | "invalid"

export function WebsiteEventPolicySettings(props: Props) {
    return <Settings key={props.serverId} {...props} />
}

function failureFor(body: unknown): Failure {
    if (body && typeof body === "object" && "error" in body) {
        const error = (body as { error?: { code?: unknown } }).error
        if (error?.code === "policy_denied") return "denied"
        if (error?.code === "invalid_request") return "invalid"
    }
    return "error"
}

function Settings({ serverId, dictionary }: Props) {
    const t = dictionary.websiteEventPolicies,
        selectId = useId()
    const base = `/api/servers/${encodeURIComponent(serverId)}`
    const [applications, setApplications] = useState<
        WebsiteEventPolicyApplication[] | null
    >(null)
    const [keys, setKeys] = useState<WebsiteEventPolicyKey[] | null>(null)
    const [applicationId, setApplicationId] = useState("")
    const [policies, setPolicies] = useState<PolicyList | null>(null)
    const discordRoles = useDiscordMetadata(serverId)?.roles ?? null
    const [loading, setLoading] = useState(true),
        [pending, setPending] = useState(false),
        [failure, setFailure] = useState<Failure | null>(null),
        [saved, setSaved] = useState(false)

    const loadSources = useCallback(
        async (signal?: AbortSignal) => {
            const [applicationResponse, keyResponse] = await Promise.all([
                fetch(`${base}/sso-applications`, {
                    cache: "no-store",
                    signal,
                }),
                fetch(`${base}/api-keys`, { cache: "no-store", signal }),
            ])
            if (!applicationResponse.ok || !keyResponse.ok) throw new Error()
            const loadedApplications =
                websiteEventPolicyApplicationsSchema.parse(
                    await applicationResponse.json()
                )
            const loadedKeys = websiteEventPolicyKeysSchema.parse(
                await keyResponse.json()
            )
            if (signal?.aborted) return
            setApplications(loadedApplications)
            setKeys(eligibleWebsiteEventKeys(loadedKeys.keys))
            setApplicationId((current) =>
                loadedApplications.some((app) => app.id === current)
                    ? current
                    : loadedApplications.length === 1
                      ? loadedApplications[0]!.id
                      : ""
            )
        },
        [base]
    )
    const loadPolicies = useCallback(
        async (application: string, signal?: AbortSignal) => {
            const response = await fetch(
                `${base}/website-event-policies?applicationRecordId=${encodeURIComponent(application)}`,
                { cache: "no-store", signal }
            )
            const body: unknown = await response.json().catch(() => null)
            if (!response.ok) throw Object.assign(new Error(), { body })
            const data =
                body && typeof body === "object" && "data" in body
                    ? (body as { data: unknown }).data
                    : null
            if (signal?.aborted) return
            setPolicies(websiteEventPolicyListSchema.parse(data))
        },
        [base]
    )

    useEffect(() => {
        const controller = new AbortController()
        setLoading(true)
        void loadSources(controller.signal)
            .catch(() => {
                if (!controller.signal.aborted) setFailure("error")
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false)
            })
        return () => controller.abort()
    }, [loadSources])

    useEffect(() => {
        if (!applicationId) {
            setPolicies(null)
            return
        }
        const controller = new AbortController()
        setPolicies(null)
        void loadPolicies(applicationId, controller.signal).catch(
            (error: unknown) => {
                if (!controller.signal.aborted)
                    setFailure(
                        failureFor(
                            error &&
                                typeof error === "object" &&
                                "body" in error
                                ? (error as { body: unknown }).body
                                : null
                        )
                    )
            }
        )
        return () => controller.abort()
    }, [applicationId, loadPolicies])

    async function refresh() {
        setLoading(true)
        setSaved(false)
        setFailure(null)
        try {
            await loadSources()
            if (applicationId) await loadPolicies(applicationId)
        } catch {
            setFailure("error")
        } finally {
            setLoading(false)
        }
    }

    async function save(input: WebsiteEventPolicyInput) {
        setPending(true)
        setFailure(null)
        setSaved(false)
        try {
            const response = await fetch(`${base}/website-event-policies`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(input),
            })
            const body: unknown = await response.json().catch(() => null)
            if (!response.ok) {
                setFailure(failureFor(body))
                return
            }
            await loadPolicies(input.applicationRecordId)
            setSaved(true)
        } catch {
            setFailure("error")
        } finally {
            setPending(false)
        }
    }

    const busy = loading || pending
    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                    <h3 className="text-sm">
                        {dictionary.integrationSettings.web.eventsTitle}
                    </h3>
                    <p className="text-muted-foreground text-[13px] leading-5">
                        {dictionary.integrationSettings.web.eventsHelp}
                    </p>
                    <p className="sr-only">{t.description}</p>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-lg"
                    disabled={busy}
                    onClick={refresh}
                >
                    {loading ? t.loading : t.refresh}
                </Button>
            </div>
            {failure && (
                <p role="alert" className="text-destructive text-sm">
                    {t[failure]}
                </p>
            )}
            {saved && (
                <p role="status" className="text-sm">
                    {t.saved}
                </p>
            )}
            {applications?.length === 0 && (
                <p className="rounded-lg border p-4 text-sm">
                    {t.noApplications}
                </p>
            )}
            {applications && applications.length > 1 && (
                <div className="space-y-2">
                    <Label htmlFor={selectId}>{t.application}</Label>
                    <Select
                        value={applicationId}
                        onValueChange={(value) => {
                            setSaved(false)
                            setFailure(null)
                            setApplicationId(value)
                        }}
                        disabled={busy}
                    >
                        <SelectTrigger id={selectId} className="w-full">
                            <SelectValue
                                placeholder={t.applicationPlaceholder}
                            />
                        </SelectTrigger>
                        <SelectContent>
                            {applications.map((application) => (
                                <SelectItem
                                    key={application.id}
                                    value={application.id}
                                >
                                    {application.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}
            {applicationId && keys?.length === 0 && (
                <p className="rounded-lg border p-4 text-sm">{t.noKeys}</p>
            )}
            {applicationId &&
                policies &&
                keys?.map((key) => (
                    <PolicyForm
                        key={`${applicationId}:${key.id}:${
                            policies.find(
                                (policy) => policy.apiKeyId === key.id
                            )?.version ?? "new"
                        }`}
                        applicationId={applicationId}
                        entry={key}
                        roles={discordRoles}
                        policy={
                            policies.find(
                                (policy) => policy.apiKeyId === key.id
                            ) ?? null
                        }
                        dictionary={dictionary}
                        disabled={busy}
                        save={save}
                    />
                ))}
        </div>
    )
}

function PolicyForm({
    applicationId,
    entry,
    roles: discordRoles,
    policy,
    dictionary,
    disabled,
    save,
}: {
    applicationId: string
    entry: WebsiteEventPolicyKey
    roles: DiscordSelectOption[] | null
    policy: PolicyList[number] | null
    dictionary: Dictionary
    disabled: boolean
    save(input: WebsiteEventPolicyInput): Promise<void>
}) {
    const t = dictionary.websiteEventPolicies,
        id = useId()
    const [enabled, setEnabled] = useState(policy?.enabled ?? false)
    const [roles, setRoles] = useState<Record<string, string[]>>(
        Object.fromEntries(
            entry.gameIds.map((gameId) => [
                gameId,
                policy?.games.find((game) => game.gameId === gameId)?.roleIds ??
                    [],
            ])
        )
    )
    const [invalid, setInvalid] = useState(false)
    const grantedGames =
        policy?.enabled && policy.games.some((game) => game.roleIds.length)
            ? policy.games
                  .filter((game) => game.roleIds.length)
                  .map((game) => GAME_LABELS[game.gameId])
                  .join(", ")
            : null
    return (
        <form
            className="space-y-3 border-t pt-3"
            onSubmit={async (event) => {
                event.preventDefault()
                const input = websiteEventPolicyInputSchema.safeParse({
                    applicationRecordId: applicationId,
                    apiKeyId: entry.id,
                    policy: {
                        enabled,
                        games: entry.gameIds.map((gameId) => ({
                            gameId,
                            roleIds: [...new Set(roles[gameId] ?? [])],
                        })),
                    },
                })
                setInvalid(!input.success)
                if (input.success) await save(input.data)
            }}
        >
            <p className="text-[13px] break-words">
                {entry.name}
                <span className="text-muted-foreground">
                    {" "}
                    ·{" "}
                    {grantedGames
                        ? t.granted.replace("{games}", grantedGames)
                        : t.notGranted}
                </span>
            </p>
            <fieldset disabled={disabled} className="space-y-3">
                <div className="flex items-center gap-2">
                    <Switch
                        id={`${id}-enabled`}
                        checked={enabled}
                        onCheckedChange={setEnabled}
                    />
                    <Label
                        htmlFor={`${id}-enabled`}
                        className="text-[13px] font-normal"
                    >
                        {t.enabled}
                    </Label>
                </div>
                <p className="text-muted-foreground text-[13px]">
                    {t.rolesHelp}
                </p>
                {entry.gameIds.map((gameId) => (
                    <div key={gameId} className="space-y-1.5">
                        <p
                            className="text-muted-foreground text-xs"
                            id={`${id}-${gameId}`}
                        >
                            {GAME_LABELS[gameId]}
                        </p>
                        <PolicyRolePicker
                            labelId={`${id}-${gameId}`}
                            value={roles[gameId] ?? []}
                            roles={discordRoles}
                            placeholder={
                                dictionary.integrationSettings.web
                                    .rolesPlaceholder
                            }
                            onChange={(value) =>
                                setRoles({ ...roles, [gameId]: value })
                            }
                        />
                    </div>
                ))}
                {invalid && (
                    <p role="alert" className="text-destructive text-sm">
                        {t.invalid}
                    </p>
                )}
                <Button type="submit" size="sm" className="rounded-lg">
                    {disabled ? t.saving : t.save}
                </Button>
            </fieldset>
        </form>
    )
}
