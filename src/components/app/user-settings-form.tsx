"use client"

import {
    useEffect,
    useId,
    useRef,
    useState,
    useTransition,
    type ReactNode,
} from "react"
import { Camera, CircleHelp, Loader2, LogOut } from "lucide-react"
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
import { erasureConfirmationMatches } from "@/domain/identity/account-erasure"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { UserSettingsPatch } from "@/lib/validation/user-settings"
import { themeOptionsFor, type ThemeOption } from "./theme-switcher"
import { LocaleSwitcher } from "@/components/app/locale-switcher"
import type { LinkLocale } from "@/domain/identity/platform-link"
import { VerifiedPlatformLinks } from "./verified-platform-links"
import { FieldError } from "@/components/app/field-error"
import { uploadFileToConvex } from "@/lib/client-uploads"
import { formatPlatformIds } from "@/lib/platform-ids"
import type { Dictionary } from "@/i18n/dictionaries"
import type { AppUser, Guild } from "@/types/domain"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useTheme } from "@/hooks/use-theme"

const AUTOMATIC = "automatic"

function Section({
    title,
    children,
    className,
}: {
    title: string
    children: ReactNode
    className?: string
}) {
    const headingId = useId()
    return (
        <section
            aria-labelledby={headingId}
            className={`bg-card rounded-2xl border px-4 py-2 sm:px-6 ${className ?? ""}`}
        >
            <h2 id={headingId} className="mt-3.5 mb-1 text-base font-semibold">
                {title}
            </h2>
            {children}
        </section>
    )
}

/** A label on the left and its control on the right; stacks on phones. */
function SettingRow({
    label,
    labelFor,
    labelId,
    children,
}: {
    label: string
    labelFor?: string
    labelId?: string
    children: ReactNode
}) {
    return (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t py-3.5">
            {labelFor ? (
                <label
                    htmlFor={labelFor}
                    className="flex-[1_1_200px] text-sm font-medium"
                >
                    {label}
                </label>
            ) : (
                <span
                    id={labelId}
                    className="flex-[1_1_200px] text-sm font-medium"
                >
                    {label}
                </span>
            )}
            <div className="flex min-w-0 flex-[2_1_240px]">{children}</div>
        </div>
    )
}

/**
 * "My account" (design K1). Every change saves on its own through
 * `POST /api/user/settings` with only the changed field; nothing waits for a
 * save button.
 */
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
    const t = dictionary.userSettings
    const router = useRouter()
    const { theme, setTheme } = useTheme()
    // The stored theme is only known in the browser; avoid a hydration mismatch.
    const [mounted, setMounted] = useState(false)
    useEffect(() => setMounted(true), [])
    const [, startTransition] = useTransition()
    const ids = {
        language: useId(),
        theme: useId(),
        startClan: useId(),
        erasure: useId(),
        platformIds: useId(),
    }
    const avatarInput = useRef<HTMLInputElement>(null)
    const [avatar, setAvatar] = useState(user.avatar)
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
    const [startClan, setStartClan] = useState(
        user.defaultWorkspaceId ?? AUTOMATIC
    )
    const [isSavingStartClan, setIsSavingStartClan] = useState(false)
    const [matchRecapNotificationsEnabled, setMatchRecapNotificationsEnabled] =
        useState(user.matchRecapNotificationsEnabled ?? true)
    const [isSavingMatchRecaps, setIsSavingMatchRecaps] = useState(false)
    const [platformIdsOpen, setPlatformIdsOpen] = useState(false)
    const [platformIds, setPlatformIds] = useState(
        formatPlatformIds(user.platformIds)
    )
    const [isSavingPlatformIds, setIsSavingPlatformIds] = useState(false)
    const [platformIdsError, setPlatformIdsError] = useState<string | null>(
        null
    )
    const [isExporting, setIsExporting] = useState(false)
    const [erasureName, setErasureName] = useState("")
    const [isRequestingErasure, setIsRequestingErasure] = useState(false)

    /** Saves only the given settings; the API keeps every omitted one. */
    async function sendSettings(
        patch: UserSettingsPatch
    ): Promise<{ ok: true } | { ok: false; error: string }> {
        try {
            const response = await fetch("/api/user/settings", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(patch),
            })
            if (response.ok) return { ok: true }
            const body = await response.json().catch(() => null)
            return { ok: false, error: body?.error ?? dictionary.common.error }
        } catch {
            return { ok: false, error: dictionary.common.error }
        }
    }

    /** Saves and reports a failure as a toast; returns whether it saved. */
    async function saveSettings(patch: UserSettingsPatch) {
        const result = await sendSettings(patch)
        if (!result.ok) toast.error(result.error)
        return result.ok
    }

    function refresh() {
        startTransition(() => router.refresh())
    }

    async function changeAvatar(files: FileList | null) {
        const file = files?.[0]
        if (!file) return
        setIsUploadingAvatar(true)
        try {
            const { url } = await uploadFileToConvex(file)
            if (await saveSettings({ avatar: url })) {
                setAvatar(url)
                toast.success(t.avatarSaved)
                refresh()
            }
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : dictionary.common.error
            )
        } finally {
            setIsUploadingAvatar(false)
            if (avatarInput.current) avatarInput.current.value = ""
        }
    }

    async function changeStartClan(value: string) {
        const previous = startClan
        setStartClan(value)
        setIsSavingStartClan(true)
        try {
            if (
                await saveSettings({
                    defaultWorkspaceId: value === AUTOMATIC ? "" : value,
                })
            ) {
                toast.success(t.startClanSaved)
                refresh()
                return
            }
            setStartClan(previous)
        } finally {
            setIsSavingStartClan(false)
        }
    }

    async function changeMatchRecaps(enabled: boolean) {
        setMatchRecapNotificationsEnabled(enabled)
        setIsSavingMatchRecaps(true)
        try {
            if (
                await saveSettings({ matchRecapNotificationsEnabled: enabled })
            ) {
                toast.success(t.matchRecapsSaved)
                return
            }
            setMatchRecapNotificationsEnabled(!enabled)
        } finally {
            setIsSavingMatchRecaps(false)
        }
    }

    async function savePlatformIds() {
        setIsSavingPlatformIds(true)
        setPlatformIdsError(null)
        try {
            const result = await sendSettings({ platformIds })
            if (!result.ok) {
                // Shown at the field, where it can be fixed (design K4).
                setPlatformIdsError(result.error)
                return
            }
            toast.success(t.platformIdsSaved)
            setPlatformIdsOpen(false)
            refresh()
        } finally {
            setIsSavingPlatformIds(false)
        }
    }

    async function downloadData() {
        setIsExporting(true)
        try {
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
        } catch {
            toast.error(dictionary.common.error)
        } finally {
            setIsExporting(false)
        }
    }

    async function requestErasure() {
        if (!erasureConfirmationMatches(erasureName, user.name)) return
        setIsRequestingErasure(true)
        try {
            const response = await fetch("/api/user/privacy-request", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ type: "erasure" }),
            })
            if (!response.ok) {
                const body = await response.json().catch(() => null)
                toast.error(body?.error ?? dictionary.common.error)
                return
            }
            setErasureName("")
            toast.success(t.deleteAccountRequested)
        } catch {
            toast.error(dictionary.common.error)
        } finally {
            setIsRequestingErasure(false)
        }
    }

    const erasureConfirmed = erasureConfirmationMatches(erasureName, user.name)

    return (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
            <header className="flex flex-wrap items-center gap-4">
                <div className="relative flex-none">
                    <Avatar className="size-14 rounded-full">
                        <AvatarImage src={avatar} alt="" />
                        <AvatarFallback className="rounded-full text-base font-semibold">
                            {user.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={t.changeAvatar}
                        title={t.changeAvatar}
                        disabled={isUploadingAvatar}
                        onClick={() => avatarInput.current?.click()}
                        className="bg-background absolute -right-1.5 -bottom-1.5 size-7 rounded-full"
                    >
                        {isUploadingAvatar ? (
                            <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                            <Camera className="size-3.5" />
                        )}
                    </Button>
                    <input
                        ref={avatarInput}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) =>
                            void changeAvatar(event.target.files)
                        }
                    />
                </div>
                <div className="flex min-w-48 flex-1 flex-col gap-0.5">
                    <h1 className="text-2xl font-semibold tracking-tight">
                        {t.accountTitle}
                    </h1>
                    <span className="text-muted-foreground truncate text-sm">
                        {t.signedInWith.replace("{name}", user.name)}
                    </span>
                </div>
                <form action="/api/auth/logout" method="post">
                    <Button
                        type="submit"
                        variant="outline"
                        size="sm"
                        className="rounded-lg"
                    >
                        <LogOut className="size-4" />
                        {dictionary.common.logout}
                    </Button>
                </form>
            </header>
            <p className="text-muted-foreground text-sm">{t.autoSaveNote}</p>

            <Section title={t.lookTitle}>
                <SettingRow label={t.appLanguage} labelFor={ids.language}>
                    <LocaleSwitcher
                        id={ids.language}
                        locale={locale}
                        dictionary={dictionary}
                        className="w-full justify-start font-normal"
                    />
                </SettingRow>
                <SettingRow label={t.theme} labelId={ids.theme}>
                    <ToggleGroup
                        type="single"
                        aria-labelledby={ids.theme}
                        value={mounted ? theme : undefined}
                        onValueChange={(value) => {
                            if (value) setTheme(value as ThemeOption)
                        }}
                        className="bg-muted w-full gap-0.5 rounded-lg p-[3px]"
                    >
                        {themeOptionsFor(dictionary).map((option) => (
                            <ToggleGroupItem
                                key={option.value}
                                value={option.value}
                                className="text-muted-foreground data-[state=on]:bg-background data-[state=on]:text-foreground h-[30px] rounded-md! text-[13px] font-medium data-[state=on]:font-semibold data-[state=on]:shadow-sm"
                            >
                                {option.label}
                            </ToggleGroupItem>
                        ))}
                    </ToggleGroup>
                </SettingRow>
                <SettingRow label={t.startClan} labelFor={ids.startClan}>
                    <Select
                        value={startClan}
                        onValueChange={(value) => void changeStartClan(value)}
                        disabled={isSavingStartClan}
                    >
                        <SelectTrigger
                            id={ids.startClan}
                            className="w-full rounded-lg"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={AUTOMATIC}>
                                {t.startClanAutomatic}
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
                </SettingRow>
            </Section>

            <Section title={t.gameAccountsTitle}>
                <VerifiedPlatformLinks
                    dictionary={dictionary}
                    locale={locale}
                    initialCallbackFailed={steamCallbackFailed}
                />
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 border-t py-3.5">
                    <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
                        <span className="text-sm font-medium">
                            {t.manualIdsTitle}
                        </span>
                        <span className="text-muted-foreground text-sm">
                            {user.platformIds.length
                                ? t.manualIdsUnverified
                                : t.manualIdsEmpty}
                        </span>
                        {user.platformIds.length ? (
                            // Long IDs shorten instead of widening the card on phones.
                            <div className="mt-1.5 min-w-0 [&_.truncate]:min-w-0 [&_[data-slot=badge]]:max-w-full [&_[data-slot=badge]]:shrink">
                                <PlatformIdList
                                    platformIds={user.platformIds}
                                    dictionary={dictionary}
                                    showProfileLinks
                                    emptyLabel={dictionary.shared.notSet}
                                />
                            </div>
                        ) : null}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg"
                        onClick={() => {
                            setPlatformIds(formatPlatformIds(user.platformIds))
                            setPlatformIdsError(null)
                            setPlatformIdsOpen(true)
                        }}
                    >
                        {user.platformIds.length ? t.editIds : t.addId}
                    </Button>
                </div>
            </Section>

            <Section title={t.botDmTitle}>
                <div className="flex items-center gap-3 border-t py-3.5">
                    <div className="flex flex-1 flex-col">
                        <span className="text-sm">{t.recapTitle}</span>
                        <span className="text-muted-foreground text-sm">
                            {t.recapDescription}
                        </span>
                    </div>
                    <Switch
                        checked={matchRecapNotificationsEnabled}
                        onCheckedChange={(enabled) =>
                            void changeMatchRecaps(enabled)
                        }
                        disabled={isSavingMatchRecaps}
                        aria-label={t.recapTitle}
                    />
                </div>
                <div className="flex items-center gap-3 border-t py-3.5">
                    <div className="flex flex-1 flex-col">
                        <span className="text-sm">{t.remindersTitle}</span>
                        <span className="text-muted-foreground text-sm">
                            {t.remindersDescription}
                        </span>
                    </div>
                    <span className="text-muted-foreground text-sm">
                        {t.remindersByClan}
                    </span>
                </div>
            </Section>

            <Section title={t.privacyTitle} className="pb-4">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 border-t py-3.5">
                    <span className="flex-[1_1_220px] text-sm">
                        {t.downloadAllData}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg"
                        disabled={isExporting}
                        onClick={() => void downloadData()}
                    >
                        {isExporting ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : null}
                        {t.downloadZip}
                    </Button>
                </div>
                <form
                    className="border-status-danger-border bg-status-danger-muted text-status-danger flex flex-col gap-2.5 rounded-xl border p-3.5"
                    onSubmit={(event) => {
                        event.preventDefault()
                        void requestErasure()
                    }}
                >
                    <span className="text-sm font-semibold">
                        {t.deleteAccountTitle}
                    </span>
                    <p id={ids.erasure} className="text-sm leading-5">
                        {t.deleteAccountDescription}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <Input
                            value={erasureName}
                            onChange={(event) =>
                                setErasureName(event.target.value)
                            }
                            aria-label={t.deleteAccountConfirmLabel}
                            aria-describedby={ids.erasure}
                            placeholder={user.name}
                            autoComplete="off"
                            className="border-status-danger-border bg-background text-foreground h-9 min-w-0 flex-[1_1_180px] rounded-lg"
                        />
                        <Button
                            type="submit"
                            variant="destructive"
                            className="h-9 rounded-lg"
                            disabled={!erasureConfirmed || isRequestingErasure}
                        >
                            {isRequestingErasure ? (
                                <Loader2 className="size-4 animate-spin" />
                            ) : null}
                            {t.deleteAccountButton}
                        </Button>
                    </div>
                </form>
            </Section>

            <Dialog open={platformIdsOpen} onOpenChange={setPlatformIdsOpen}>
                <DialogContent className="rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>{t.manualIdsDialogTitle}</DialogTitle>
                        <DialogDescription>
                            {t.manualIdsDialogDescription}
                        </DialogDescription>
                    </DialogHeader>
                    <form
                        id={`${ids.platformIds}-form`}
                        className="space-y-2"
                        onSubmit={(event) => {
                            event.preventDefault()
                            void savePlatformIds()
                        }}
                    >
                        <label
                            htmlFor={ids.platformIds}
                            className="text-sm font-medium"
                        >
                            {t.platformId}
                        </label>
                        <Input
                            id={ids.platformIds}
                            value={platformIds}
                            onChange={(event) => {
                                setPlatformIds(event.target.value)
                                setPlatformIdsError(null)
                            }}
                            placeholder={t.platformIdPlaceholder}
                            aria-invalid={platformIdsError ? true : undefined}
                            aria-describedby={
                                platformIdsError
                                    ? `${ids.platformIds}-error`
                                    : undefined
                            }
                            className="rounded-lg"
                        />
                        <FieldError id={`${ids.platformIds}-error`}>
                            {platformIdsError}
                        </FieldError>
                        {platformIds.trim() ? (
                            <p className="text-muted-foreground text-sm">
                                {getDetectedPlatformHint(
                                    platformIds,
                                    dictionary
                                )}
                            </p>
                        ) : null}
                        <details className="text-muted-foreground text-xs">
                            <summary className="flex cursor-pointer items-center gap-1.5">
                                <CircleHelp className="size-3.5" />
                                {t.platformIdHelp}
                            </summary>
                            <p className="mt-2">
                                <a
                                    href="https://help.steampowered.com/en/faqs/view/2816-BE67-5B69-0FEC"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="underline"
                                >
                                    {t.platformIdSteamLink}
                                </a>{" "}
                                {t.platformIdSteamHint}
                            </p>
                            <p className="mt-1">
                                <a
                                    href="https://www.epicgames.com/help/c-202300000001645/c-Trending_0/what-is-an-epic-games-account-id-and-where-can-i-find-it-a202300000011535"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="underline"
                                >
                                    {t.platformIdEpicLink}
                                </a>{" "}
                                {t.platformIdEpicHint}
                            </p>
                        </details>
                    </form>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            className="rounded-lg"
                            disabled={isSavingPlatformIds}
                            onClick={() => setPlatformIdsOpen(false)}
                        >
                            {dictionary.common.cancel}
                        </Button>
                        <Button
                            type="submit"
                            form={`${ids.platformIds}-form`}
                            className="rounded-lg"
                            disabled={isSavingPlatformIds}
                        >
                            {dictionary.common.save}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
