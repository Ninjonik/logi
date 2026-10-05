"use client"

import { useMemo, useState, useTransition, type ReactNode } from "react"
import { Plus, Trash2, UserPlus } from "lucide-react"
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
import {
    FixedRoleChip,
    RoleChips,
    type RoleOption,
} from "@/components/app/settings/role-chips"
import type {
    DiscordConfig,
    MembershipCategory,
    MembershipSettings,
} from "@/types/domain"
import { ModalQuestionsEditor } from "@/components/app/settings/modal-questions-editor"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SegmentedControl } from "@/components/app/settings/segmented-control"
import { MemberRoleOperations } from "@/components/app/member-role-operations"
import { SettingsSaveBar } from "@/components/app/settings/settings-save-bar"
import { DiscordMarkdownTextarea } from "@/components/app/discord-markdown"
import { GAME_IDS, GAME_LABELS, type GameId } from "@/domain/games/game"
import { EmojiPickerInput } from "@/components/app/emoji-picker-input"
import { useDiscordMetadata } from "@/hooks/use-discord-metadata"
import { DiscordChannelSelect } from "./discord-channel-select"
import { ConfigNotice } from "@/components/app/config-notice"
import { AvatarPicker } from "@/components/app/avatar-picker"
import { EmptyState } from "@/components/app/empty-state"
import type { Dictionary } from "@/i18n/dictionaries"
import { Textarea } from "@/components/ui/textarea"
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
        // New switches are sent only when they differ from the value they
        // fall back to, so settings that do not use them stay as they were.
        const roleSyncEnabled =
            settings.roleSyncEnabled === undefined ||
            settings.roleSyncEnabled === settings.enabled
                ? undefined
                : settings.roleSyncEnabled
        const categoryOptions = (category: MembershipCategory) => ({
            autoAssignRecruitOnApply:
                category.assignmentType === "member" &&
                category.autoAssignRecruitOnApply !== undefined &&
                category.autoAssignRecruitOnApply !==
                    settings.autoAssignRecruitOnApply
                    ? category.autoAssignRecruitOnApply
                    : undefined,
        })
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
                  roleSyncEnabled,
                  inviteSupportMembersIndividually:
                      settings.inviteSupportMembersIndividually ?? true,
                  rosterScoreSettings: settings.rosterScoreSettings,
                  categories: settings.categories.map((category) => ({
                      ...category,
                      ...categoryOptions(category),
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
                  roleSyncEnabled,
                  categories: settings.categories.map((category) => ({
                      ...category,
                      ...categoryOptions(category),
                  })),
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
        <FixedRoleChip>@{clanRole.name}</FixedRoleChip>
    ) : (
        <FixedRoleChip tone="attention">{t.clanRoleMissingChip}</FixedRoleChip>
    )
    const [noteBefore, noteAfter] = t.clanRoleNote.split("{role}")
    const roleSync = settings.roleSyncEnabled ?? settings.enabled
    const roleOptions: RoleOption[] | null = metadata ? roles : null

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
            {roleSync &&
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

            <div className="grid gap-3 md:grid-cols-2">
                <SwitchCard
                    id="membership-enabled"
                    title={t.applicationsTitle}
                    description={
                        submitChannel
                            ? t.applicationsChannel.replace(
                                  "{channel}",
                                  submitChannel.name
                              )
                            : t.applicationsNoChannel
                    }
                    checked={settings.enabled}
                    onChange={(checked) => patchSettings({ enabled: checked })}
                />
                <SwitchCard
                    id="membership-role-sync"
                    title={t.roleSyncToggleTitle}
                    description={t.roleSyncSwitchDescription}
                    checked={roleSync}
                    onChange={(checked) =>
                        patchSettings({ roleSyncEnabled: checked })
                    }
                />
            </div>

            <Tabs value={tab} onValueChange={setTab}>
                <TabsList
                    aria-label={t.tabsLabel}
                    className="h-auto w-full justify-start gap-2 overflow-x-auto rounded-none border-b bg-transparent p-0"
                >
                    {(
                        [
                            "categories",
                            "panel",
                            "scores",
                            "roleChanges",
                        ] as const
                    ).map((value) => (
                        <TabsTrigger
                            key={value}
                            value={value}
                            className="text-muted-foreground data-[state=active]:border-foreground data-[state=active]:text-foreground dark:data-[state=active]:border-foreground -mb-px h-10 flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 font-normal data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:shadow-none dark:data-[state=active]:bg-transparent"
                        >
                            {t.tabs[value]}
                            {value === "categories" ? (
                                <span className="bg-muted text-muted-foreground rounded-md px-1.5 text-xs font-normal">
                                    {settings.categories.length}
                                </span>
                            ) : null}
                        </TabsTrigger>
                    ))}
                </TabsList>

                <TabsContent value="categories" className="pt-4">
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
                        <div className="grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)]">
                            <div className="space-y-2">
                                <ul className="space-y-2">
                                    {settings.categories.map((category) => {
                                        const current =
                                            category.id === selected?.id
                                        const missing = !roleSync
                                            ? null
                                            : category.finalRoleIds.length === 0
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
                                                        "bg-card hover:bg-accent/40 flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                                                        current
                                                            ? "border-foreground"
                                                            : missing
                                                              ? "border-amber-400/70 dark:border-amber-500/50"
                                                              : "border-border"
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
                                                        <span className="block truncate text-sm font-semibold">
                                                            {category.label?.trim() ||
                                                                category.id}
                                                        </span>
                                                        <span
                                                            className={cn(
                                                                "block text-xs",
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
                                                </button>
                                            </li>
                                        )
                                    })}
                                </ul>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="text-muted-foreground w-full rounded-xl border-dashed font-normal"
                                    disabled={settings.categories.length >= 20}
                                    onClick={addCategory}
                                >
                                    <Plus className="size-4" />
                                    {t.addCategory}
                                </Button>
                                {preview.tooLong ? (
                                    <p className="text-xs text-amber-700 dark:text-amber-400">
                                        {t.embedFieldUsage
                                            .replace(
                                                "{length}",
                                                String(preview.length)
                                            )
                                            .replace(
                                                "{max}",
                                                String(MAX_FIELD_LENGTH)
                                            )}{" "}
                                        {t.embedFieldTooLong}
                                    </p>
                                ) : null}
                            </div>
                            {selected ? (
                                <CategoryEditor
                                    key={selected.id}
                                    category={selected}
                                    clanSkipsPending={
                                        settings.autoAssignRecruitOnApply
                                    }
                                    dictionary={dictionary}
                                    roles={roleOptions}
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

                <TabsContent value="panel" className="space-y-6 pt-4">
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
                    <div className="border-border/60 rounded-2xl border">
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

                <TabsContent value="scores" className="space-y-4 pt-4">
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

                <TabsContent value="roleChanges" className="pt-4">
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

function SwitchCard({
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
        <div className="bg-card flex items-start gap-3 rounded-2xl border p-4">
            <Switch
                id={id}
                checked={checked}
                onCheckedChange={onChange}
                className="mt-0.5"
            />
            <Label htmlFor={id} className="block space-y-1 font-normal">
                <span className="block font-semibold">{title}</span>
                <span className="text-muted-foreground block text-sm leading-5">
                    {description}
                </span>
            </Label>
        </div>
    )
}

function SwitchRow({
    id,
    title,
    description,
    checked,
    disabled,
    onChange,
}: {
    id: string
    title: string
    description: string
    checked: boolean
    disabled?: boolean
    onChange(checked: boolean): void
}) {
    return (
        <div className="flex items-start gap-3 p-4">
            <Switch
                id={id}
                checked={checked}
                disabled={disabled}
                onCheckedChange={onChange}
                className="mt-0.5"
            />
            <Label htmlFor={id} className="block space-y-1 font-normal">
                <span className="block">{title}</span>
                <span className="text-muted-foreground block text-sm">
                    {description}
                </span>
            </Label>
        </div>
    )
}

function SectionLabel({ id, children }: { id?: string; children: ReactNode }) {
    return (
        <h3
            id={id}
            className="text-muted-foreground text-xs font-semibold tracking-wide uppercase"
        >
            {children}
        </h3>
    )
}

function CategoryEditor({
    category,
    clanSkipsPending,
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
    /** The clan-wide skip switch a category without its own value follows. */
    clanSkipsPending: boolean
    dictionary: Dictionary
    roles: RoleOption[] | null
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
    const isMember = category.assignmentType === "member"
    const roleLabels = (status: string) => ({
        add: t.addRole,
        addAria: t.addRoleAria.replace("{status}", status),
        remove: (name: string) => t.removeRole.replace("{role}", name),
        search: t.roleSearch,
        empty: t.roleEmpty,
    })
    return (
        <section
            aria-labelledby={`${id}-title`}
            className="bg-card min-w-0 divide-y rounded-2xl border px-5 sm:px-6"
        >
            <div className="flex flex-wrap items-start justify-between gap-3 py-5">
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

            <div className="space-y-4 py-5">
                <SectionLabel>{t.categoryButtonTitle}</SectionLabel>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor={`${id}-label`}>{t.categoryText}</Label>
                        <div className="flex items-center gap-2">
                            <div className="w-16 shrink-0">
                                <EmojiPickerInput
                                    value={category.emoji ?? ""}
                                    onChange={(value) =>
                                        onChange({ emoji: value ?? "" })
                                    }
                                    customEmojis={emojiOptions}
                                    placeholder="…"
                                    labels={dictionary.emojiPicker}
                                    hidePickerLabel
                                />
                            </div>
                            <Input
                                id={`${id}-label`}
                                value={category.label ?? ""}
                                maxLength={80}
                                onChange={(event) =>
                                    onChange({ label: event.target.value })
                                }
                                className="rounded-lg"
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
                                if (gameId)
                                    onChange({ gameId: gameId as GameId })
                            }}
                        >
                            <SelectTrigger
                                id={`${id}-game`}
                                className="w-full rounded-lg"
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
                </div>
                <div className="space-y-2">
                    <Label htmlFor={`${id}-description`}>
                        {t.categoryDescriptionLabel}
                    </Label>
                    <Textarea
                        id={`${id}-description`}
                        value={category.description ?? ""}
                        onChange={(event) =>
                            onChange({ description: event.target.value })
                        }
                        className="min-h-16 rounded-lg"
                        maxLength={240}
                        rows={2}
                        aria-describedby={`${id}-description-help`}
                    />
                    <p
                        id={`${id}-description-help`}
                        className="text-muted-foreground text-xs"
                    >
                        {t.categoryDescriptionHelp}
                    </p>
                </div>
            </div>

            <div className="space-y-3 py-5">
                <SectionLabel id={`${id}-result`}>{t.resultTitle}</SectionLabel>
                <SegmentedControl
                    labelledBy={`${id}-result`}
                    value={category.assignmentType}
                    onChange={(assignmentType) => onChange({ assignmentType })}
                    options={ASSIGNMENT_TYPES.map((type) => ({
                        value: type,
                        label: assignmentLabels[type],
                    }))}
                />
                <div className="-mx-4">
                    <SwitchRow
                        id={`${id}-skip`}
                        title={t.skipPendingCategoryTitle}
                        description={t.skipPendingCategoryHelp}
                        checked={
                            isMember &&
                            (category.autoAssignRecruitOnApply ??
                                clanSkipsPending)
                        }
                        disabled={!isMember}
                        onChange={(checked) =>
                            onChange({ autoAssignRecruitOnApply: checked })
                        }
                    />
                </div>
            </div>

            <div className="space-y-3 py-5">
                <SectionLabel>{t.rolesByStatus}</SectionLabel>
                <ol className="divide-y rounded-xl border">
                    <li className="grid gap-2 px-4 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center">
                        <span className="text-sm">{t.statusPending}</span>
                        <span className="text-muted-foreground text-sm">
                            {t.noRoles}
                        </span>
                    </li>
                    {needsRecruitRole(category) ? (
                        <li className="grid gap-2 px-4 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center">
                            <span className="text-sm">{t.statusRecruit}</span>
                            <RoleChips
                                value={category.recruitRoleIds}
                                onChange={(value) =>
                                    onChange({ recruitRoleIds: value })
                                }
                                roles={roles}
                                leading={clanRoleChip}
                                labels={roleLabels(t.statusRecruit)}
                            />
                        </li>
                    ) : null}
                    <li className="grid gap-2 px-4 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center">
                        <span className="text-sm">{finalLabel}</span>
                        <RoleChips
                            value={category.finalRoleIds}
                            onChange={(value) =>
                                onChange({ finalRoleIds: value })
                            }
                            roles={roles}
                            leading={clanRoleChip}
                            labels={roleLabels(finalLabel)}
                        />
                    </li>
                </ol>
                <div className="grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center">
                    <span className="text-sm">{t.handledBy}</span>
                    <div className="flex flex-wrap items-center gap-2">
                        <RoleChips
                            value={category.supportRoleIds}
                            onChange={(value) =>
                                onChange({ supportRoleIds: value })
                            }
                            roles={roles}
                            labels={roleLabels(t.handledBy)}
                        />
                        <span className="text-muted-foreground text-sm">
                            {t.handledByAdmins}
                        </span>
                    </div>
                </div>
                <p className="text-muted-foreground text-xs">{clanRoleNote}</p>
            </div>

            <div className="py-5">
                <ModalQuestionsEditor
                    questions={category.modalQuestions}
                    onChange={(modalQuestions) => onChange({ modalQuestions })}
                    dictionary={dictionary}
                />
            </div>
        </section>
    )
}
