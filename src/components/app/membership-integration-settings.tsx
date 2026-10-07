"use client"

import {
    membershipPolicyInputSchema,
    membershipPolicySettingsSchema,
    type MembershipPolicyInput,
    type MembershipPolicySettings,
} from "@/domain/membership/policy"
import type { DiscordSelectOption } from "@/components/app/discord-entity-select"
import { PolicyRolePicker } from "@/components/app/settings/policy-role-picker"
import { useDiscordMetadata } from "@/hooks/use-discord-metadata"
import { useEffect, useState, useCallback, useId } from "react"
import type { Dictionary } from "@/i18n/dictionaries"
import { GAME_LABELS } from "@/domain/games/game"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

type Props = { serverId: string; dictionary: Dictionary }
export function MembershipIntegrationSettings(props: Props) {
    return <Settings key={props.serverId} {...props} />
}
function Settings({ serverId, dictionary }: Props) {
    const t = dictionary.membershipIntegration
    const [data, setData] = useState<MembershipPolicySettings | null>(null)
    const [loading, setLoading] = useState(true),
        [error, setError] = useState(false),
        [saved, setSaved] = useState(false)
    const [pending, setPending] = useState(false)
    const roles = useDiscordMetadata(serverId)?.roles ?? null
    const url = `/api/servers/${encodeURIComponent(serverId)}/membership-integrations`
    const load = useCallback(
        (signal?: AbortSignal) =>
            fetch(url, { cache: "no-store", signal }).then(async (response) => {
                if (!response.ok) throw new Error()
                const value = membershipPolicySettingsSchema.parse(
                    await response.json()
                )
                if (!signal?.aborted) {
                    setData(value)
                    setError(false)
                }
            }),
        [url]
    )
    useEffect(() => {
        const controller = new AbortController()
        void load(controller.signal)
            .catch(() => {
                if (!controller.signal.aborted) setError(true)
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false)
            })
        return () => controller.abort()
    }, [load])
    async function save(input: MembershipPolicyInput) {
        setPending(true)
        setError(false)
        setSaved(false)
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(input),
            })
            if (!response.ok) throw new Error()
            await load()
            setSaved(true)
        } catch {
            setError(true)
        } finally {
            setPending(false)
        }
    }
    return (
        <div className="space-y-3">
            {error && (
                <div role="alert" className="flex flex-wrap items-center gap-2">
                    <p className="text-destructive text-sm">{t.error}</p>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={loading || pending}
                        onClick={async () => {
                            setLoading(true)
                            setSaved(false)
                            try {
                                await load()
                            } catch {
                                setError(true)
                            } finally {
                                setLoading(false)
                            }
                        }}
                    >
                        {loading ? t.loading : t.refresh}
                    </Button>
                </div>
            )}
            {saved && (
                <p role="status" className="text-sm">
                    {t.saved}
                </p>
            )}
            {data?.length === 0 && (
                <div className="space-y-1 py-2">
                    <p className="text-sm">
                        {dictionary.integrationSettings.web.membersTitle}
                    </p>
                    <p className="text-muted-foreground text-[13px]">
                        {t.empty}
                    </p>
                </div>
            )}
            {data?.map((key) => (
                <PolicyForm
                    key={`${key.apiKeyId}:${key.policy?.version ?? "new"}`}
                    entry={key}
                    roles={roles}
                    dictionary={dictionary}
                    disabled={pending || loading}
                    save={save}
                />
            ))}
        </div>
    )
}

function PolicyForm({
    entry,
    roles: discordRoles,
    dictionary,
    disabled,
    save,
}: {
    entry: MembershipPolicySettings[number]
    roles: DiscordSelectOption[] | null
    dictionary: Dictionary
    disabled: boolean
    save(input: MembershipPolicyInput): Promise<void>
}) {
    const t = dictionary.membershipIntegration,
        id = useId()
    const [enabled, setEnabled] = useState(entry.policy?.enabled ?? false)
    const [roles, setRoles] = useState<Record<string, string[]>>(
        Object.fromEntries(
            entry.gameIds.map((game) => [
                game,
                entry.policy?.games.find((value) => value.gameId === game)
                    ?.roleIds ?? [],
            ])
        )
    )
    const [invalid, setInvalid] = useState(false)
    const web = dictionary.integrationSettings.web
    return (
        <form
            className="grid gap-3 py-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-6"
            onSubmit={async (event) => {
                event.preventDefault()
                const input = membershipPolicyInputSchema.safeParse({
                    apiKeyId: entry.apiKeyId,
                    enabled,
                    games: entry.gameIds.map((gameId) => ({
                        gameId,
                        roleIds: [...new Set(roles[gameId] ?? [])],
                    })),
                })
                setInvalid(!input.success)
                if (input.success) await save(input.data)
            }}
        >
            <div className="min-w-0 space-y-1">
                <h3 className="text-sm">{web.membersTitle}</h3>
                <p className="text-muted-foreground text-[13px] leading-5">
                    {web.membersRowHelp.replace("{key}", entry.name)}
                </p>
                <div className="flex items-center gap-2 pt-1">
                    <Switch
                        id={`${id}-enabled`}
                        checked={enabled}
                        disabled={disabled}
                        onCheckedChange={setEnabled}
                    />
                    <Label
                        htmlFor={`${id}-enabled`}
                        className="text-[13px] font-normal"
                    >
                        {t.enabled}
                    </Label>
                </div>
            </div>
            <fieldset disabled={disabled} className="min-w-0 space-y-3">
                {entry.gameIds.map((game) => (
                    <div key={game} className="space-y-1.5">
                        {entry.gameIds.length > 1 ? (
                            <p
                                className="text-muted-foreground text-xs"
                                id={`${id}-${game}`}
                            >
                                {GAME_LABELS[game]}
                            </p>
                        ) : (
                            <span id={`${id}-${game}`} className="sr-only">
                                {GAME_LABELS[game]} · {t.roles}
                            </span>
                        )}
                        <PolicyRolePicker
                            labelId={`${id}-${game}`}
                            value={roles[game] ?? []}
                            roles={discordRoles}
                            placeholder={web.rolesPlaceholder}
                            onChange={(value) =>
                                setRoles({ ...roles, [game]: value })
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
                    {disabled ? t.saving : web.saveRoles}
                </Button>
            </fieldset>
        </form>
    )
}
