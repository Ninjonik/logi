"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
    clearableId,
    saveDiscordSettings,
} from "@/components/app/settings/save-discord-settings"
import { ResyncDashboardAdminsButton } from "@/components/app/resync-dashboard-admins-button"
import { DiscordEntitySelect } from "@/components/app/discord-entity-select"
import { useDiscordMetadata } from "@/hooks/use-discord-metadata"
import { Card, CardContent } from "@/components/ui/card"
import type { Dictionary } from "@/i18n/dictionaries"
import type { DiscordConfig } from "@/types/domain"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

/** The clan role and the Discord role that grants dashboard access; both apply to the whole clan. */
export function DiscordRoleSettingsForm({
    serverId,
    dictionary,
    config,
}: {
    serverId: string
    dictionary: Dictionary
    config: DiscordConfig | null
}) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const metadata = useDiscordMetadata(serverId)
    const roles = metadata?.roles ?? []
    const [clanRoleId, setClanRoleId] = useState(config?.clanRoleId)
    const [dashboardAdminRoleId, setDashboardAdminRoleId] = useState(
        config?.dashboardAdminRoleId
    )

    async function save() {
        const result = await saveDiscordSettings(serverId, {
            clanRoleId: clearableId(clanRoleId),
            dashboardAdminRoleId: clearableId(dashboardAdminRoleId),
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
            <CardContent className="space-y-6">
                <p className="text-muted-foreground text-sm">
                    {dictionary.settingsHub.clanWideOnly}
                </p>
                <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label>{dictionary.serverSettings.clanRoleId}</Label>
                        <DiscordEntitySelect
                            value={clanRoleId}
                            onChange={setClanRoleId}
                            options={roles}
                            placeholder={dictionary.serverSettings.clanRoleId}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>
                            {dictionary.serverSettings.dashboardAdminRoleId}
                        </Label>
                        <DiscordEntitySelect
                            value={dashboardAdminRoleId}
                            onChange={setDashboardAdminRoleId}
                            options={roles}
                            placeholder={
                                dictionary.serverSettings.dashboardAdminRoleId
                            }
                        />
                    </div>
                </div>
                <Button
                    className="rounded-xl"
                    onClick={save}
                    disabled={isPending}
                >
                    {dictionary.serverSettings.saveDiscordSettings}
                </Button>
                <div className="border-border/60 space-y-3 border-t pt-6">
                    <p className="text-muted-foreground text-sm">
                        {dictionary.settingsHub.resyncHelp}
                    </p>
                    <ResyncDashboardAdminsButton serverId={serverId} />
                </div>
            </CardContent>
        </Card>
    )
}
