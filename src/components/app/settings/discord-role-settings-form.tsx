"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
    clearableId,
    saveDiscordSettings,
} from "@/components/app/settings/save-discord-settings"
import {
    SettingsField,
    SettingsPanel,
} from "@/components/app/settings/settings-panel"
import { ResyncDashboardAdminsButton } from "@/components/app/resync-dashboard-admins-button"
import { UnsavedChangesBar } from "@/components/app/settings/unsaved-changes-bar"
import { DiscordEntitySelect } from "@/components/app/discord-entity-select"
import { useDiscordMetadataState } from "@/hooks/use-discord-metadata"
import type { Dictionary } from "@/i18n/dictionaries"
import type { DiscordConfig } from "@/types/domain"

type RoleSettings = {
    clanRoleId?: string
    dashboardAdminRoleId?: string
}

/**
 * Roles and access (design G2): the clan role every member has and the role
 * that lets people manage Logi. Both apply to the whole clan.
 */
export function DiscordRoleSettingsForm({
    serverId,
    dictionary,
    config,
}: {
    serverId: string
    dictionary: Dictionary
    config: DiscordConfig | null
}) {
    const text = dictionary.settingsHub.rolesPage
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [saving, setSaving] = useState(false)
    const metadata = useDiscordMetadataState(serverId)
    const roles = metadata.metadata?.roles ?? []
    const [saved, setSaved] = useState<RoleSettings>({
        clanRoleId: config?.clanRoleId,
        dashboardAdminRoleId: config?.dashboardAdminRoleId,
    })
    const [draft, setDraft] = useState<RoleSettings>(saved)
    const changes = (["clanRoleId", "dashboardAdminRoleId"] as const).filter(
        (key) => (draft[key] || undefined) !== (saved[key] || undefined)
    ).length

    async function save() {
        setSaving(true)
        try {
            const result = await saveDiscordSettings(serverId, {
                clanRoleId: clearableId(draft.clanRoleId),
                dashboardAdminRoleId: clearableId(draft.dashboardAdminRoleId),
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

    function rolePicker(key: keyof RoleSettings) {
        return (
            <DiscordEntitySelect
                value={draft[key]}
                onChange={(value) =>
                    setDraft((current) => ({ ...current, [key]: value }))
                }
                options={roles}
                placeholder={text.chooseRole}
                noneLabel={text.noRole}
                emptyLabel={text.noResults}
            />
        )
    }

    return (
        <div className="space-y-6">
            {metadata.status === "failed" ? (
                <p
                    role="alert"
                    className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100"
                >
                    {text.rolesUnavailable}
                </p>
            ) : null}
            <SettingsPanel id="roles-members" title={text.membersTitle}>
                <SettingsField label={text.clanRole} help={text.clanRoleHelp}>
                    {rolePicker("clanRoleId")}
                </SettingsField>
            </SettingsPanel>
            <SettingsPanel id="roles-admins" title={text.adminsTitle}>
                <SettingsField
                    label={
                        <>
                            {text.adminRole}
                            {draft.dashboardAdminRoleId ? null : (
                                <span className="text-muted-foreground font-normal">
                                    {" "}
                                    · {text.notSet}
                                </span>
                            )}
                        </>
                    }
                    help={text.adminRoleHelp}
                >
                    {rolePicker("dashboardAdminRoleId")}
                </SettingsField>
                <div className="bg-muted/40 space-y-3 rounded-xl border p-4">
                    <div className="space-y-1">
                        <h3 className="text-sm font-medium">
                            {text.resyncTitle}
                        </h3>
                        <p className="text-muted-foreground text-[13px]">
                            {saved.dashboardAdminRoleId
                                ? text.resyncHelp
                                : text.resyncNeedsRole}
                        </p>
                    </div>
                    <ResyncDashboardAdminsButton
                        serverId={serverId}
                        dictionary={dictionary}
                        disabled={!saved.dashboardAdminRoleId || changes > 0}
                    />
                </div>
            </SettingsPanel>
            <UnsavedChangesBar
                changes={changes}
                saving={saving || isPending}
                onDiscard={() => setDraft(saved)}
                onSave={() => void save()}
                dictionary={dictionary}
            />
        </div>
    )
}
