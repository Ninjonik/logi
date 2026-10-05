"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

import {
    DEFAULT_STATS_COMMAND_SETTINGS,
    STATS_COMMAND_GAMES,
    type StatsCommandSettings,
} from "@/domain/player-stats/command-settings"
import {
    gameExceptions,
    showsGameExceptions,
    withGameExceptions,
} from "@/domain/workspaces/game-exceptions"
import type {
    DiscordConfig,
    GameDiscordOverrides,
    PlayerStatsServer,
} from "@/types/domain"
import {
    SettingsField,
    SettingsPanel,
} from "@/components/app/settings/settings-panel"
import { saveDiscordSettings } from "@/components/app/settings/save-discord-settings"
import { UnsavedChangesBar } from "@/components/app/settings/unsaved-changes-bar"
import { GameExceptionList } from "@/components/app/settings/game-exception-list"
import { DiscordChannelSelect } from "@/components/app/discord-channel-select"
import { useDiscordMetadata } from "@/hooks/use-discord-metadata"
import { GAME_LABELS, type GameId } from "@/domain/games/game"
import type { Dictionary } from "@/i18n/dictionaries"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

type ServerExceptions = Partial<Record<GameId, PlayerStatsServer[]>>

type StatsDraft = {
    settings: StatsCommandSettings
    servers: PlayerStatsServer[]
    exceptions: ServerExceptions
}

const same = (left: unknown, right: unknown) =>
    JSON.stringify(left) === JSON.stringify(right)

/** How many of the page's settings differ from what is stored. */
function countChanges(draft: StatsDraft, saved: StatsDraft) {
    return [
        draft.settings.enabled !== saved.settings.enabled,
        ...STATS_COMMAND_GAMES.map(
            (game) => draft.settings.games[game] !== saved.settings.games[game]
        ),
        (draft.settings.defaultShareChannelId ?? "") !==
            (saved.settings.defaultShareChannelId ?? ""),
        !same(draft.servers, saved.servers),
        !same(draft.exceptions, saved.exceptions),
    ].filter(Boolean).length
}

/**
 * `/stats` command (design G3): availability per game and its data source, the
 * default sharing channel, and the old stats server connections. Everything
 * applies to the whole clan; a game can read its own server list instead (an
 * exception).
 */
export function StatsCommandSettingsForm({
    serverId,
    dictionary,
    config,
    enabledGames,
    gameServersHref,
}: {
    serverId: string
    dictionary: Dictionary
    /** The clan-wide settings with the stored game overrides. */
    config: DiscordConfig | null
    enabledGames: readonly GameId[]
    gameServersHref: string
}) {
    const text = dictionary.settingsHub.statsPage
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [saving, setSaving] = useState(false)
    const metadata = useDiscordMetadata(serverId)
    const [saved, setSaved] = useState<StatsDraft>(() => ({
        settings: config?.statsSettings ?? DEFAULT_STATS_COMMAND_SETTINGS,
        servers: config?.playerStatsServers ?? [],
        exceptions: gameExceptions<GameDiscordOverrides, "playerStatsServers">(
            config?.gameOverrides,
            "playerStatsServers",
            enabledGames
        ),
    }))
    const [draft, setDraft] = useState<StatsDraft>(saved)
    const { settings: statsSettings, servers, exceptions } = draft
    const exceptionsShown = showsGameExceptions(enabledGames, [exceptions])
    const legacyCount =
        servers.length +
        Object.values(exceptions).reduce(
            (sum, list) => sum + (list?.length ?? 0),
            0
        )

    function update(patch: Partial<StatsDraft>) {
        setDraft((current) => ({ ...current, ...patch }))
    }
    function updateSettings(patch: Partial<StatsCommandSettings>) {
        setDraft((current) => ({
            ...current,
            settings: { ...current.settings, ...patch },
        }))
    }

    async function save() {
        setSaving(true)
        try {
            const result = await saveDiscordSettings(serverId, {
                statsSettings,
                playerStatsServers: servers,
                gameOverrides: withGameExceptions<
                    GameDiscordOverrides,
                    "playerStatsServers"
                >(
                    config?.gameOverrides,
                    "playerStatsServers",
                    exceptions,
                    enabledGames
                ),
            })
            if (!result.ok) {
                toast.error(
                    result.error ??
                        dictionary.serverSettings.discordSettingsSaveError
                )
                return
            }
            setSaved(draft)
            toast.success(dictionary.serverSettings.discordSettingsSaved)
            startTransition(() => router.refresh())
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="bg-card flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-4">
                <Label htmlFor="stats-command-enabled" className="text-base">
                    {text.enable}
                </Label>
                <div className="flex items-center gap-3">
                    <span className="text-muted-foreground text-sm">
                        {statsSettings.enabled ? text.on : text.off}
                    </span>
                    <Switch
                        id="stats-command-enabled"
                        checked={statsSettings.enabled}
                        onCheckedChange={(checked) =>
                            updateSettings({ enabled: checked })
                        }
                    />
                </div>
            </div>
            <SettingsPanel id="stats-games" title={text.gamesTitle}>
                <ul className="divide-y">
                    {STATS_COMMAND_GAMES.map((game) => (
                        <li
                            key={game}
                            className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                        >
                            <Switch
                                id={`stats-command-${game}`}
                                className="mt-0.5"
                                checked={statsSettings.games[game]}
                                disabled={!statsSettings.enabled}
                                onCheckedChange={(checked) =>
                                    updateSettings({
                                        games: {
                                            ...statsSettings.games,
                                            [game]: checked,
                                        },
                                    })
                                }
                            />
                            <div className="min-w-0 space-y-0.5">
                                <Label
                                    htmlFor={`stats-command-${game}`}
                                    className="font-medium"
                                >
                                    {GAME_LABELS[game]}
                                </Label>
                                <p className="text-muted-foreground text-[13px]">
                                    {game === "wardogs" ? (
                                        <>
                                            {text.wardogsSource}{" "}
                                            <Link
                                                href={gameServersHref}
                                                className="text-foreground underline underline-offset-3"
                                            >
                                                {text.gameServersLink}
                                            </Link>
                                            .
                                        </>
                                    ) : (
                                        text.hllSource
                                    )}
                                </p>
                            </div>
                        </li>
                    ))}
                </ul>
            </SettingsPanel>
            <SettingsPanel id="stats-share" title={text.shareTitle}>
                <SettingsField
                    label={text.defaultChannel}
                    help={text.defaultChannelHelp}
                >
                    <DiscordChannelSelect
                        value={statsSettings.defaultShareChannelId}
                        onChange={(value) =>
                            updateSettings({
                                defaultShareChannelId: value || undefined,
                            })
                        }
                        channels={metadata?.channels ?? []}
                        placeholder={text.defaultChannel}
                        noneLabel={text.noChannel}
                    />
                </SettingsField>
            </SettingsPanel>
            <SettingsPanel
                id="stats-legacy"
                title={text.legacyTitle.replace("{count}", String(legacyCount))}
                description={text.legacyHelp}
                actions={
                    <Button asChild variant="outline" className="rounded-xl">
                        <Link href={gameServersHref}>
                            {text.openGameServers}
                            <ArrowRight className="size-4" aria-hidden="true" />
                        </Link>
                    </Button>
                }
            >
                <StatsServerList
                    idPrefix="stats-server"
                    servers={servers}
                    onChange={(next) => update({ servers: next })}
                    dictionary={dictionary}
                />
                {exceptionsShown ? (
                    <div className="space-y-2 pt-2">
                        <h3 className="text-sm font-medium">
                            {dictionary.settingsHub.statsServersPerGame}
                        </h3>
                        <p className="text-muted-foreground text-sm">
                            {dictionary.settingsHub.statsServersPerGameHelp}
                        </p>
                        <GameExceptionList<PlayerStatsServer[]>
                            enabledGames={enabledGames}
                            exceptions={exceptions}
                            onChange={(next) => update({ exceptions: next })}
                            emptyValue={[{ token: "", url: "" }]}
                            canAdd={enabledGames.length > 1}
                            dictionary={dictionary}
                            renderValue={(game, value, setValue) => (
                                <StatsServerList
                                    idPrefix={`stats-server-${game}`}
                                    servers={value ?? []}
                                    onChange={setValue}
                                    dictionary={dictionary}
                                />
                            )}
                        />
                    </div>
                ) : null}
            </SettingsPanel>
            <UnsavedChangesBar
                changes={countChanges(draft, saved)}
                saving={saving || isPending}
                onDiscard={() => setDraft(saved)}
                onSave={() => void save()}
                dictionary={dictionary}
            />
        </div>
    )
}

/** Editable stats server rows with add and remove. */
function StatsServerList({
    idPrefix,
    servers,
    onChange,
    dictionary,
}: {
    idPrefix: string
    servers: PlayerStatsServer[]
    onChange: (servers: PlayerStatsServer[]) => void
    dictionary: Dictionary
}) {
    function updateServer(index: number, patch: Partial<PlayerStatsServer>) {
        onChange(
            servers.map((server, serverIndex) =>
                serverIndex === index ? { ...server, ...patch } : server
            )
        )
    }

    return (
        <div className="space-y-3">
            {servers.map((server, index) => (
                <div
                    key={index}
                    className="border-border/60 grid gap-3 rounded-2xl border p-4 md:grid-cols-[1fr_1fr_auto] md:items-end"
                >
                    <div className="space-y-2">
                        <Label htmlFor={`${idPrefix}-${index}-url`}>
                            {dictionary.serverSettings.playerStatsServerUrl}
                        </Label>
                        <Input
                            id={`${idPrefix}-${index}-url`}
                            value={server.url}
                            onChange={(event) =>
                                updateServer(index, { url: event.target.value })
                            }
                            placeholder={
                                dictionary.serverSettings
                                    .playerStatsServerUrlPlaceholder
                            }
                            className="rounded-xl"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={`${idPrefix}-${index}-token`}>
                            {dictionary.serverSettings.playerStatsServerToken}
                        </Label>
                        <Input
                            id={`${idPrefix}-${index}-token`}
                            type="password"
                            autoComplete="off"
                            value={server.token}
                            onChange={(event) =>
                                updateServer(index, {
                                    token: event.target.value,
                                })
                            }
                            placeholder={
                                dictionary.serverSettings
                                    .playerStatsServerTokenPlaceholder
                            }
                            className="rounded-xl"
                        />
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl"
                        onClick={() =>
                            onChange(
                                servers.filter(
                                    (_, serverIndex) => serverIndex !== index
                                )
                            )
                        }
                    >
                        {dictionary.serverSettings.removePlayerStatsServer}
                    </Button>
                </div>
            ))}
            <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => onChange([...servers, { token: "", url: "" }])}
            >
                {dictionary.serverSettings.addPlayerStatsServer}
            </Button>
        </div>
    )
}
