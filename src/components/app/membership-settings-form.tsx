"use client"

import { useMemo, useState, useTransition, type ReactNode } from "react"
import { Plus, Trash2, TriangleAlert, UserPlus } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import Link from "next/link"

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import type {
    DiscordConfig,
    MembershipCategory,
    MembershipSettings,
} from "@/types/domain"
import { ModalQuestionsEditor } from "@/components/app/settings/modal-questions-editor"
import { DiscordMultiEntitySelect } from "@/components/app/discord-multi-entity-select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MemberRoleOperations } from "@/components/app/member-role-operations"
import { SettingsSaveBar } from "@/components/app/settings/settings-save-bar"
import { DiscordMarkdownTextarea } from "@/components/app/discord-markdown"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { GAME_IDS, GAME_LABELS, type GameId } from "@/domain/games/game"
import { EmojiPickerInput } from "@/components/app/emoji-picker-input"
import { useDiscordMetadata } from "@/hooks/use-discord-metadata"
import { DiscordChannelSelect } from "./discord-channel-select"
import { ConfigNotice } from "@/components/app/config-notice"
import { AvatarPicker } from "@/components/app/avatar-picker"
import { EmptyState } from "@/components/app/empty-state"
import type { Dictionary } from "@/i18n/dictionaries"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const MAX_FIELD_LENGTH = 1024
const ASSIGNMENT_TYPES = ["member", "reserve_member", "mercenary"] as const
type AssignmentType = (typeof ASSIGNMENT_TYPES)[number]
type ScoreKey = keyof NonNullable<MembershipSettings["rosterScoreSettings"]>

function makeId(prefix: string) {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function buildDefaultCategory(): MembershipCategory {
    return {
        id: makeId("membership"),
        gameId: "hell_let_loose",
        emoji: "",
        label: "",
        description: "",
        supportRoleIds: [],
        recruitRoleIds: [],
        finalRoleIds: [],
        modalQuestions: [],
        assignmentType: "member",
    }
}

function buildDefaultSettings(
    dictionary: Dictionary,
    config?: DiscordConfig | null
): MembershipSettings {
    if (config?.membershipSettings) {
        return {
            ...config.membershipSettings,
            panelImageUrl: config.membershipSettings.panelImageUrl ?? "",
            applicationWelcomeMessage:
                config.membershipSettings.applicationWelcomeMessage ?? "",
            inviteSupportMembersIndividually:
                config.membershipSettings.inviteSupportMembersIndividually ??
                true,
            rosterScoreSettings: {
                noCategory:
                    config.membershipSettings.rosterScoreSettings?.noCategory ??
                    0,
                declined:
                    config.membershipSettings.rosterScoreSettings?.declined ??
                    0,
                rosterPresent:
                    config.membershipSettings.rosterScoreSettings
                        ?.rosterPresent ?? 0,
                reservePresent:
                    config.membershipSettings.rosterScoreSettings
                        ?.reservePresent ?? 0,
                rosterAbsent:
                    config.membershipSettings.rosterScoreSettings
                        ?.rosterAbsent ?? 0,
                reserveAbsent:
                    config.membershipSettings.rosterScoreSettings
                        ?.reserveAbsent ?? 0,
                excusedAbsence:
                    config.membershipSettings.rosterScoreSettings
                        ?.excusedAbsence ?? 0,
            },
            categories: config.membershipSettings.categories.map(
                (category) => ({
                    ...category,
                    emoji: category.emoji ?? "",
                    label: category.label ?? "",
                    description: category.description ?? "",
                    recruitRoleIds: [...category.recruitRoleIds],
                    finalRoleIds: [...category.finalRoleIds],
                    supportRoleIds: [...category.supportRoleIds],
                    modalQuestions: category.modalQuestions.map((question) => ({
                        ...question,
                        placeholder: question.placeholder ?? "",
                    })),
                })
            ),
        }
    }

    return {
        enabled: false,
        submitChannelId: "",
        applicationParentChannelId: "",
        panelTitle: dictionary.membershipSettings.defaultPanelTitle,
        panelDescription: dictionary.membershipSettings.defaultPanelDescription,
        panelImageUrl: "",
        applicationWelcomeMessage: "",
        autoAssignRecruitOnApply: false,
        inviteSupportMembersIndividually: true,
        rosterScoreSettings: {
            noCategory: 0,
            declined: 0,
            rosterPresent: 0,
            reservePresent: 0,
            rosterAbsent: 0,
            reserveAbsent: 0,
            excusedAbsence: 0,
        },
        categories: [],
    }
}

function buildFieldPreview(categories: MembershipCategory[]) {
    const lines = categories.map((category) => {
        const pieces = [category.emoji?.trim(), category.label?.trim()].filter(
            Boolean
        )
        const heading = pieces.join(" ") || category.id
        return category.description?.trim()
            ? `${heading}: ${category.description.trim()}`
            : heading
    })

    return {
        length: lines.join("\n").length,
        tooLong: lines.join("\n").length > MAX_FIELD_LENGTH,
    }
}

function categoryInitials(category: MembershipCategory) {
    const words = (category.label ?? "").trim().split(/\s+/).filter(Boolean)
    const initials = words
        .slice(0, 2)
        .map((word) => word[0])
        .join("")
    return initials.toUpperCase() || "?"
}

function needsRecruitRole(category: MembershipCategory) {
    return (
        category.assignmentType === "member" ||
        category.assignmentType === "reserve_member"
    )
}

const SCORE_FIELDS: Array<{
    key: ScoreKey
    label: (dictionary: Dictionary) => string
}> = [
    {
        key: "noCategory",
        label: (d) => d.membershipSettings.rosterScoreNoCategory,
    },
    {
        key: "declined",
        label: (d) => d.serverSettings.rosterScoreDeclined,
    },
    {
        key: "rosterPresent",
        label: (d) => d.membershipSettings.rosterScorePresentRoster,
    },
    {
        key: "reservePresent",
        label: (d) => d.membershipSettings.rosterScorePresentReserve,
    },
    {
        key: "rosterAbsent",
        label: (d) => d.membershipSettings.rosterScoreAbsentRoster,
    },
    {
        key: "reserveAbsent",
        label: (d) => d.membershipSettings.rosterScoreAbsentReserve,
    },
    {
        key: "excusedAbsence",
        label: (d) => d.membershipSettings.rosterScoreExcusedAbsence,
    },
]

export function MembershipSettingsForm({
    serverId,
    config,
    dictionary,
    rolesHref,
}: {
    serverId: string
    config: DiscordConfig | null
    dictionary: Dictionary
    /** The Roles and access page, where the clan role is chosen. */
    rolesHref: string
}) {
    const t = dictionary.membershipSettings
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [saving, setSaving] = useState(false)
    const metadata = useDiscordMetadata(serverId)
    const initial = useMemo(
        () => buildDefaultSettings(dictionary, config),
        [dictionary, config]
    )
    const [settings, setSettings] = useState<MembershipSettings>(initial)
    const [selectedId, setSelectedId] = useState<string | null>(
        initial.categories[0]?.id ?? null
    )
    const [tab, setTab] = useState("categories")
    const dirty = JSON.stringify(settings) !== JSON.stringify(initial)

    const roles = metadata?.roles ?? []
    const emojiOptions = metadata?.emojis ?? []
    const preview = useMemo(
        () => buildFieldPreview(settings.categories),
        [settings.categories]
    )
    const selected =
        settings.categories.find((category) => category.id === selectedId) ??
        settings.categories[0]
    const clanRole = config?.clanRoleId
        ? roles.find((role) => role.id === config.clanRoleId)
        : undefined
    const submitChannel = metadata?.channels.find(
        (channel) => channel.id === settings.submitChannelId
    )
    const assignmentLabels: Record<AssignmentType, string> = {
        member: dictionary.userManagement.memberLabel,
        reserve_member: dictionary.userManagement.reserveMemberLabel,
        mercenary: dictionary.userManagement.mercLabel,
    }

    const missingMembershipParts: string[] = []
    if (!settings.submitChannelId) missingMembershipParts.push(t.submitChannel)
    if (!settings.applicationParentChannelId)
        missingMembershipParts.push(t.parentChannel)
    if (!settings.categories.length)
        missingMembershipParts.push(t.categoriesTitle)
    const categoryName = (category: MembershipCategory) =>
        category.label?.trim() || category.id
    const categoriesMissingRecruitRole = settings.categories
        .filter(
            (category) =>
                needsRecruitRole(category) &&
                category.recruitRoleIds.length === 0
        )
        .map(categoryName)
    const categoriesMissingFinalRole = settings.categories
        .filter((category) => category.finalRoleIds.length === 0)
        .map(categoryName)

    function patchSettings(patch: Partial<MembershipSettings>) {
        setSettings((current) => ({ ...current, ...patch }))
    }

    function patchCategory(
        categoryId: string,
        patch: Partial<MembershipCategory>
    ) {
        setSettings((current) => ({
            ...current,
            categories: current.categories.map((category) =>
                category.id === categoryId
                    ? { ...category, ...patch }
                    : category
            ),
        }))
    }

    function patchScore(key: ScoreKey, value: string) {
        setSettings((current) => ({
            ...current,
            rosterScoreSettings: {
                ...current.rosterScoreSettings!,
                [key]: Number.parseInt(value || "0", 10) || 0,
            },
        }))
    }

    function addCategory() {
        const category = buildDefaultCategory()
        patchSettings({ categories: [...settings.categories, category] })
        setSelectedId(category.id)
    }

    function removeCategory(categoryId: string) {
        const remaining = settings.categories.filter(
            (category) => category.id !== categoryId
        )
        patchSettings({ categories: remaining })
        setSelectedId(remaining[0]?.id ?? null)
    }

    function discard() {
        setSettings(initial)
        if (!initial.categories.some((category) => category.id === selectedId))
            setSelectedId(initial.categories[0]?.id ?? null)
    }

    async function handleSave() {
        const membershipSettings = settings.enabled
            ? {
                  enabled: true,
                  submitChannelId: settings.submitChannelId || undefined,
                  applicationParentChannelId:
                      settings.applicationParentChannelId || undefined,
                  panelTitle: settings.panelTitle,
                  panelDescription: settings.panelDescription,
                  panelImageUrl: settings.panelImageUrl || undefined,
                  applicationWelcomeMessage:
                      settings.applicationWelcomeMessage?.trim() || undefined,
                  autoAssignRecruitOnApply: settings.autoAssignRecruitOnApply,
                  inviteSupportMembersIndividually:
                      settings.inviteSupportMembersIndividually ?? true,
                  rosterScoreSettings: settings.rosterScoreSettings,
                  categories: settings.categories.map((category) => ({
                      ...category,
                      emoji: category.emoji?.trim() || undefined,
                      label: category.label?.trim() || undefined,
                      description: category.description?.trim() || undefined,
                      recruitRoleIds: category.recruitRoleIds
                          .map((roleId) => roleId.trim())
                          .filter(Boolean),
                      finalRoleIds: category.finalRoleIds
                          .map((roleId) => roleId.trim())
                          .filter(Boolean),
                      modalQuestions: category.modalQuestions.map(
                          (question) => ({
                              ...question,
                              placeholder:
                                  question.placeholder?.trim() || undefined,
                          })
                      ),
                  })),
              }
            : {
                  ...settings,
                  enabled: false,
              }

        setSaving(true)
        try {
            const response = await fetch(
                `/api/servers/${serverId}/discord-settings`,
                {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ membershipSettings }),
                }
            )
            const body = await response.json().catch(() => ({}))
            if (!response.ok) {
                toast.error(body.error ?? t.saveError)
                return
            }
            toast.success(t.saved)
            startTransition(() => router.refresh())
        } catch {
            toast.error(t.saveError)
        } finally {
            setSaving(false)
        }
    }

    const clanRoleChip = clanRole ? (
        <span className="bg-muted rounded-md px-2 py-1 text-xs font-medium">
            @{clanRole.name}
        </span>
    ) : (
        <span className="rounded-md bg-amber-500/15 px-2 py-1 text-xs font-medium text-amber-800 dark:text-amber-300">
            {t.clanRoleMissingChip}
        </span>
    )
    const [noteBefore, noteAfter] = t.clanRoleNote.split("{role}")

    return (
        <div className="space-y-6">
            {settings.enabled && missingMembershipParts.length ? (
                <ConfigNotice title={t.incompleteTitle}>
                    {t.incompleteDescription.replace(
                        "{items}",
                        missingMembershipParts.join(", ")
                    )}
                </ConfigNotice>
            ) : null}
            {settings.enabled &&
            (!config?.clanRoleId ||
                categoriesMissingRecruitRole.length > 0 ||
                categoriesMissingFinalRole.length > 0) ? (
                <ConfigNotice title={t.rolesMissingTitle}>
                    {!config?.clanRoleId ? t.rolesMissingClanRole : ""}
                    {categoriesMissingRecruitRole.length
                        ? t.rolesMissingRecruitRole.replace(
                              "{categories}",
                              categoriesMissingRecruitRole.join(", ")
                          )
                        : ""}
                    {categoriesMissingFinalRole.length
                        ? t.rolesMissingFinalRole.replace(
                              "{categories}",
                              categoriesMissingFinalRole.join(", ")
                          )
                        : ""}
                    {t.rolesMissingSummary}
                </ConfigNotice>
            ) : null}

            <div className="border-border/60 bg-card divide-border/60 divide-y rounded-2xl border">
                <div className="flex items-start gap-3 p-4">
                    <Switch
                        id="membership-enabled"
                        checked={settings.enabled}
                        onCheckedChange={(checked) =>
                            patchSettings({ enabled: checked })
                        }
                        className="mt-0.5"
                    />
                    <Label
                        htmlFor="membership-enabled"
                        className="block space-y-1 font-normal"
                    >
                        <span className="block font-semibold">
                            {t.applicationsTitle}
                        </span>
                        <span className="text-muted-foreground block text-sm">
                            {submitChannel
                                ? t.applicationsChannel.replace(
                                      "{channel}",
                                      submitChannel.name
                                  )
                                : t.applicationsNoChannel}
                        </span>
                    </Label>
                </div>
                <div className="flex items-start gap-3 p-4">
                    <span
                        className={cn(
                            "mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                            settings.enabled
                                ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                                : "bg-muted text-muted-foreground"
                        )}
                    >
                        {settings.enabled ? t.roleSyncOn : t.roleSyncOff}
                    </span>
                    <div className="space-y-1">
                        <p className="font-semibold">{t.roleSyncToggleTitle}</p>
                        <p className="text-muted-foreground text-sm">
                            {t.roleSyncToggleDescription}
                        </p>
                    </div>
                </div>
            </div>

            <Tabs value={tab} onValueChange={setTab}>
                <TabsList
                    aria-label={t.tabsLabel}
                    className="h-auto w-full flex-wrap justify-start"
                >
                    <TabsTrigger value="categories" className="flex-none">
                        {t.tabs.categories}
                        <span className="bg-background text-muted-foreground rounded-full px-1.5 text-xs">
                            {settings.categories.length}
                        </span>
                    </TabsTrigger>
                    <TabsTrigger value="panel" className="flex-none">
                        {t.tabs.panel}
                    </TabsTrigger>
                    <TabsTrigger value="scores" className="flex-none">
                        {t.tabs.scores}
                    </TabsTrigger>
                    <TabsTrigger value="roleChanges" className="flex-none">
                        {t.tabs.roleChanges}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="categories" className="pt-2">
                    {settings.categories.length === 0 ? (
                        <EmptyState
                            icon={UserPlus}
                            title={t.noCategories}
                            description={t.noCategoriesDescription}
                            actions={
                                <Button
                                    type="button"
                                    className="rounded-xl"
                                    onClick={addCategory}
                                >
                                    <Plus className="size-4" />
                                    {t.addCategory}
                                </Button>
                            }
                        />
                    ) : (
                        <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
                            <div className="space-y-2">
                                <ul className="space-y-1">
                                    {settings.categories.map((category) => {
                                        const current =
                                            category.id === selected?.id
                                        const missing =
                                            category.finalRoleIds.length === 0
                                                ? t.missingFinalRole
                                                : needsRecruitRole(category) &&
                                                    category.recruitRoleIds
                                                        .length === 0
                                                  ? t.missingRecruitRole
                                                  : null
                                        return (
                                            <li key={category.id}>
                                                <button
                                                    type="button"
                                                    aria-current={
                                                        current
                                                            ? "true"
                                                            : undefined
                                                    }
                                                    onClick={() =>
                                                        setSelectedId(
                                                            category.id
                                                        )
                                                    }
                                                    className={cn(
                                                        "hover:bg-accent flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors",
                                                        current
                                                            ? "border-primary/50 bg-accent"
                                                            : "border-transparent"
                                                    )}
                                                >
                                                    <span
                                                        aria-hidden="true"
                                                        className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold"
                                                    >
                                                        {category.emoji?.trim() &&
                                                        !category.emoji.startsWith(
                                                            "<"
                                                        )
                                                            ? category.emoji
                                                            : categoryInitials(
                                                                  category
                                                              )}
                                                    </span>
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block truncate text-sm font-medium">
                                                            {category.label?.trim() ||
                                                                category.id}
                                                        </span>
                                                        <span
                                                            className={cn(
                                                                "block truncate text-xs",
                                                                missing
                                                                    ? "text-amber-700 dark:text-amber-400"
                                                                    : "text-muted-foreground"
                                                            )}
                                                        >
                                                            {
                                                                GAME_LABELS[
                                                                    category.gameId ??
                                                                        "hell_let_loose"
                                                                ]
                                                            }{" "}
                                                            ·{" "}
                                                            {missing ??
                                                                assignmentLabels[
                                                                    category
                                                                        .assignmentType
                                                                ]}
                                                        </span>
                                                    </span>
                                                    {missing ? (
                                                        <TriangleAlert
                                                            className="size-4 shrink-0 text-amber-600"
                                                            aria-hidden="true"
                                                        />
                                                    ) : null}
                                                </button>
                                            </li>
                                        )
                                    })}
                                </ul>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full rounded-xl"
                                    disabled={settings.categories.length >= 20}
                                    onClick={addCategory}
                                >
                                    <Plus className="size-4" />
                                    {t.addCategory}
                                </Button>
                                <p className="text-muted-foreground text-xs">
                                    {t.embedFieldUsage
                                        .replace(
                                            "{length}",
                                            String(preview.length)
                                        )
                                        .replace(
                                            "{max}",
                                            String(MAX_FIELD_LENGTH)
                                        )}{" "}
                                    {preview.tooLong ? t.embedFieldTooLong : ""}
                                </p>
                            </div>
                            {selected ? (
                                <CategoryEditor
                                    key={selected.id}
                                    category={selected}
                                    dictionary={dictionary}
                                    roles={roles}
                                    emojiOptions={emojiOptions}
                                    assignmentLabels={assignmentLabels}
                                    clanRoleChip={clanRoleChip}
                                    clanRoleNote={
                                        clanRole ? (
                                            <>
                                                {noteBefore}
                                                <strong>
                                                    @{clanRole.name}
                                                </strong>
                                                {noteAfter}
                                            </>
                                        ) : (
                                            <>
                                                {t.clanRoleMissingNote}{" "}
                                                <Link
                                                    href={rolesHref}
                                                    className="text-primary font-medium underline-offset-4 hover:underline"
                                                >
                                                    {t.clanRoleLink}
                                                </Link>
                                            </>
                                        )
                                    }
                                    onChange={(patch) =>
                                        patchCategory(selected.id, patch)
                                    }
                                    onRemove={() => removeCategory(selected.id)}
                                />
                            ) : null}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="panel" className="space-y-6 pt-2">
                    <div className="grid gap-4 lg:grid-cols-2">
                        <div className="space-y-2">
                            <Label>{t.submitChannel}</Label>
                            <DiscordChannelSelect
                                value={settings.submitChannelId}
                                onChange={(value) =>
                                    patchSettings({
                                        submitChannelId: value ?? "",
                                    })
                                }
                                channels={metadata?.channels ?? []}
                                placeholder={t.submitChannel}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>{t.parentChannel}</Label>
                            <DiscordChannelSelect
                                value={settings.applicationParentChannelId}
                                purpose="private-thread"
                                onChange={(value) =>
                                    patchSettings({
                                        applicationParentChannelId: value ?? "",
                                    })
                                }
                                channels={metadata?.channels ?? []}
                                placeholder={t.parentChannel}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="membership-panel-title">
                            {t.panelTitle}
                        </Label>
                        <Input
                            id="membership-panel-title"
                            value={settings.panelTitle}
                            onChange={(event) =>
                                patchSettings({
                                    panelTitle: event.target.value,
                                })
                            }
                            maxLength={256}
                            className="rounded-xl"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>{t.panelDescription}</Label>
                        <DiscordMarkdownTextarea
                            value={settings.panelDescription}
                            onChange={(value) =>
                                patchSettings({ panelDescription: value })
                            }
                            maxLength={4096}
                            className="min-h-32 rounded-xl"
                            rows={8}
                        />
                    </div>
                    <div className="space-y-2">
                        <div>
                            <Label>{t.welcomeMessage}</Label>
                            <p className="text-muted-foreground mt-1 text-sm">
                                {t.welcomeMessageDescription}
                            </p>
                        </div>
                        <DiscordMarkdownTextarea
                            value={settings.applicationWelcomeMessage}
                            onChange={(value) =>
                                patchSettings({
                                    applicationWelcomeMessage: value,
                                })
                            }
                            maxLength={1200}
                            className="min-h-28 rounded-xl"
                            rows={6}
                            placeholder={t.welcomeMessagePlaceholder}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>{t.image}</Label>
                        <AvatarPicker
                            value={settings.panelImageUrl ?? ""}
                            onChange={(value) =>
                                patchSettings({ panelImageUrl: value ?? "" })
                            }
                            fallback="CA"
                            label={t.applicationThumbnail}
                            buttonLabel={dictionary.common.upload}
                        />
                    </div>
                    <div className="border-border/60 divide-border/60 divide-y rounded-2xl border">
                        <SwitchRow
                            id="membership-skip-pending"
                            title={t.skipPendingTitle}
                            description={t.skipPendingDescription}
                            checked={settings.autoAssignRecruitOnApply}
                            onChange={(checked) =>
                                patchSettings({
                                    autoAssignRecruitOnApply: checked,
                                })
                            }
                        />
                        <SwitchRow
                            id="membership-invite-individually"
                            title={t.inviteSupportMembersIndividuallyTitle}
                            description={
                                t.inviteSupportMembersIndividuallyDescription
                            }
                            checked={
                                settings.inviteSupportMembersIndividually ??
                                true
                            }
                            onChange={(checked) =>
                                patchSettings({
                                    inviteSupportMembersIndividually: checked,
                                })
                            }
                        />
                    </div>
                </TabsContent>

                <TabsContent value="scores" className="space-y-4 pt-2">
                    <p className="text-muted-foreground text-sm">
                        {t.rosterScoreDescription}
                    </p>
                    <div className="grid gap-4 md:grid-cols-2">
                        {SCORE_FIELDS.map((field) => (
                            <div key={field.key} className="space-y-2">
                                <Label
                                    htmlFor={`membership-score-${field.key}`}
                                >
                                    {field.label(dictionary)}
                                </Label>
                                <Input
                                    id={`membership-score-${field.key}`}
                                    type="number"
                                    step={1}
                                    inputMode="numeric"
                                    className="rounded-xl"
                                    value={String(
                                        settings.rosterScoreSettings?.[
                                            field.key
                                        ] ?? 0
                                    )}
                                    onChange={(event) =>
                                        patchScore(
                                            field.key,
                                            event.target.value
                                        )
                                    }
                                />
                            </div>
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="roleChanges" className="pt-2">
                    <MemberRoleOperations
                        serverId={serverId}
                        dictionary={dictionary}
                    />
                </TabsContent>
            </Tabs>

            <SettingsSaveBar
                note={t.saveNote}
                dirty={dirty}
                saving={saving || isPending}
                discardLabel={t.discard}
                saveLabel={t.saveShort}
                unsavedLabel={t.unsaved}
                onDiscard={discard}
                onSave={() => void handleSave()}
            />
        </div>
    )
}

function SwitchRow({
    id,
    title,
    description,
    checked,
    onChange,
}: {
    id: string
    title: string
    description: string
    checked: boolean
    onChange(checked: boolean): void
}) {
    return (
        <div className="flex items-start gap-3 p-4">
            <Switch
                id={id}
                checked={checked}
                onCheckedChange={onChange}
                className="mt-0.5"
            />
            <Label htmlFor={id} className="block space-y-1 font-normal">
                <span className="block font-semibold">{title}</span>
                <span className="text-muted-foreground block text-sm">
                    {description}
                </span>
            </Label>
        </div>
    )
}

function CategoryEditor({
    category,
    dictionary,
    roles,
    emojiOptions,
    assignmentLabels,
    clanRoleChip,
    clanRoleNote,
    onChange,
    onRemove,
}: {
    category: MembershipCategory
    dictionary: Dictionary
    roles: Array<{ id: string; name: string }>
    emojiOptions: Array<{ id: string; name: string }>
    assignmentLabels: Record<AssignmentType, string>
    clanRoleChip: ReactNode
    clanRoleNote: ReactNode
    onChange(patch: Partial<MembershipCategory>): void
    onRemove(): void
}) {
    const t = dictionary.membershipSettings
    const id = `membership-category-${category.id}`
    const finalLabel = assignmentLabels[category.assignmentType]
    return (
        <section
            aria-labelledby={`${id}-title`}
            className="border-border/60 bg-card min-w-0 space-y-6 rounded-2xl border p-4 sm:p-5"
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <h2
                    id={`${id}-title`}
                    className="min-w-0 text-lg font-semibold break-words"
                >
                    {category.label?.trim() || category.id}
                </h2>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive rounded-lg"
                    onClick={onRemove}
                >
                    <Trash2 className="size-4" />
                    {t.removeCategory}
                </Button>
            </div>

            <div className="space-y-4">
                <h3 className="text-sm font-semibold">
                    {t.categoryButtonTitle}
                </h3>
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="space-y-2">
                        <Label htmlFor={`${id}-label`}>{t.categoryText}</Label>
                        <Input
                            id={`${id}-label`}
                            value={category.label ?? ""}
                            maxLength={80}
                            onChange={(event) =>
                                onChange({ label: event.target.value })
                            }
                            className="rounded-xl"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>{dictionary.emojiPicker.pickEmoji}</Label>
                        <EmojiPickerInput
                            value={category.emoji ?? ""}
                            onChange={(value) =>
                                onChange({ emoji: value ?? "" })
                            }
                            customEmojis={emojiOptions}
                            placeholder="..."
                            labels={dictionary.emojiPicker}
                            hidePickerLabel
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor={`${id}-game`}>{t.categoryGame}</Label>
                    <Select
                        value={category.gameId ?? "hell_let_loose"}
                        onValueChange={(value) => {
                            const gameId = GAME_IDS.find(
                                (game) => game === value
                            )
                            if (gameId) onChange({ gameId: gameId as GameId })
                        }}
                    >
                        <SelectTrigger
                            id={`${id}-game`}
                            className="w-full rounded-xl sm:max-w-xs"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {GAME_IDS.map((game) => (
                                <SelectItem key={game} value={game}>
                                    {GAME_LABELS[game]}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>{t.categoryDescriptionLabel}</Label>
                    <DiscordMarkdownTextarea
                        value={category.description ?? ""}
                        onChange={(value) => onChange({ description: value })}
                        className="rounded-xl"
                        maxLength={240}
                        rows={3}
                        height={120}
                        compactToolbar
                        preview="edit"
                    />
                </div>
            </div>

            <div className="space-y-3">
                <h3 id={`${id}-result`} className="text-sm font-semibold">
                    {t.resultTitle}
                </h3>
                <ToggleGroup
                    type="single"
                    variant="outline"
                    aria-labelledby={`${id}-result`}
                    className="w-full sm:w-fit"
                    value={category.assignmentType}
                    onValueChange={(value) => {
                        const assignmentType = ASSIGNMENT_TYPES.find(
                            (type) => type === value
                        )
                        if (assignmentType) onChange({ assignmentType })
                    }}
                >
                    {ASSIGNMENT_TYPES.map((type) => (
                        <ToggleGroupItem
                            key={type}
                            value={type}
                            className="px-3"
                        >
                            {assignmentLabels[type]}
                        </ToggleGroupItem>
                    ))}
                </ToggleGroup>
            </div>

            <div className="space-y-3">
                <h3 className="text-sm font-semibold">{t.rolesByStatus}</h3>
                <ol className="border-border/60 divide-border/60 divide-y rounded-xl border">
                    <li className="grid gap-2 p-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center">
                        <span className="text-sm font-medium">
                            {t.statusPending}
                        </span>
                        <span className="text-muted-foreground text-sm">
                            {t.noRoles}
                        </span>
                    </li>
                    {needsRecruitRole(category) ? (
                        <li className="grid gap-2 p-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center">
                            <span className="text-sm font-medium">
                                {t.statusRecruit}
                            </span>
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                                {clanRoleChip}
                                <div className="min-w-0 flex-1 basis-48">
                                    <DiscordMultiEntitySelect
                                        value={category.recruitRoleIds}
                                        onChange={(value) =>
                                            onChange({ recruitRoleIds: value })
                                        }
                                        options={roles}
                                        placeholder={t.rolePlaceholder}
                                    />
                                </div>
                            </div>
                        </li>
                    ) : null}
                    <li className="grid gap-2 p-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center">
                        <span className="text-sm font-medium">
                            {finalLabel}
                        </span>
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                            {clanRoleChip}
                            <div className="min-w-0 flex-1 basis-48">
                                <DiscordMultiEntitySelect
                                    value={category.finalRoleIds}
                                    onChange={(value) =>
                                        onChange({ finalRoleIds: value })
                                    }
                                    options={roles}
                                    placeholder={t.rolePlaceholder}
                                />
                            </div>
                        </div>
                    </li>
                </ol>
                <div className="grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center sm:px-3">
                    <span className="text-sm font-medium">{t.handledBy}</span>
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <div className="min-w-0 flex-1 basis-48">
                            <DiscordMultiEntitySelect
                                value={category.supportRoleIds}
                                onChange={(value) =>
                                    onChange({ supportRoleIds: value })
                                }
                                options={roles}
                                placeholder={t.rolePlaceholder}
                            />
                        </div>
                        <span className="text-muted-foreground text-sm">
                            {t.handledByAdmins}
                        </span>
                    </div>
                </div>
                <p className="text-muted-foreground text-xs">{clanRoleNote}</p>
            </div>

            <ModalQuestionsEditor
                questions={category.modalQuestions}
                onChange={(modalQuestions) => onChange({ modalQuestions })}
                dictionary={dictionary}
            />
        </section>
    )
}
