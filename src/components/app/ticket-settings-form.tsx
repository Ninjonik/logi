"use client"

import { Check, Plus, Ticket, Trash2 } from "lucide-react"
import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
    channelOptions,
    SettingsChannelPicker,
} from "@/components/app/settings/settings-channel-picker"
import type {
    DiscordConfig,
    TicketCategory,
    TicketSettings,
} from "@/types/domain"
import { SettingsSectionHeader } from "@/components/app/settings/settings-section-header"
import { ModalQuestionsEditor } from "@/components/app/settings/modal-questions-editor"
import { DiscordMultiEntitySelect } from "@/components/app/discord-multi-entity-select"
import { SettingsSaveBar } from "@/components/app/settings/settings-save-bar"
import { DiscordMarkdownTextarea } from "@/components/app/discord-markdown"
import { EmojiPickerInput } from "@/components/app/emoji-picker-input"
import { useDiscordMetadataState } from "@/hooks/use-discord-metadata"
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

type EditableTicketCategory = TicketCategory

const MAX_TICKET_CATEGORY_FIELD_LENGTH = 1024

function makeId(prefix: string) {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function buildDefaultTicketCategory(): EditableTicketCategory {
    return {
        id: makeId("category"),
        emoji: "",
        label: "",
        description: "",
        supportRoleIds: [],
        modalQuestions: [],
    }
}

function buildDefaultTicketSettings(
    dictionary: Dictionary,
    config?: DiscordConfig | null
): TicketSettings {
    if (config?.ticketSettings) {
        return {
            ...config.ticketSettings,
            panelTitle: config.ticketSettings.panelTitle ?? "",
            panelDescription: config.ticketSettings.panelDescription ?? "",
            panelImageUrl: config.ticketSettings.panelImageUrl ?? "",
            categories: config.ticketSettings.categories.map((category) => ({
                ...category,
                emoji: category.emoji ?? "",
                label: category.label ?? "",
                description: category.description ?? "",
                supportRoleIds: [...category.supportRoleIds],
                modalQuestions: category.modalQuestions.map((question) => ({
                    ...question,
                    placeholder: question.placeholder ?? "",
                })),
            })),
        }
    }

    return {
        enabled: false,
        submitChannelId: "",
        ticketParentChannelId: "",
        panelTitle: dictionary.ticketSettings.defaultPanelTitle,
        panelDescription: dictionary.ticketSettings.defaultPanelDescription,
        panelImageUrl: "",
        categories: [],
    }
}

function buildTicketCategoryFieldPreview(categories: EditableTicketCategory[]) {
    const lines = categories
        .map((category) => {
            const pieces = [
                category.emoji?.trim(),
                category.label?.trim(),
            ].filter(Boolean)
            const title = pieces.join(" ") || category.id
            const description = category.description?.trim()
            return description ? `${title}: ${description}` : title
        })
        .filter(Boolean)

    const fullText = lines.join("\n")
    return {
        tooLong: fullText.length > MAX_TICKET_CATEGORY_FIELD_LENGTH,
        length: fullText.length,
    }
}

export function TicketSettingsForm({
    serverId,
    dictionary,
    config,
}: {
    serverId: string
    dictionary: Dictionary
    config: DiscordConfig | null
}) {
    const t = dictionary.ticketSettings
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [saving, setSaving] = useState(false)
    const metadataState = useDiscordMetadataState(serverId)
    const metadata = metadataState.metadata
    const initial = useMemo(
        () => buildDefaultTicketSettings(dictionary, config),
        [dictionary, config]
    )
    const [ticketSettings, setTicketSettings] =
        useState<TicketSettings>(initial)
    const [editingId, setEditingId] = useState<string | null>(null)
    const dirty = JSON.stringify(ticketSettings) !== JSON.stringify(initial)

    const roles = metadata?.roles ?? []
    const emojiOptions = metadata?.emojis ?? []
    const categoryFieldPreview = useMemo(
        () => buildTicketCategoryFieldPreview(ticketSettings.categories),
        [ticketSettings.categories]
    )
    const missingTicketParts: string[] = []
    if (!ticketSettings.submitChannelId)
        missingTicketParts.push(t.submitChannel)
    if (!ticketSettings.ticketParentChannelId)
        missingTicketParts.push(t.parentChannel)
    if (!ticketSettings.categories.length)
        missingTicketParts.push(t.categoriesTitle)

    function patchTicketSettings(patch: Partial<TicketSettings>) {
        setTicketSettings((current) => ({ ...current, ...patch }))
    }

    function patchTicketCategory(
        categoryId: string,
        patch: Partial<EditableTicketCategory>
    ) {
        setTicketSettings((current) => ({
            ...current,
            categories: current.categories.map((category) =>
                category.id === categoryId
                    ? { ...category, ...patch }
                    : category
            ),
        }))
    }

    function addCategory() {
        const category = buildDefaultTicketCategory()
        patchTicketSettings({
            categories: [...ticketSettings.categories, category],
        })
        setEditingId(category.id)
    }

    function removeCategory(categoryId: string) {
        patchTicketSettings({
            categories: ticketSettings.categories.filter(
                (category) => category.id !== categoryId
            ),
        })
        setEditingId(null)
    }

    function roleNames(roleIds: string[]) {
        return roleIds.map(
            (roleId) => roles.find((role) => role.id === roleId)?.name ?? roleId
        )
    }

    async function handleSave() {
        const normalizedTicketSettings: TicketSettings | undefined =
            ticketSettings.enabled
                ? {
                      enabled: true,
                      submitChannelId:
                          ticketSettings.submitChannelId || undefined,
                      ticketParentChannelId:
                          ticketSettings.ticketParentChannelId || undefined,
                      panelTitle: ticketSettings.panelTitle,
                      panelDescription: ticketSettings.panelDescription,
                      panelImageUrl: ticketSettings.panelImageUrl || undefined,
                      categories: ticketSettings.categories.map((category) => ({
                          ...category,
                          emoji: category.emoji?.trim() || undefined,
                          label: category.label?.trim() || undefined,
                          description:
                              category.description?.trim() || undefined,
                          supportRoleIds: category.supportRoleIds,
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
                      ...ticketSettings,
                      enabled: false,
                  }

        setSaving(true)
        try {
            const response = await fetch(
                `/api/servers/${serverId}/discord-settings`,
                {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                        ticketSettings: normalizedTicketSettings,
                    }),
                }
            )
            const body = await response.json().catch(() => ({}))
            if (!response.ok) {
                toast.error(
                    body.error ??
                        dictionary.serverSettings.discordSettingsSaveError
                )
                return
            }
            toast.success(dictionary.serverSettings.discordSettingsSaved)
            startTransition(() => router.refresh())
        } catch {
            toast.error(dictionary.serverSettings.discordSettingsSaveError)
        } finally {
            setSaving(false)
        }
    }

    const flow = [t.flow.pick, t.flow.form, t.flow.thread, t.flow.close]

    return (
        <div className="space-y-6">
            <SettingsSectionHeader
                title={dictionary.settingsHub.sections.tickets.title}
                description={
                    dictionary.settingsHub.sections.tickets.description
                }
                actions={
                    <label className="flex items-center gap-2.5 text-sm font-medium">
                        {ticketSettings.enabled
                            ? t.enabledLabel
                            : dictionary.settingsHub.overview.badges.off}
                        <Switch
                            aria-label={t.enabledAria}
                            checked={ticketSettings.enabled}
                            onCheckedChange={(checked) =>
                                patchTicketSettings({ enabled: checked })
                            }
                        />
                    </label>
                }
            />

            {ticketSettings.enabled && missingTicketParts.length ? (
                <ConfigNotice title={t.incompleteTitle}>
                    {t.incompleteDescription.replace(
                        "{items}",
                        missingTicketParts.join(", ")
                    )}
                </ConfigNotice>
            ) : null}

            <ol
                aria-label={t.flowLabel}
                className="bg-muted/60 grid gap-3 rounded-2xl px-4 py-3 sm:grid-cols-2 xl:grid-cols-4"
            >
                {flow.map((step, index) => (
                    <li key={step} className="space-y-0.5 text-sm">
                        <span
                            aria-hidden="true"
                            className="block text-xs font-semibold"
                        >
                            {index + 1}
                        </span>
                        <span className="block leading-5">{step}</span>
                    </li>
                ))}
            </ol>

            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
                <section
                    aria-labelledby="ticket-panel-title"
                    className="bg-card min-w-0 space-y-4 rounded-2xl border p-5 sm:p-6"
                >
                    <h2
                        id="ticket-panel-title"
                        className="text-base font-semibold"
                    >
                        {t.panelSection}
                    </h2>
                    <div className="space-y-2">
                        <Label htmlFor="ticket-panel-channel">
                            {t.panelChannel}
                        </Label>
                        <SettingsChannelPicker
                            id="ticket-panel-channel"
                            value={ticketSettings.submitChannelId || undefined}
                            onChange={(value) =>
                                patchTicketSettings({
                                    submitChannelId: value ?? "",
                                })
                            }
                            options={channelOptions(
                                metadata?.channels ?? [],
                                "text"
                            )}
                            kind="text"
                            placeholder={t.panelChannel}
                            loading={metadataState.status === "loading"}
                            unavailable={metadataState.status === "failed"}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="ticket-thread-channel">
                            {t.threadChannel}
                        </Label>
                        <SettingsChannelPicker
                            id="ticket-thread-channel"
                            value={
                                ticketSettings.ticketParentChannelId ||
                                undefined
                            }
                            onChange={(value) =>
                                patchTicketSettings({
                                    ticketParentChannelId: value ?? "",
                                })
                            }
                            options={channelOptions(
                                metadata?.channels ?? [],
                                "text",
                                "private-thread"
                            )}
                            kind="text"
                            placeholder={t.threadChannel}
                            loading={metadataState.status === "loading"}
                            unavailable={metadataState.status === "failed"}
                        />
                        {ticketSettings.ticketParentChannelId &&
                        metadata?.channels.some(
                            (channel) =>
                                channel.id ===
                                    ticketSettings.ticketParentChannelId &&
                                channel.type === 0
                        ) ? (
                            <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                                <Check
                                    className="size-3.5"
                                    aria-hidden="true"
                                />
                                {t.threadChannelOk}
                            </p>
                        ) : (
                            <p className="text-muted-foreground text-xs">
                                {t.threadChannelHint}
                            </p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="ticket-panel-heading">
                            {t.headingLabel}
                        </Label>
                        <Input
                            id="ticket-panel-heading"
                            value={ticketSettings.panelTitle}
                            onChange={(event) =>
                                patchTicketSettings({
                                    panelTitle: event.target.value,
                                })
                            }
                            maxLength={256}
                            placeholder={t.defaultPanelTitle}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="ticket-panel-text">{t.textLabel}</Label>
                        <Textarea
                            id="ticket-panel-text"
                            value={ticketSettings.panelDescription}
                            onChange={(event) =>
                                patchTicketSettings({
                                    panelDescription: event.target.value,
                                })
                            }
                            maxLength={4096}
                            rows={3}
                            className="rounded-lg"
                            placeholder={t.panelDescriptionPlaceholder}
                        />
                    </div>
                    <AvatarPicker
                        value={ticketSettings.panelImageUrl ?? ""}
                        onChange={(value) =>
                            patchTicketSettings({ panelImageUrl: value })
                        }
                        fallback="TK"
                        label={`${t.image} (${t.imageOptional})`}
                        buttonLabel={dictionary.common.upload}
                        disabled={isPending}
                        className="border-border/60 rounded-2xl border p-4"
                    />
                </section>

                <aside
                    aria-label={t.previewTitle}
                    className="min-w-0 space-y-2"
                >
                    <p className="text-sm font-semibold">{t.previewTitle}</p>
                    <div className="rounded-2xl bg-zinc-900 p-3 text-zinc-100 shadow-sm dark:bg-zinc-950">
                        <div className="space-y-3 rounded-lg border-l-4 border-amber-500 bg-zinc-800/80 p-4 text-sm">
                            <p className="text-base font-semibold break-words">
                                {ticketSettings.panelTitle ||
                                    t.defaultPanelTitle}
                            </p>
                            {ticketSettings.panelDescription ? (
                                <p className="line-clamp-6 text-[13px] leading-5 break-words whitespace-pre-wrap text-zinc-300">
                                    {ticketSettings.panelDescription}
                                </p>
                            ) : null}
                            {ticketSettings.categories.length ? (
                                <ul className="space-y-1.5 text-[13px] text-zinc-300">
                                    {ticketSettings.categories.map(
                                        (category) => (
                                            <li
                                                key={category.id}
                                                className="break-words"
                                            >
                                                <strong className="text-zinc-100">
                                                    {category.label?.trim() ||
                                                        t.untitledCategory}
                                                </strong>
                                                {category.description?.trim()
                                                    ? ` · ${category.description.trim()}`
                                                    : ""}
                                            </li>
                                        )
                                    )}
                                </ul>
                            ) : null}
                            {ticketSettings.categories.length ? (
                                <div className="flex flex-wrap gap-2">
                                    {ticketSettings.categories.map(
                                        (category) => (
                                            <span
                                                key={category.id}
                                                className="max-w-full truncate rounded bg-zinc-600 px-3 py-1.5 text-[13px] font-medium text-white"
                                            >
                                                {category.emoji &&
                                                !category.emoji.startsWith("<")
                                                    ? `${category.emoji} `
                                                    : ""}
                                                {category.label?.trim() ||
                                                    t.untitledCategory}
                                            </span>
                                        )
                                    )}
                                </div>
                            ) : null}
                        </div>
                    </div>
                </aside>
            </div>

            <section
                aria-labelledby="ticket-categories-title"
                className="bg-card space-y-3 rounded-2xl border pt-5 pb-2"
            >
                <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 sm:px-6">
                    <h2
                        id="ticket-categories-title"
                        className="text-base font-semibold"
                    >
                        {t.categoriesShort}
                    </h2>
                    <p
                        className={cn(
                            "text-xs",
                            categoryFieldPreview.tooLong
                                ? "text-destructive"
                                : "text-muted-foreground"
                        )}
                    >
                        {categoryFieldPreview.tooLong
                            ? `${t.embedLimitNotice} ${categoryFieldPreview.length}/${MAX_TICKET_CATEGORY_FIELD_LENGTH} ${t.embedLimitExceeded}`
                            : t.categoriesEditorNote}
                    </p>
                </div>
                {ticketSettings.categories.length === 0 ? (
                    <EmptyState
                        icon={Ticket}
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
                    <>
                        <div className="relative overflow-x-auto border-t">
                            <table className="w-full min-w-[32rem] text-left text-sm">
                                <thead className="bg-muted/40 text-xs">
                                    <tr>
                                        <th
                                            scope="col"
                                            className="px-5 py-2.5 font-semibold"
                                        >
                                            {t.columns.button}
                                        </th>
                                        <th
                                            scope="col"
                                            className="px-5 py-2.5 font-semibold"
                                        >
                                            {t.columns.handledBy}
                                        </th>
                                        <th
                                            scope="col"
                                            className="px-5 py-2.5 font-semibold"
                                        >
                                            {t.columns.questions}
                                        </th>
                                        <th
                                            scope="col"
                                            className="px-5 py-2.5 font-semibold"
                                        >
                                            <span className="sr-only">
                                                {t.columns.actions}
                                            </span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-border/60 divide-y">
                                    {ticketSettings.categories.map(
                                        (category) => {
                                            const open =
                                                editingId === category.id
                                            const label =
                                                category.label?.trim() ||
                                                t.untitledCategory
                                            return (
                                                <tr key={category.id}>
                                                    <th
                                                        scope="row"
                                                        className="px-5 py-3 font-normal break-words"
                                                    >
                                                        {category.emoji &&
                                                        !category.emoji.startsWith(
                                                            "<"
                                                        )
                                                            ? `${category.emoji} `
                                                            : ""}
                                                        {label}
                                                    </th>
                                                    <td className="px-5 py-3">
                                                        {category.supportRoleIds
                                                            .length ? (
                                                            <span className="flex flex-wrap gap-1">
                                                                {roleNames(
                                                                    category.supportRoleIds
                                                                ).map(
                                                                    (name) => (
                                                                        <span
                                                                            key={
                                                                                name
                                                                            }
                                                                            className="rounded-md border px-1.5 py-0.5 text-[13px]"
                                                                        >
                                                                            @
                                                                            {
                                                                                name
                                                                            }
                                                                        </span>
                                                                    )
                                                                )}
                                                            </span>
                                                        ) : (
                                                            <span className="text-amber-700 dark:text-amber-400">
                                                                {t.nobodyAdmins}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-3 tabular-nums">
                                                        {
                                                            category
                                                                .modalQuestions
                                                                .length
                                                        }
                                                    </td>
                                                    <td className="px-5 py-3 text-right">
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            className="rounded-lg"
                                                            aria-expanded={open}
                                                            aria-controls={`ticket-category-${category.id}`}
                                                            aria-label={`${open ? t.doneEditing : t.edit}: ${label}`}
                                                            onClick={() =>
                                                                setEditingId(
                                                                    open
                                                                        ? null
                                                                        : category.id
                                                                )
                                                            }
                                                        >
                                                            {open
                                                                ? t.doneEditing
                                                                : t.edit}
                                                        </Button>
                                                    </td>
                                                </tr>
                                            )
                                        }
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {ticketSettings.categories
                            .filter((category) => category.id === editingId)
                            .map((category) => (
                                <TicketCategoryEditor
                                    key={category.id}
                                    category={category}
                                    dictionary={dictionary}
                                    roles={roles}
                                    emojiOptions={emojiOptions}
                                    onChange={(patch) =>
                                        patchTicketCategory(category.id, patch)
                                    }
                                    onRemove={() => removeCategory(category.id)}
                                />
                            ))}
                        <div className="border-t px-3 pt-2">
                            <Button
                                type="button"
                                variant="ghost"
                                className="text-muted-foreground rounded-lg font-normal"
                                disabled={
                                    ticketSettings.categories.length >= 20
                                }
                                onClick={addCategory}
                            >
                                <Plus className="size-4" />
                                {t.addCategory}
                            </Button>
                        </div>
                    </>
                )}
            </section>

            <SettingsSaveBar
                note={t.saveNote}
                dirty={dirty}
                saving={saving || isPending}
                discardLabel={t.discard}
                saveLabel={t.saveAndRefresh}
                unsavedLabel={t.unsaved}
                onDiscard={() => {
                    setTicketSettings(initial)
                    setEditingId(null)
                }}
                onSave={() => void handleSave()}
            />
        </div>
    )
}

function TicketCategoryEditor({
    category,
    dictionary,
    roles,
    emojiOptions,
    onChange,
    onRemove,
}: {
    category: EditableTicketCategory
    dictionary: Dictionary
    roles: Array<{ id: string; name: string }>
    emojiOptions: Array<{ id: string; name: string }>
    onChange(patch: Partial<EditableTicketCategory>): void
    onRemove(): void
}) {
    const t = dictionary.ticketSettings
    const id = `ticket-category-${category.id}`
    return (
        <section
            id={id}
            aria-labelledby={`${id}-title`}
            className="border-border/60 bg-card space-y-5 rounded-2xl border p-4 sm:p-5"
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <h3
                    id={`${id}-title`}
                    className="min-w-0 text-base font-semibold break-words"
                >
                    {category.label?.trim() || t.untitledCategory}
                </h3>
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
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
                <div className="space-y-2">
                    <Label htmlFor={`${id}-label`}>{t.buttonText}</Label>
                    <Input
                        id={`${id}-label`}
                        value={category.label ?? ""}
                        onChange={(event) =>
                            onChange({ label: event.target.value })
                        }
                        placeholder={t.buttonTextPlaceholder}
                        maxLength={80}
                    />
                </div>
                <div className="space-y-2">
                    <Label>{t.emoji}</Label>
                    <EmojiPickerInput
                        value={category.emoji ?? ""}
                        onChange={(value) => onChange({ emoji: value ?? "" })}
                        customEmojis={emojiOptions}
                        placeholder={dictionary.emojiPicker.pickEmoji}
                        labels={dictionary.emojiPicker}
                    />
                </div>
            </div>
            <div className="space-y-2">
                <Label>{t.categoryDescription}</Label>
                <DiscordMarkdownTextarea
                    value={category.description ?? ""}
                    onChange={(value) => onChange({ description: value })}
                    maxLength={240}
                    rows={3}
                    height={120}
                    compactToolbar
                    preview="edit"
                    placeholder={t.categoryDescriptionPlaceholder}
                />
            </div>
            <div className="space-y-2">
                <Label>{t.columns.handledBy}</Label>
                <DiscordMultiEntitySelect
                    value={category.supportRoleIds}
                    onChange={(value) => onChange({ supportRoleIds: value })}
                    options={roles}
                    placeholder={t.supportRoles}
                />
                <p className="text-muted-foreground text-xs">
                    {t.routingInfoDescription}
                </p>
            </div>
            <ModalQuestionsEditor
                questions={category.modalQuestions}
                onChange={(modalQuestions) => onChange({ modalQuestions })}
                dictionary={dictionary}
                description={t.modalQuestionsDescription}
            />
        </section>
    )
}
