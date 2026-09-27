"use client"

import { useState } from "react"
import { toast } from "sonner"

import { ResyncDashboardAdminsButton } from "@/components/app/resync-dashboard-admins-button"
import type { Dictionary } from "@/i18n/dictionaries"
import type { DiscordConfig } from "@/types/domain"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

export function DiscordOperationsSettings({
    serverId,
    userId,
    config,
    dictionary,
}: {
    serverId: string
    userId: string
    config: DiscordConfig | null
    dictionary: Dictionary
}) {
    const [dashboardAdminRoleId, setDashboardAdminRoleId] = useState(
        config?.dashboardAdminRoleId ?? ""
    )
    const [playerStatsServers, setPlayerStatsServers] = useState(
        config?.playerStatsServers ?? []
    )
    async function save() {
        if (!config) return toast.error(dictionary.common.error)
        const response = await fetch(
            `/api/servers/${serverId}/discord-settings`,
            {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    ...config,
                    dashboardAdminRoleId,
                    playerStatsServers,
                }),
            }
        )
        if (!response.ok)
            return toast.error(
                dictionary.serverSettings.discordSettingsSaveError
            )
        toast.success(dictionary.serverSettings.discordSettingsSaved)
    }
    return (
        <div className="space-y-5">
            <div className="space-y-2">
                <Label>{dictionary.serverSettings.dashboardAdminRoleId}</Label>
                <Input
                    value={dashboardAdminRoleId}
                    onChange={(event) =>
                        setDashboardAdminRoleId(event.target.value)
                    }
                />
                <ResyncDashboardAdminsButton
                    serverId={serverId}
                    userId={userId}
                />
            </div>
            <div className="space-y-3">
                <div>
                    <p className="font-medium">
                        {dictionary.serverSettings.playerStatsServersTitle}
                    </p>
                    <p className="text-muted-foreground text-sm">
                        {
                            dictionary.serverSettings
                                .playerStatsServersDescription
                        }
                    </p>
                </div>
                {playerStatsServers.map((server, index) => (
                    <div key={index} className="grid gap-2 md:grid-cols-2">
                        <Input
                            placeholder={
                                dictionary.serverSettings
                                    .playerStatsServerTokenPlaceholder
                            }
                            value={server.token}
                            onChange={(event) =>
                                setPlayerStatsServers((current) =>
                                    current.map((item, itemIndex) =>
                                        itemIndex === index
                                            ? {
                                                  ...item,
                                                  token: event.target.value,
                                              }
                                            : item
                                    )
                                )
                            }
                        />
                        <Input
                            placeholder={
                                dictionary.serverSettings
                                    .playerStatsServerUrlPlaceholder
                            }
                            value={server.url}
                            onChange={(event) =>
                                setPlayerStatsServers((current) =>
                                    current.map((item, itemIndex) =>
                                        itemIndex === index
                                            ? {
                                                  ...item,
                                                  url: event.target.value,
                                              }
                                            : item
                                    )
                                )
                            }
                        />
                    </div>
                ))}
                <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                        setPlayerStatsServers((current) => [
                            ...current,
                            { token: "", url: "" },
                        ])
                    }
                >
                    {dictionary.serverSettings.addPlayerStatsServer}
                </Button>
            </div>
            <Button onClick={() => void save()}>
                {dictionary.common.save}
            </Button>
        </div>
    )
}
