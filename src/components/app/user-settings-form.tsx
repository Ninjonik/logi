"use client"

import type { LinkLocale } from "@/domain/identity/platform-link"
import { VerifiedPlatformLinks } from "./verified-platform-links"

import {
    AlertTriangle,
    CircleHelp,
    FileDown,
    Gamepad2,
    Mail,
} from "lucide-react"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    getDetectedPlatformHint,
    PlatformIdList,
} from "@/components/app/platform-id-display"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { UserSettingsPatch } from "@/lib/validation/user-settings"
import { LocaleSwitcher } from "@/components/app/locale-switcher"
import { AvatarPicker } from "@/components/app/avatar-picker"
import { formatPlatformIds } from "@/lib/platform-ids"
import type { Dictionary } from "@/i18n/dictionaries"
import type { AppUser, Guild } from "@/types/domain"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

function Field({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div className="mb-2 text-sm font-medium">{label}</div>
            <Input value={value} readOnly className="rounded-xl" />
        </div>
    )
}

export function UserSettingsForm({
    user,
    dictionary,
    workspaces,
    locale,
    steamCallbackFailed,
}: {
    user: AppUser
    dictionary: Dictionary
    workspaces: Guild[]
    locale: LinkLocale
    steamCallbackFailed: boolean
}) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [avatar, setAvatar] = useState(user.avatar)
    const [platformIds, setPlatformIds] = useState(
        formatPlatformIds(user.platformIds)
    )
    const [matchRecapNotificationsEnabled, setMatchRecapNotificationsEnabled] =
        useState(user.matchRecapNotificationsEnabled ?? true)
    const [defaultWorkspaceId, setDefaultWorkspaceId] = useState(
        user.defaultWorkspaceId ?? "automatic"
    )
    const [isErasureDialogOpen, setIsErasureDialogOpen] = useState(false)
    const [isRequestingErasure, setIsRequestingErasure] = useState(false)
    const [isSavingMatchRecaps, setIsSavingMatchRecaps] = useState(false)

    /** Saves only the given settings; the API keeps every omitted one. */
    async function saveSettings(patch: UserSettingsPatch) {
        const response = await fetch("/api/user/settings", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(patch),
        })
        if (response.ok) return true
        const body = await response.json().catch(() => null)
        toast.error(body?.error ?? dictionary.common.error)
        return false
    }

    async function handleSave() {
        const saved = await saveSettings({
            avatar,
            platformIds,
            defaultWorkspaceId:
                defaultWorkspaceId === "automatic" ? "" : defaultWorkspaceId,
        })
        if (!saved) return
        toast.success(dictionary.userSettings.profileSaved)
        startTransition(() => router.refresh())
    }

    async function handleMatchRecapsChange(enabled: boolean) {
        setMatchRecapNotificationsEnabled(enabled)
        setIsSavingMatchRecaps(true)
        try {
            if (
                await saveSettings({ matchRecapNotificationsEnabled: enabled })
            ) {
                toast.success(dictionary.userSettings.matchRecapsSaved)
                return
            }
            setMatchRecapNotificationsEnabled(!enabled)
        } finally {
            setIsSavingMatchRecaps(false)
        }
    }

    async function confirmErasure() {
        setIsRequestingErasure(true)
        try {
            await requestPrivacy("erasure")
        } finally {
            setIsRequestingErasure(false)
            setIsErasureDialogOpen(false)
        }
    }

    async function requestPrivacy(type: "export" | "erasure") {
        if (type === "export") {
            const response = await fetch("/api/user/privacy-export", {
                method: "POST",
            })
            if (!response.ok) {
                const body = await response.json().catch(() => null)
                toast.error(body?.error ?? dictionary.common.error)
                return
            }
            const url = URL.createObjectURL(await response.blob())
            const link = document.createElement("a")
            link.href = url
            link.download = "logi-personal-data.zip"
            link.click()
            URL.revokeObjectURL(url)
            return
        }
        const response = await fetch("/api/user/privacy-request", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ type }),
        })
        if (!response.ok) {
            const body = await response.json().catch(() => null)
            toast.error(body?.error ?? dictionary.common.error)
            return
        }
        toast.success(dictionary.userSettings.requestSubmitted)
    }

    return (
        <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
            <Card className="border-border/60 rounded-2xl">
                <CardHeader>
                    <CardTitle>{dictionary.userSettings.profile}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                    <div className="md:col-span-2">
                        <AvatarPicker
                            value={avatar}
                            onChange={setAvatar}
                            fallback={user.name.slice(0, 2)}
                            label={dictionary.userSettings.avatar}
                            buttonLabel={dictionary.common.upload}
                            disabled={isPending}
                        />
                    </div>
                    <Field
                        label={dictionary.userSettings.discordName}
                        value={user.name}
                    />
                    <Field
                        label={dictionary.userSettings.discordId}
                        value={user.discordId}
                    />
                    <div>
                        <div className="mb-2 text-sm font-medium">
                            {dictionary.userSettings.preferredLanguage}
                        </div>
                        <LocaleSwitcher
                            locale={locale}
                            dictionary={dictionary}
                        />
                        <p className="text-muted-foreground mt-2 text-sm">
                            {dictionary.userSettings.preferredLanguageHelp}
                        </p>
                    </div>
                    <Field
                        label={dictionary.userSettings.streamerMode}
                        value={
                            user.isStreamer
                                ? dictionary.userSettings.enabled
                                : dictionary.userSettings.disabled
                        }
                    />
                    <div className="space-y-2 md:col-span-2">
                        <div className="flex items-center gap-2">
                            <div className="text-sm font-medium">
                                {dictionary.userSettings.platformId}
                            </div>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        className="text-muted-foreground"
                                    >
                                        <CircleHelp className="size-4" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-sm space-y-2">
                                    <p>
                                        {dictionary.userSettings.platformIdHelp}
                                    </p>
                                    <div className="space-y-1 text-xs">
                                        <p>
                                            <a
                                                href="https://help.steampowered.com/en/faqs/view/2816-BE67-5B69-0FEC"
                                                target="_blank"
                                                rel="noreferrer"
                                                className="underline"
                                            >
                                                {
                                                    dictionary.userSettings
                                                        .platformIdSteamLink
                                                }
                                            </a>{" "}
                                            {
                                                dictionary.userSettings
                                                    .platformIdSteamHint
                                            }
                                        </p>
                                        <p>
                                            <a
                                                href="https://www.epicgames.com/help/c-202300000001645/c-Trending_0/what-is-an-epic-games-account-id-and-where-can-i-find-it-a202300000011535"
                                                target="_blank"
                                                rel="noreferrer"
                                                className="underline"
                                            >
                                                {
                                                    dictionary.userSettings
                                                        .platformIdEpicLink
                                                }
                                            </a>{" "}
                                            {
                                                dictionary.userSettings
                                                    .platformIdEpicHint
                                            }
                                        </p>
                                    </div>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                        <Input
                            value={platformIds}
                            onChange={(event) =>
                                setPlatformIds(event.target.value)
                            }
                            placeholder={
                                dictionary.userSettings.platformIdPlaceholder
                            }
                            className="rounded-xl"
                        />
                        {platformIds.trim() ? (
                            <p className="text-muted-foreground text-sm">
                                {getDetectedPlatformHint(
                                    platformIds,
                                    dictionary
                                )}
                            </p>
                        ) : null}
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <div className="text-sm font-medium">
                            {dictionary.userSettings.defaultWorkspace}
                        </div>
                        <Select
                            value={defaultWorkspaceId}
                            onValueChange={setDefaultWorkspaceId}
                            disabled={isPending}
                        >
                            <SelectTrigger className="w-full rounded-xl">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="automatic">
                                    {
                                        dictionary.userSettings
                                            .defaultWorkspaceAutomatic
                                    }
                                </SelectItem>
                                {workspaces.map((workspace) => (
                                    <SelectItem
                                        key={workspace.id}
                                        value={workspace.discordId}
                                    >
                                        {workspace.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-muted-foreground text-sm">
                            {dictionary.userSettings.defaultWorkspaceHelp}
                        </p>
                    </div>
                    <div className="md:col-span-2">
                        <Button
                            className="rounded-xl"
                            onClick={handleSave}
                            disabled={isPending}
                        >
                            {dictionary.common.save}
                        </Button>
                    </div>
                </CardContent>
            </Card>
            <div className="space-y-6">
                <VerifiedPlatformLinks
                    dictionary={dictionary}
                    locale={locale}
                    initialCallbackFailed={steamCallbackFailed}
                />
                <Card className="border-border/60 rounded-2xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Mail className="size-4" />
                            {dictionary.userSettings.matchRecapsTitle}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between gap-4">
                        <div>
                            <p className="font-medium">
                                {dictionary.userSettings.matchRecapsEnabled}
                            </p>
                            <p className="text-muted-foreground text-sm">
                                {dictionary.userSettings.matchRecapsDescription}
                            </p>
                        </div>
                        <Switch
                            checked={matchRecapNotificationsEnabled}
                            onCheckedChange={handleMatchRecapsChange}
                            disabled={isPending || isSavingMatchRecaps}
                            aria-label={
                                dictionary.userSettings.matchRecapsEnabled
                            }
                        />
                    </CardContent>
                </Card>
                <Card className="border-border/60 rounded-2xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Gamepad2 className="size-4" />
                            {dictionary.userSettings.platformConnection}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Badge
                            variant={
                                user.platformIds.length
                                    ? "default"
                                    : "secondary"
                            }
                            className="rounded-full px-3"
                        >
                            {user.platformIds.length
                                ? dictionary.userSettings.platformConnected
                                : dictionary.userSettings.platformDisconnected}
                        </Badge>
                        <div className="border-border/60 rounded-2xl border p-4">
                            <div className="text-muted-foreground text-sm">
                                {dictionary.userSettings.currentPlatformId}
                            </div>
                            <div className="mt-3">
                                <PlatformIdList
                                    platformIds={user.platformIds}
                                    dictionary={dictionary}
                                    showProfileLinks
                                    emptyLabel={dictionary.shared.notSet}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-border/60 rounded-2xl">
                    <CardHeader>
                        <CardTitle>
                            {dictionary.userSettings.privacyTitle}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-muted-foreground text-sm leading-6">
                            {dictionary.userSettings.privacyDescription}
                        </p>
                        <Button
                            variant="outline"
                            className="w-full justify-start rounded-xl"
                            disabled={isPending}
                            onClick={() => requestPrivacy("export")}
                        >
                            <FileDown className="size-4" />
                            {dictionary.userSettings.requestExport}
                        </Button>
                        <div className="border-destructive/25 bg-destructive/5 text-destructive rounded-xl border p-3 text-sm">
                            <div className="flex gap-2">
                                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                                <p>{dictionary.userSettings.erasureWarning}</p>
                            </div>
                        </div>
                        <Button
                            variant="destructive"
                            className="w-full rounded-xl"
                            disabled={isPending}
                            onClick={() => setIsErasureDialogOpen(true)}
                        >
                            {dictionary.userSettings.requestErasure}
                        </Button>
                        <Dialog
                            open={isErasureDialogOpen}
                            onOpenChange={(open) =>
                                !isRequestingErasure &&
                                setIsErasureDialogOpen(open)
                            }
                        >
                            <DialogContent className="rounded-2xl">
                                <DialogHeader>
                                    <DialogTitle>
                                        {
                                            dictionary.userSettings
                                                .erasureConfirmTitle
                                        }
                                    </DialogTitle>
                                    <DialogDescription>
                                        {
                                            dictionary.userSettings
                                                .erasureConfirmDescription
                                        }
                                    </DialogDescription>
                                </DialogHeader>
                                <DialogFooter>
                                    <Button
                                        variant="outline"
                                        className="rounded-xl"
                                        disabled={isRequestingErasure}
                                        onClick={() =>
                                            setIsErasureDialogOpen(false)
                                        }
                                    >
                                        {dictionary.common.cancel}
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        className="rounded-xl"
                                        disabled={isRequestingErasure}
                                        onClick={confirmErasure}
                                    >
                                        {dictionary.userSettings.erasureConfirm}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
