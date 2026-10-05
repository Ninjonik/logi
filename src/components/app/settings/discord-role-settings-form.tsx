"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useLocale } from "next-intl"
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { RoleAccessOverview } from "@/lib/read-models/role-access"
import { useDiscordMetadataState } from "@/hooks/use-discord-metadata"
import type { ManagerReason } from "@/domain/workspaces/role-access"
import type { Dictionary } from "@/i18n/dictionaries"
import type { DiscordConfig } from "@/types/domain"
import { pluralize } from "@/i18n/plural"
import { cn } from "@/lib/utils"

type RoleSettings = {
    clanRoleId?: string
    dashboardAdminRoleId?: string
}

const initials = (name: string) =>
    name
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => word[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()

/** "2 min ago" in the reader's language; empty for an invalid date. */
function updatedAgo(iso: string, now: Date, locale: string) {
    const seconds = Math.round((Date.parse(iso) - now.getTime()) / 1000)
    if (!Number.isFinite(seconds)) return ""
    const format = new Intl.RelativeTimeFormat(locale, {
        numeric: "auto",
        style: "short",
    })
    const abs = Math.abs(seconds)
    if (abs < 60) return format.format(0, "minute")
    if (abs < 3600) return format.format(Math.round(seconds / 60), "minute")
    if (abs < 86400) return format.format(Math.round(seconds / 3600), "hour")
    return format.format(Math.round(seconds / 86400), "day")
}

/**
 * Roles and access (design G2): the clan role every member has and the role
 * that lets people manage Logi, how many members hold each, and who can
 * manage Logi right now and why. Both roles apply to the whole clan.
 */
export function DiscordRoleSettingsForm({
    serverId,
    dictionary,
    config,
    access,
    now,
}: {
    serverId: string
    dictionary: Dictionary
    config: DiscordConfig | null
    /** Null when the stored member access could not be read. */
    access: RoleAccessOverview | null
    /** When the page was rendered, for "updated 2 min ago". */
    now: Date
}) {
    const text = dictionary.settingsHub.rolesPage
    const locale = useLocale()
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
    const counts = new Map(
        access?.roleCounts.map((role) => [role.roleId, role.count]) ?? []
    )
    const managerRole = roles.find(
        (role) => role.id === saved.dashboardAdminRoleId
    )

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

    function rolePicker(key: keyof RoleSettings, attention = false) {
        const roleId = draft[key]
        return (
            <div className="space-y-1.5">
                <div
                    className={cn(
                        "rounded-md",
                        attention &&
                            "ring-2 ring-amber-500/50 dark:ring-amber-400/40"
                    )}
                >
                    <DiscordEntitySelect
                        value={roleId}
                        onChange={(value) =>
                            setDraft((current) => ({
                                ...current,
                                [key]: value,
                            }))
                        }
                        options={roles}
                        placeholder={text.chooseRole}
                        noneLabel={text.noRole}
                        emptyLabel={text.noResults}
                    />
                </div>
                {roleId && access ? (
                    <p className="text-muted-foreground text-[13px]">
                        {pluralize(
                            locale,
                            counts.get(roleId) ?? 0,
                            text.holders
                        )}
                    </p>
                ) : null}
            </div>
        )
    }

    function reasonText(reason: ManagerReason) {
        if (reason === "administrator") return text.reasonAdministrator
        if (reason === "granted") return text.reasonGranted
        return managerRole
            ? text.reasonRole.replace("{role}", `@${managerRole.name}`)
            : text.reasonManagerRole
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
                <div className="border-t pt-4">
                    <SettingsField
                        label={text.clanRole}
                        help={text.clanRoleHelp}
                    >
                        {rolePicker("clanRoleId")}
                    </SettingsField>
                </div>
            </SettingsPanel>
            <SettingsPanel id="roles-admins" title={text.adminsTitle}>
                <div className="space-y-5 border-t pt-4">
                    <SettingsField
                        label={
                            <>
                                {text.adminRole}
                                {draft.dashboardAdminRoleId ? null : (
                                    <span className="font-normal text-amber-700 dark:text-amber-400">
                                        {" "}
                                        · {text.notSet}
                                    </span>
                                )}
                            </>
                        }
                        help={text.adminRoleHelp}
                    >
                        {rolePicker(
                            "dashboardAdminRoleId",
                            !draft.dashboardAdminRoleId
                        )}
                    </SettingsField>
                    <section
                        aria-labelledby="roles-access-now"
                        className="space-y-3 border-t pt-4"
                    >
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                            <h3
                                id="roles-access-now"
                                className="text-sm font-medium"
                            >
                                {text.accessNow}
                            </h3>
                            {access?.updatedAt ? (
                                <span className="text-muted-foreground text-[13px]">
                                    {text.updated.replace(
                                        "{time}",
                                        updatedAgo(
                                            access.updatedAt,
                                            now,
                                            locale
                                        )
                                    )}
                                </span>
                            ) : null}
                        </div>
                        {!access ? (
                            <p className="text-muted-foreground rounded-xl border border-dashed px-4 py-3 text-sm">
                                {text.accessUnavailable}
                            </p>
                        ) : access.managers.length ? (
                            <ul className="divide-y rounded-xl border">
                                {access.managers.map((manager) => {
                                    const name =
                                        manager.name ?? text.unknownMember
                                    return (
                                        <li
                                            key={manager.userId}
                                            className="flex flex-wrap items-center gap-3 px-4 py-3"
                                        >
                                            <Avatar className="size-7">
                                                {manager.avatar ? (
                                                    <AvatarImage
                                                        src={manager.avatar}
                                                        alt=""
                                                    />
                                                ) : null}
                                                <AvatarFallback className="text-[11px] font-semibold">
                                                    {initials(name)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <span className="min-w-0 flex-1 truncate text-sm">
                                                {name}
                                            </span>
                                            <span className="text-muted-foreground text-[13px]">
                                                {manager.reasons
                                                    .map(reasonText)
                                                    .join(" · ")}
                                            </span>
                                        </li>
                                    )
                                })}
                                {access.managerCount >
                                access.managers.length ? (
                                    <li className="text-muted-foreground px-4 py-3 text-[13px]">
                                        {text.moreManagers.replace(
                                            "{count}",
                                            String(
                                                access.managerCount -
                                                    access.managers.length
                                            )
                                        )}
                                    </li>
                                ) : null}
                            </ul>
                        ) : (
                            <p className="text-muted-foreground rounded-xl border border-dashed px-4 py-3 text-sm">
                                {text.noManagers}
                            </p>
                        )}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                            <ResyncDashboardAdminsButton
                                serverId={serverId}
                                dictionary={dictionary}
                                disabled={
                                    !saved.dashboardAdminRoleId || changes > 0
                                }
                            />
                            <span className="text-muted-foreground text-[13px]">
                                {saved.dashboardAdminRoleId
                                    ? text.resyncHelp
                                    : text.resyncNeedsRole}
                            </span>
                        </div>
                    </section>
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
