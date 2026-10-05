"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import {
    REMINDER_STATUSES,
    SIGNUP_STATUSES,
    defaultMatchTemplate,
    templateSchedule,
    type MatchTemplate,
    type MatchTemplateError,
} from "@/domain/events/match-templates"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { DiscordMultiEntitySelect } from "@/components/app/discord-multi-entity-select"
import type { DiscordSelectOption } from "@/components/app/discord-entity-select"
import { ConfirmActionDialog } from "@/components/app/confirm-action-dialog"
import type { EventCategory, Group, TopicPreset } from "@/types/domain"
import { GAME_LABELS, type GameId } from "@/domain/games/game"
import { EmptyState } from "@/components/app/empty-state"
import type { Dictionary } from "@/i18n/dictionaries"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const NONE = "__none"
const ALL_GAMES = "__all"
/** The example timeline shows a Sunday 20:00 start, as in the design. */
const EXAMPLE_START = "2026-10-11T20:00:00.000Z"

function Section({
    id,
    title,
    description,
    children,
}: {
    id: string
    title: string
    description?: string
    children: ReactNode
}) {
    return (
        <section
            aria-labelledby={id}
            className="border-border/60 space-y-4 rounded-2xl border p-4 sm:p-5"
        >
            <div className="space-y-1">
                <h2 id={id} className="text-base font-semibold">
                    {title}
                </h2>
                {description ? (
                    <p className="text-muted-foreground text-sm">
                        {description}
                    </p>
                ) : null}
            </div>
            {children}
        </section>
    )
}

function Row({
    label,
    hint,
    htmlFor,
    children,
}: {
    label: string
    hint?: string
    htmlFor?: string
    children: ReactNode
}) {
    return (
        <div className="grid gap-2 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] sm:items-start sm:gap-4">
            <div className="space-y-0.5 pt-1.5">
                <Label htmlFor={htmlFor} className="text-sm font-medium">
                    {label}
                </Label>
                {hint ? (
                    <p className="text-muted-foreground text-xs leading-snug">
                        {hint}
                    </p>
                ) : null}
            </div>
            <div className="min-w-0">{children}</div>
        </div>
    )
}

function Toggle({
    pressed,
    onClick,
    children,
}: {
    pressed: boolean
    onClick: () => void
    children: ReactNode
}) {
    return (
        <button
            type="button"
            aria-pressed={pressed}
            onClick={onClick}
            className={cn(
                "h-8 rounded-full border px-3 text-sm font-medium transition-colors",
                pressed
                    ? "border-foreground bg-muted text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
            )}
        >
            {children}
        </button>
    )
}

function NumberWithUnit({
    id,
    value,
    unit,
    min = 0,
    onChange,
}: {
    id: string
    value: number
    unit: string
    min?: number
    onChange: (value: number) => void
}) {
    return (
        <div className="flex items-center gap-2">
            <Input
                id={id}
                type="number"
                inputMode="numeric"
                min={min}
                step={1}
                value={Number.isFinite(value) ? value : ""}
                onChange={(event) =>
                    onChange(
                        Math.max(min, Math.trunc(Number(event.target.value)))
                    )
                }
                className="w-24 rounded-xl"
            />
            <span className="text-muted-foreground text-sm">{unit}</span>
        </div>
    )
}

function statusLabel(
    status: (typeof SIGNUP_STATUSES)[number],
    dictionary: Dictionary
) {
    switch (status) {
        case "member":
            return dictionary.userManagement.memberLabel
        case "recruit":
            return dictionary.userManagement.recruitLabel
        case "reserve_member":
            return dictionary.userManagement.reserveMemberLabel
        case "mercenary":
            return dictionary.userManagement.mercLabel
    }
}

function newTemplateId() {
    return `tpl_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`
}

/** Settings › Match templates (design D1): what a new match or training starts with. */
export function MatchTemplatesSettings({
    serverId,
    templates: savedTemplates,
    categories,
    groups,
    topicPresets,
    enabledGames,
    locale,
    dictionary,
}: {
    serverId: string
    templates: MatchTemplate[]
    categories: EventCategory[]
    groups: Group[]
    topicPresets: TopicPreset[]
    enabledGames: readonly GameId[]
    locale: string
    dictionary: Dictionary
}) {
    const text = dictionary.matchTemplates
    const router = useRouter()
    const [templates, setTemplates] = useState(savedTemplates)
    const [selectedId, setSelectedId] = useState(savedTemplates[0]?.id)
    const [saving, setSaving] = useState(false)
    const [roles, setRoles] = useState<DiscordSelectOption[]>([])
    const dirty = JSON.stringify(templates) !== JSON.stringify(savedTemplates)
    const selected = templates.find((template) => template.id === selectedId)

    useEffect(() => {
        fetch(`/api/servers/${serverId}/discord-metadata`)
            .then(async (response) => {
                const body = (await response.json()) as {
                    roles?: DiscordSelectOption[]
                }
                if (response.ok && Array.isArray(body.roles))
                    setRoles(body.roles)
            })
            .catch(() => setRoles([]))
    }, [serverId])

    function update(patch: Partial<MatchTemplate>) {
        if (!selected) return
        setTemplates((current) =>
            current.map((template) =>
                template.id === selected.id
                    ? { ...template, ...patch }
                    : template
            )
        )
    }

    function addTemplate() {
        const template = defaultMatchTemplate(newTemplateId(), text.newName)
        setTemplates((current) => [...current, template])
        setSelectedId(template.id)
    }

    function removeSelected() {
        if (!selected) return
        const remaining = templates.filter(
            (template) => template.id !== selected.id
        )
        setTemplates(remaining)
        setSelectedId(remaining[0]?.id)
    }

    async function save() {
        setSaving(true)
        try {
            const response = await fetch(
                `/api/servers/${serverId}/match-templates`,
                {
                    method: "PUT",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ templates }),
                }
            )
            const body = (await response.json().catch(() => null)) as {
                ok?: boolean
                error?: MatchTemplateError | string
                index?: number
                templates?: MatchTemplate[]
            } | null
            if (!response.ok || !body?.ok) {
                const reason =
                    body?.error && body.error in text.errors
                        ? text.errors[body.error as keyof typeof text.errors]
                        : response.status === 403
                          ? text.errors.forbidden
                          : text.errors.save_failed
                const name =
                    body?.index !== undefined
                        ? templates[body.index]?.name
                        : undefined
                toast.error(name ? `${name}: ${reason}` : reason)
                if (body?.index !== undefined && templates[body.index])
                    setSelectedId(templates[body.index].id)
                return
            }
            setTemplates(body.templates ?? templates)
            toast.success(text.saved)
            router.refresh()
        } finally {
            setSaving(false)
        }
    }

    const gameGroups = useMemo(
        () =>
            selected?.gameId
                ? groups.filter(
                      (group) =>
                          (group.gameId ?? "hell_let_loose") === selected.gameId
                  )
                : [],
        [groups, selected?.gameId]
    )
    const example = selected ? templateSchedule(selected, EXAMPLE_START) : null
    const exampleFormat = new Intl.DateTimeFormat(
        locale === "cs" ? "cs-CZ" : locale === "de" ? "de-DE" : "en-GB",
        {
            weekday: "short",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "UTC",
        }
    )
    const isMatch = selected?.kind === "match"

    return (
        <div className="space-y-6">
            <div
                role="group"
                aria-label={text.chooserLabel}
                className="flex flex-wrap gap-2"
            >
                {templates.map((template) => (
                    <button
                        key={template.id}
                        type="button"
                        aria-pressed={template.id === selectedId}
                        onClick={() => setSelectedId(template.id)}
                        className={cn(
                            "inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors",
                            template.id === selectedId
                                ? "border-foreground bg-muted"
                                : "border-border hover:bg-muted/60"
                        )}
                    >
                        {template.name}
                        <span className="text-muted-foreground text-xs font-normal">
                            {template.gameId
                                ? GAME_LABELS[template.gameId]
                                : text.allGames}
                        </span>
                    </button>
                ))}
                <Button
                    type="button"
                    variant="outline"
                    className="h-9 rounded-xl border-dashed"
                    onClick={addTemplate}
                >
                    <Plus className="size-4" aria-hidden="true" />
                    {text.add}
                </Button>
            </div>

            {!selected ? (
                <EmptyState
                    title={text.emptyTitle}
                    description={text.emptyDescription}
                    actions={
                        <Button
                            type="button"
                            className="rounded-xl"
                            onClick={addTemplate}
                        >
                            {text.add}
                        </Button>
                    }
                />
            ) : (
                <>
                    <Section id="tpl-basics" title={text.basics.title}>
                        <Row label={text.basics.name} htmlFor="tpl-name">
                            <Input
                                id="tpl-name"
                                value={selected.name}
                                maxLength={60}
                                onChange={(event) =>
                                    update({ name: event.target.value })
                                }
                                className="max-w-sm rounded-xl"
                            />
                        </Row>
                        <Row label={text.basics.kind}>
                            <div
                                role="radiogroup"
                                aria-label={text.basics.kind}
                                className="flex flex-wrap gap-2"
                            >
                                {(["match", "training"] as const).map(
                                    (kind) => (
                                        <button
                                            key={kind}
                                            type="button"
                                            role="radio"
                                            aria-checked={
                                                selected.kind === kind
                                            }
                                            onClick={() => update({ kind })}
                                            className={cn(
                                                "h-8 rounded-full border px-3 text-sm font-medium",
                                                selected.kind === kind
                                                    ? "border-foreground bg-muted"
                                                    : "border-border text-muted-foreground"
                                            )}
                                        >
                                            {kind === "match"
                                                ? text.basics.match
                                                : text.basics.training}
                                        </button>
                                    )
                                )}
                            </div>
                        </Row>
                        <Row label={text.basics.game}>
                            <Select
                                value={selected.gameId ?? ALL_GAMES}
                                onValueChange={(value) =>
                                    update({
                                        gameId:
                                            value === ALL_GAMES
                                                ? undefined
                                                : (value as GameId),
                                        signupGroupIds: undefined,
                                    })
                                }
                            >
                                <SelectTrigger
                                    className="w-full max-w-sm rounded-xl"
                                    aria-label={text.basics.game}
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL_GAMES}>
                                        {text.allGames}
                                    </SelectItem>
                                    {enabledGames.map((gameId) => (
                                        <SelectItem key={gameId} value={gameId}>
                                            {GAME_LABELS[gameId]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Row>
                        <Row
                            label={text.basics.category}
                            hint={text.basics.categoryHint}
                        >
                            <Select
                                value={selected.categoryId ?? NONE}
                                onValueChange={(value) =>
                                    update({
                                        categoryId:
                                            value === NONE ? undefined : value,
                                    })
                                }
                            >
                                <SelectTrigger
                                    className="w-full max-w-sm rounded-xl"
                                    aria-label={text.basics.category}
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={NONE}>
                                        {dictionary.shared.notSet}
                                    </SelectItem>
                                    {categories.map((category) => (
                                        <SelectItem
                                            key={category.id}
                                            value={category.id}
                                        >
                                            {category.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Row>
                        {isMatch ? (
                            <Row label={dictionary.event.topicPreset}>
                                <Select
                                    value={selected.topicPresetId ?? NONE}
                                    onValueChange={(value) =>
                                        update({
                                            topicPresetId:
                                                value === NONE
                                                    ? undefined
                                                    : value,
                                        })
                                    }
                                >
                                    <SelectTrigger
                                        className="w-full max-w-sm rounded-xl"
                                        aria-label={
                                            dictionary.event.topicPreset
                                        }
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={NONE}>
                                            {dictionary.event.noPreset}
                                        </SelectItem>
                                        {topicPresets.map((preset) => (
                                            <SelectItem
                                                key={preset.id}
                                                value={preset.id}
                                            >
                                                {preset.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Row>
                        ) : null}
                    </Section>

                    <Section id="tpl-times" title={text.times.title}>
                        <Row label={text.times.announcement}>
                            <div className="flex flex-wrap items-center gap-3">
                                <div
                                    role="radiogroup"
                                    aria-label={text.times.announcement}
                                    className="flex gap-2"
                                >
                                    <Toggle
                                        pressed={
                                            selected.announcementHoursBeforeStart ===
                                            undefined
                                        }
                                        onClick={() =>
                                            update({
                                                announcementHoursBeforeStart:
                                                    undefined,
                                            })
                                        }
                                    >
                                        {text.times.immediately}
                                    </Toggle>
                                    <Toggle
                                        pressed={
                                            selected.announcementHoursBeforeStart !==
                                            undefined
                                        }
                                        onClick={() =>
                                            update({
                                                announcementHoursBeforeStart:
                                                    selected.announcementHoursBeforeStart ??
                                                    72,
                                            })
                                        }
                                    >
                                        {text.times.scheduled}
                                    </Toggle>
                                </div>
                                {selected.announcementHoursBeforeStart !==
                                undefined ? (
                                    <NumberWithUnit
                                        id="tpl-announce"
                                        value={
                                            selected.announcementHoursBeforeStart
                                        }
                                        unit={text.times.hoursBeforeStart}
                                        onChange={(value) =>
                                            update({
                                                announcementHoursBeforeStart:
                                                    value,
                                            })
                                        }
                                    />
                                ) : null}
                            </div>
                        </Row>
                        <Row
                            label={text.times.registrationEnd}
                            htmlFor="tpl-reg"
                        >
                            <NumberWithUnit
                                id="tpl-reg"
                                value={selected.registrationHoursBeforeMeeting}
                                unit={text.times.hoursBeforeMeeting}
                                onChange={(value) =>
                                    update({
                                        registrationHoursBeforeMeeting: value,
                                    })
                                }
                            />
                        </Row>
                        {isMatch ? (
                            <Row label={text.times.meeting} htmlFor="tpl-meet">
                                <NumberWithUnit
                                    id="tpl-meet"
                                    value={selected.meetingMinutesBeforeStart}
                                    unit={text.times.minutesBeforeStart}
                                    onChange={(value) =>
                                        update({
                                            meetingMinutesBeforeStart: value,
                                        })
                                    }
                                />
                            </Row>
                        ) : null}
                        <Row label={text.times.duration} htmlFor="tpl-dur">
                            <NumberWithUnit
                                id="tpl-dur"
                                value={selected.durationMinutes}
                                unit={text.times.minutes}
                                min={1}
                                onChange={(value) =>
                                    update({ durationMinutes: value })
                                }
                            />
                        </Row>
                        {example ? (
                            <figure className="bg-muted/40 rounded-xl p-4">
                                <figcaption className="text-muted-foreground mb-3 text-xs font-medium">
                                    {text.times.exampleCaption}
                                </figcaption>
                                <ol className="grid gap-2 text-sm sm:grid-cols-5">
                                    {[
                                        {
                                            label: text.times.announcement,
                                            value: example.registrationStart
                                                ? exampleFormat.format(
                                                      new Date(
                                                          example.registrationStart
                                                      )
                                                  )
                                                : text.times.onPublish,
                                        },
                                        {
                                            label: text.times.registrationEnd,
                                            value: exampleFormat.format(
                                                new Date(
                                                    example.registrationEnd
                                                )
                                            ),
                                        },
                                        {
                                            label: text.times.meeting,
                                            value: exampleFormat.format(
                                                new Date(example.meetingStart)
                                            ),
                                        },
                                        {
                                            label: text.times.start,
                                            value: exampleFormat.format(
                                                new Date(example.gameStart)
                                            ),
                                        },
                                        {
                                            label: text.times.end,
                                            value: exampleFormat.format(
                                                new Date(example.gameEnd)
                                            ),
                                        },
                                    ].map((step) => (
                                        <li
                                            key={step.label}
                                            className="border-border/60 flex flex-col border-l-2 pl-3"
                                        >
                                            <span className="font-medium">
                                                {step.label}
                                            </span>
                                            <span className="text-muted-foreground">
                                                {step.value}
                                            </span>
                                        </li>
                                    ))}
                                </ol>
                            </figure>
                        ) : null}
                    </Section>

                    {isMatch ? (
                        <Section id="tpl-signup" title={text.signup.title}>
                            <Row
                                label={text.signup.who}
                                hint={text.signup.whoHint}
                            >
                                <div
                                    role="group"
                                    aria-label={text.signup.who}
                                    className="flex flex-wrap gap-2"
                                >
                                    {SIGNUP_STATUSES.map((status) => {
                                        const allowed =
                                            !selected.allowedSignupStatuses
                                                .length ||
                                            selected.allowedSignupStatuses.includes(
                                                status
                                            )
                                        return (
                                            <Toggle
                                                key={status}
                                                pressed={allowed}
                                                onClick={() => {
                                                    const current = selected
                                                        .allowedSignupStatuses
                                                        .length
                                                        ? selected.allowedSignupStatuses
                                                        : [...SIGNUP_STATUSES]
                                                    const next = allowed
                                                        ? current.filter(
                                                              (item) =>
                                                                  item !==
                                                                  status
                                                          )
                                                        : [...current, status]
                                                    update({
                                                        // Everyone allowed is stored as no restriction.
                                                        allowedSignupStatuses:
                                                            next.length ===
                                                                SIGNUP_STATUSES.length ||
                                                            !next.length
                                                                ? []
                                                                : next,
                                                    })
                                                }}
                                            >
                                                {statusLabel(
                                                    status,
                                                    dictionary
                                                )}
                                            </Toggle>
                                        )
                                    })}
                                </div>
                            </Row>
                            <Row
                                label={text.signup.groups}
                                hint={text.signup.groupsHint}
                            >
                                <div className="space-y-2">
                                    {selected.gameId ? (
                                        gameGroups.length ? (
                                            gameGroups.map((group) => {
                                                const checked =
                                                    !selected.signupGroupIds ||
                                                    selected.signupGroupIds.includes(
                                                        group.id
                                                    )
                                                return (
                                                    <label
                                                        key={group.id}
                                                        className="flex items-center gap-3 text-sm"
                                                    >
                                                        <Switch
                                                            checked={checked}
                                                            onCheckedChange={(
                                                                value
                                                            ) => {
                                                                const current =
                                                                    selected.signupGroupIds ??
                                                                    gameGroups.map(
                                                                        (
                                                                            item
                                                                        ) =>
                                                                            item.id
                                                                    )
                                                                update({
                                                                    signupGroupIds:
                                                                        value
                                                                            ? [
                                                                                  ...current,
                                                                                  group.id,
                                                                              ]
                                                                            : current.filter(
                                                                                  (
                                                                                      id
                                                                                  ) =>
                                                                                      id !==
                                                                                      group.id
                                                                              ),
                                                                })
                                                            }}
                                                        />
                                                        {group.name}
                                                    </label>
                                                )
                                            })
                                        ) : (
                                            <p className="text-muted-foreground text-sm">
                                                {text.signup.noGroups}
                                            </p>
                                        )
                                    ) : (
                                        <p className="text-muted-foreground text-sm">
                                            {text.signup.groupsAllGames}
                                        </p>
                                    )}
                                    <label className="flex items-center gap-3 text-sm">
                                        <Switch
                                            checked={selected.useGeneralSignup}
                                            onCheckedChange={(value) =>
                                                update({
                                                    useGeneralSignup: value,
                                                })
                                            }
                                        />
                                        {text.signup.general}
                                    </label>
                                </div>
                            </Row>
                            <Row
                                label={text.signup.reminder}
                                hint={
                                    dictionary.event
                                        .signupReminderStatusesDescription
                                }
                            >
                                <div
                                    role="group"
                                    aria-label={text.signup.reminder}
                                    className="flex flex-wrap gap-2"
                                >
                                    {REMINDER_STATUSES.map((status) => {
                                        const on =
                                            selected.signupReminderStatuses.includes(
                                                status
                                            )
                                        return (
                                            <Toggle
                                                key={status}
                                                pressed={on}
                                                onClick={() =>
                                                    update({
                                                        signupReminderStatuses:
                                                            on
                                                                ? selected.signupReminderStatuses.filter(
                                                                      (item) =>
                                                                          item !==
                                                                          status
                                                                  )
                                                                : [
                                                                      ...selected.signupReminderStatuses,
                                                                      status,
                                                                  ],
                                                    })
                                                }
                                            >
                                                {statusLabel(
                                                    status,
                                                    dictionary
                                                )}
                                            </Toggle>
                                        )
                                    })}
                                </div>
                            </Row>
                        </Section>
                    ) : null}

                    <Section id="tpl-discord" title={text.discord.title}>
                        <Row label={text.discord.ping}>
                            <div className="space-y-3">
                                <div
                                    role="radiogroup"
                                    aria-label={text.discord.ping}
                                    className="flex flex-wrap gap-2"
                                >
                                    {(["none", "clan", "roles"] as const).map(
                                        (mode) => (
                                            <button
                                                key={mode}
                                                type="button"
                                                role="radio"
                                                aria-checked={
                                                    selected.pingMode === mode
                                                }
                                                onClick={() =>
                                                    update({ pingMode: mode })
                                                }
                                                className={cn(
                                                    "h-8 rounded-full border px-3 text-sm font-medium",
                                                    selected.pingMode === mode
                                                        ? "border-foreground bg-muted"
                                                        : "border-border text-muted-foreground"
                                                )}
                                            >
                                                {mode === "none"
                                                    ? dictionary.event.pingNone
                                                    : mode === "clan"
                                                      ? dictionary.event
                                                            .pingClanOption
                                                      : dictionary.event
                                                            .pingRolesOption}
                                            </button>
                                        )
                                    )}
                                </div>
                                {selected.pingMode === "roles" ? (
                                    <DiscordMultiEntitySelect
                                        value={selected.pingRoleIds}
                                        onChange={(pingRoleIds) =>
                                            update({ pingRoleIds })
                                        }
                                        options={roles}
                                        placeholder={
                                            dictionary.event.fields.pingRoleIds
                                        }
                                    />
                                ) : null}
                            </div>
                        </Row>
                        <Row label={text.discord.create}>
                            <div className="space-y-3">
                                {isMatch ? (
                                    <label className="flex items-start gap-3 text-sm">
                                        <Switch
                                            checked={
                                                selected.createForumChannel
                                            }
                                            onCheckedChange={(value) =>
                                                update({
                                                    createForumChannel: value,
                                                })
                                            }
                                        />
                                        <span className="flex flex-col">
                                            <span className="font-medium">
                                                {text.discord.forum}
                                            </span>
                                            <span className="text-muted-foreground text-xs">
                                                {
                                                    dictionary.event
                                                        .createForumChannelDescription
                                                }
                                            </span>
                                        </span>
                                    </label>
                                ) : null}
                                <label className="flex items-start gap-3 text-sm">
                                    <Switch
                                        checked={
                                            selected.createSquadVoiceChannels
                                        }
                                        onCheckedChange={(value) =>
                                            update({
                                                createSquadVoiceChannels: value,
                                            })
                                        }
                                    />
                                    <span className="font-medium">
                                        {
                                            dictionary.event.fields
                                                .createSquadVoiceChannels
                                        }
                                    </span>
                                </label>
                            </div>
                        </Row>
                    </Section>
                </>
            )}

            <div
                className={cn(
                    "bg-background/95 border-border/60 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3 backdrop-blur",
                    // Unsaved changes keep the save bar in reach on larger screens.
                    dirty && "sm:sticky sm:bottom-0"
                )}
            >
                <span className="text-muted-foreground text-sm">
                    {text.appliesToNew}
                </span>
                <div className="flex flex-wrap gap-2">
                    {selected ? (
                        <ConfirmActionDialog
                            trigger={
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="text-destructive rounded-xl"
                                >
                                    <Trash2
                                        className="size-4"
                                        aria-hidden="true"
                                    />
                                    {text.remove}
                                </Button>
                            }
                            title={text.removeTitle.replace(
                                "{name}",
                                selected.name
                            )}
                            description={text.removeDescription}
                            confirmLabel={text.remove}
                            cancelLabel={dictionary.common.cancel}
                            onConfirm={removeSelected}
                        />
                    ) : null}
                    <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl"
                        disabled={!dirty || saving}
                        onClick={() => {
                            setTemplates(savedTemplates)
                            setSelectedId(savedTemplates[0]?.id)
                        }}
                    >
                        {text.discard}
                    </Button>
                    <Button
                        type="button"
                        className="rounded-xl"
                        disabled={!dirty || saving}
                        onClick={() => void save()}
                    >
                        {text.save}
                    </Button>
                </div>
            </div>
        </div>
    )
}
