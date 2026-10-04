"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
    DEFAULT_STATS_COMMAND_SETTINGS,
    STATS_COMMAND_GAMES,
    type StatsCommandSettings,
} from "@/domain/player-stats/command-settings"
import { saveDiscordSettings } from "@/components/app/settings/save-discord-settings"
import { DiscordChannelSelect } from "@/components/app/discord-channel-select"
import type { DiscordConfig, PlayerStatsServer } from "@/types/domain"
import { useDiscordMetadata } from "@/hooks/use-discord-metadata"
import { GAME_LABELS, type GameId } from "@/domain/games/game"
import { Card, CardContent } from "@/components/ui/card"
import type { Dictionary } from "@/i18n/dictionaries"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

/**
 * `/stats` availability and the stats servers it reads. The command switches
 * apply to the whole clan; with a game selected, the server list is that game's.
 */
export function StatsCommandSettingsForm({
    serverId,
    dictionary,
    config,
    baseConfig,
    gameId,
}: {
    serverId: string
    dictionary: Dictionary
    config: DiscordConfig | null
    baseConfig: DiscordConfig | null
    gameId?: GameId
}) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const metadata = useDiscordMetadata(serverId)
    const [statsSettings, setStatsSettings] = useState<StatsCommandSettings>(
        baseConfig?.statsSettings ?? DEFAULT_STATS_COMMAND_SETTINGS
    )
    const [servers, setServers] = useState<PlayerStatsServer[]>(
        config?.playerStatsServers ?? []
    )

    function updateServer(index: number, patch: Partial<PlayerStatsServer>) {
        setServers((current) =>
            current.map((server, serverIndex) =>
                serverIndex === index ? { ...server, ...patch } : server
            )
        )
    }

    async function save() {
        const result = await saveDiscordSettings(serverId, {
            statsSettings,
            ...(gameId && baseConfig
                ? {
                      gameOverrides: {
                          ...baseConfig.gameOverrides,
                          [gameId]: {
                              ...baseConfig.gameOverrides?.[gameId],
                              playerStatsServers: servers,
                          },
                      },
                  }
                : { playerStatsServers: servers }),
        })
        if (!result.ok) {
            toast.error(
                result.error ??
                    dictionary.serverSettings.discordSettingsSaveError
            )
            return
        }
        toast.success(dictionary.serverSettings.discordSettingsSaved)
        startTransition(() => router.refresh())
    }

    return (
        <Card className="border-border/60 rounded-2xl">
            <CardContent className="space-y-8">
                <section className="space-y-4">
                    <div className="space-y-1">
                        <h3 className="font-medium">
                            {dictionary.serverSettings.statsCommandTitle}
                        </h3>
                        <p className="text-muted-foreground text-sm">
                            {dictionary.serverSettings.statsCommandDescription}
                        </p>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <Label htmlFor="stats-command-enabled">
                            {dictionary.serverSettings.statsCommandEnabled}
                        </Label>
                        <Switch
                            id="stats-command-enabled"
                            checked={statsSettings.enabled}
                            onCheckedChange={(checked) =>
                                setStatsSettings((current) => ({
                                    ...current,
                                    enabled: checked,
                                }))
                            }
                        />
                    </div>
                    {STATS_COMMAND_GAMES.map((game) => (
                        <div
                            key={game}
                            className="flex items-center justify-between gap-4"
                        >
                            <Label htmlFor={`stats-command-${game}`}>
                                {dictionary.serverSettings.statsCommandGame.replace(
                                    "{game}",
                                    GAME_LABELS[game]
                                )}
                            </Label>
                            <Switch
                                id={`stats-command-${game}`}
                                checked={statsSettings.games[game]}
                                disabled={!statsSettings.enabled}
                                onCheckedChange={(checked) =>
                                    setStatsSettings((current) => ({
                                        ...current,
                                        games: {
                                            ...current.games,
                                            [game]: checked,
                                        },
                                    }))
                                }
                            />
                        </div>
                    ))}
                    <div className="space-y-2">
                        <Label>
                            {
                                dictionary.serverSettings
                                    .statsCommandDefaultChannel
                            }
                        </Label>
                        <DiscordChannelSelect
                            value={statsSettings.defaultShareChannelId}
                            onChange={(value) =>
                                setStatsSettings((current) => ({
                                    ...current,
                                    defaultShareChannelId: value || undefined,
                                }))
                            }
                            channels={metadata?.channels ?? []}
                            placeholder={
                                dictionary.serverSettings
                                    .statsCommandDefaultChannel
                            }
                        />
                        <p className="text-muted-foreground text-sm">
                            {
                                dictionary.serverSettings
                                    .statsCommandDefaultChannelHelp
                            }
                        </p>
                    </div>
                </section>
                <section className="border-border/60 space-y-4 border-t pt-6">
                    <div className="space-y-1">
                        <h3 className="font-medium">
                            {dictionary.serverSettings.playerStatsServersTitle}
                        </h3>
                        <p className="text-muted-foreground text-sm">
                            {
                                dictionary.serverSettings
                                    .playerStatsServersDescription
                            }
                        </p>
                    </div>
                    {servers.map((server, index) => (
                        <div
                            key={index}
                            className="border-border/60 grid gap-3 rounded-2xl border p-4 md:grid-cols-[1fr_1fr_auto] md:items-end"
                        >
                            <div className="space-y-2">
                                <Label htmlFor={`stats-server-${index}-url`}>
                                    {
                                        dictionary.serverSettings
                                            .playerStatsServerUrl
                                    }
                                </Label>
                                <Input
                                    id={`stats-server-${index}-url`}
                                    value={server.url}
                                    onChange={(event) =>
                                        updateServer(index, {
                                            url: event.target.value,
                                        })
                                    }
                                    placeholder={
                                        dictionary.serverSettings
                                            .playerStatsServerUrlPlaceholder
                                    }
                                    className="rounded-xl"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor={`stats-server-${index}-token`}>
                                    {
                                        dictionary.serverSettings
                                            .playerStatsServerToken
                                    }
                                </Label>
                                <Input
                                    id={`stats-server-${index}-token`}
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
                                    setServers((current) =>
                                        current.filter(
                                            (_, serverIndex) =>
                                                serverIndex !== index
                                        )
                                    )
                                }
                            >
                                {
                                    dictionary.serverSettings
                                        .removePlayerStatsServer
                                }
                            </Button>
                        </div>
                    ))}
                    <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl"
                        onClick={() =>
                            setServers((current) => [
                                ...current,
                                { token: "", url: "" },
                            ])
                        }
                    >
                        {dictionary.serverSettings.addPlayerStatsServer}
                    </Button>
                </section>
                <Button
                    className="rounded-xl"
                    onClick={save}
                    disabled={isPending}
                >
                    {dictionary.serverSettings.saveDiscordSettings}
                </Button>
            </CardContent>
        </Card>
    )
}
