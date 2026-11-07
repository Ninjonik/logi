"use client"

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    sharedMatchSettingsSchema,
    type SharedMatchSettings,
} from "@/lib/validation/shared-match-settings"
import {
    toDateTimeLocalInTimeZone,
    fromDateTimeLocalInTimeZone,
} from "@/lib/timezone-datetime"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DiscordMultiEntitySelect } from "./discord-multi-entity-select"
import type { EventRecord, Group, TopicPreset } from "@/types/domain"
import { configureSharedMatch } from "@/lib/gateways/shared-matches"
import type { NewMatchMetadata } from "./new-match/new-match-flow"
import { EventDiscussionFields } from "./event-discussion-fields"
import { useEffect, useId, useState, useTransition } from "react"
import { DiscordChannelSelect } from "./discord-channel-select"
import type { Dictionary } from "@/i18n/dictionaries"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import Link from "next/link"

export function SharedMatchSettingsForm({
    serverId,
    event,
    dictionary,
    groups,
    topicPresets,
    backHref,
    timeZone = "UTC",
}: {
    serverId: string
    event: EventRecord
    dictionary: Dictionary
    groups: Group[]
    topicPresets: TopicPreset[]
    backHref: string
    timeZone?: string
}) {
    const router = useRouter()
    const id = useId()
    const [pending, start] = useTransition()
    const [metadata, setMetadata] = useState<NewMatchMetadata | null>(null)
    const [value, setValue] = useState<SharedMatchSettings>(() =>
        sharedMatchSettingsSchema.parse({
            ...Object.fromEntries(
                Object.keys(sharedMatchSettingsSchema.shape).map((key) => [
                    key,
                    event[key as keyof EventRecord],
                ])
            ),
            attendanceReminderHours: event.attendanceReminderHours ?? [
                24, 18, 12, 6,
            ],
            signupGroupLimits: event.signupGroupLimits ?? [],
            createParticipantRoles: event.createParticipantRoles !== false,
        })
    )
    useEffect(() => {
        const controller = new AbortController()
        void fetch(`/api/servers/${serverId}/discord-metadata`, {
            signal: controller.signal,
        })
            .then(async (response) => {
                if (!response.ok) throw new Error()
                setMetadata(await response.json())
            })
            .catch(() => undefined)
        return () => controller.abort()
    }, [serverId])
    const update = (patch: Partial<SharedMatchSettings>) =>
        setValue((current) => ({ ...current, ...patch }))
    const t = dictionary.newMatch
    const toggle = (
        key:
            | "createSignupThread"
            | "createParticipantRoles"
            | "createSquadVoiceChannels"
            | "allowNonMembersSignup"
            | "useGeneralSignup",
        label: string
    ) => (
        <div className="flex items-center gap-3" key={key}>
            <Switch
                id={`${id}-${key}`}
                checked={value[key]}
                onCheckedChange={(checked) => update({ [key]: checked })}
            />
            <Label htmlFor={`${id}-${key}`}>{label}</Label>
        </div>
    )
    return (
        <div className="mx-auto w-full max-w-3xl space-y-5 px-4 pb-8">
            <div>
                <h1 className="text-2xl font-semibold">
                    {dictionary.sharedMatches.localSettings}
                </h1>
                <p className="text-muted-foreground">
                    {dictionary.sharedMatches.hostedBy.replace(
                        "{name}",
                        event.hostClanName ?? ""
                    )}{" "}
                    · {dictionary.sharedMatches.sharedDetails}
                </p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>{t.steps.discord}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                    <div className="space-y-2">
                        <Label htmlFor={`${id}-registration-start`}>
                            {dictionary.sharedMatches.registrationStart} (
                            {timeZone})
                        </Label>
                        <Input
                            id={`${id}-registration-start`}
                            type="datetime-local"
                            value={toDateTimeLocalInTimeZone(
                                value.registrationStart,
                                timeZone
                            )}
                            onChange={(e) =>
                                update({
                                    registrationStart: e.target.value
                                        ? fromDateTimeLocalInTimeZone(
                                              e.target.value,
                                              timeZone
                                          )
                                        : undefined,
                                })
                            }
                        />
                        <p className="text-muted-foreground text-sm">
                            {dictionary.sharedMatches.registrationStartHelp}
                        </p>
                    </div>
                    {(
                        [
                            [
                                "announcementChannelId",
                                t.discord.announcement,
                                "text",
                            ],
                            ["eventInfoChannelId", t.discord.roster, "text"],
                            [
                                "eventResultsChannelId",
                                t.discord.results,
                                "text",
                            ],
                            [
                                "meetingChannelId",
                                t.discord.meetingChannel,
                                "voice",
                            ],
                            [
                                "squadVoiceCategoryId",
                                t.discord.voiceCategory,
                                "category",
                            ],
                        ] as const
                    ).map(([key, label, kind]) => (
                        <div key={key} className="space-y-2">
                            <Label htmlFor={`${id}-${key}`}>{label}</Label>
                            <DiscordChannelSelect
                                id={`${id}-${key}`}
                                channels={metadata?.channels}
                                loading={!metadata}
                                value={value[key]}
                                kind={kind}
                                placeholder={t.discord.defaultChannel}
                                onChange={(channel) =>
                                    update({ [key]: channel })
                                }
                            />
                        </div>
                    ))}
                    <div className="space-y-2">
                        <Label>{t.discord.ping}</Label>
                        <Select
                            value={value.pingMode}
                            onValueChange={(mode) => {
                                if (
                                    mode === "none" ||
                                    mode === "clan" ||
                                    mode === "roles"
                                )
                                    update({ pingMode: mode })
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">
                                    {t.discord.pingNone}
                                </SelectItem>
                                <SelectItem value="clan">
                                    {t.discord.pingClan}
                                </SelectItem>
                                <SelectItem value="roles">
                                    {t.discord.pingRoles}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {value.pingMode === "roles" ? (
                        <DiscordMultiEntitySelect
                            value={value.pingRoleIds}
                            onChange={(ids) => update({ pingRoleIds: ids })}
                            options={metadata?.roles ?? []}
                            placeholder={t.discord.pingRolesLabel}
                        />
                    ) : null}
                    <div className="space-y-2">
                        <Label>{dictionary.rosterPublish.contentLabel}</Label>
                        <Select
                            value={
                                value.localRosterMessageVariant ?? "__default"
                            }
                            onValueChange={(variant) =>
                                update({
                                    localRosterMessageVariant:
                                        variant === "photo" ||
                                        variant === "photo_text"
                                            ? variant
                                            : undefined,
                                })
                            }
                        >
                            <SelectTrigger
                                aria-label={
                                    dictionary.rosterPublish.contentLabel
                                }
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__default">
                                    {t.discord.discussionInherit}
                                </SelectItem>
                                <SelectItem value="photo_text">
                                    {dictionary.rosterPublish.variantPhotoText}
                                </SelectItem>
                                <SelectItem value="photo">
                                    {dictionary.rosterPublish.variantPhoto}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        <div className="flex items-center gap-3">
                            <Switch
                                id={`${id}-roster-mention`}
                                checked={
                                    value.localRosterMentionPlayers ?? false
                                }
                                onCheckedChange={(checked) =>
                                    update({
                                        localRosterMentionPlayers: checked,
                                    })
                                }
                            />
                            <Label htmlFor={`${id}-roster-mention`}>
                                {dictionary.rosterPublish.mentionLabel}
                            </Label>
                        </div>
                    </div>
                    <EventDiscussionFields
                        value={value}
                        onChange={update}
                        dictionary={dictionary}
                        channels={metadata?.channels ?? []}
                        includeForum
                    />
                    {toggle("createSignupThread", t.discord.signupThread)}
                    {toggle(
                        "createParticipantRoles",
                        t.discord.participantRoles
                    )}
                    {toggle("createSquadVoiceChannels", t.discord.voice)}
                    <Select
                        value={value.topicPresetId || "__none"}
                        onValueChange={(id) =>
                            update({
                                topicPresetId: id === "__none" ? undefined : id,
                            })
                        }
                    >
                        <SelectTrigger aria-label={t.discord.topicPreset}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__none">
                                {t.discord.topicPresetNone}
                            </SelectItem>
                            {topicPresets.map((preset) => (
                                <SelectItem key={preset.id} value={preset.id}>
                                    {preset.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>{t.steps.signups}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                    {toggle("allowNonMembersSignup", t.signups.nonMembers)}
                    {toggle("useGeneralSignup", t.signups.general)}
                    <div className="space-y-2">
                        <Label>{t.signups.who}</Label>
                        <DiscordMultiEntitySelect
                            value={value.allowedSignupStatuses}
                            options={Object.entries(t.signups.statuses).map(
                                ([id, name]) => ({ id, name })
                            )}
                            placeholder={t.signups.who}
                            onChange={(ids) =>
                                update({
                                    allowedSignupStatuses: ids.filter(
                                        (
                                            status
                                        ): status is SharedMatchSettings["allowedSignupStatuses"][number] =>
                                            [
                                                "recruit",
                                                "member",
                                                "reserve_member",
                                                "mercenary",
                                            ].includes(status)
                                    ),
                                })
                            }
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>{t.signups.requiredRoles}</Label>
                        <DiscordMultiEntitySelect
                            value={value.requiredRoleIds}
                            options={metadata?.roles ?? []}
                            placeholder={t.signups.rolesPlaceholder}
                            onChange={(ids) => update({ requiredRoleIds: ids })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>{dictionary.event.fields.signupGroupIds}</Label>
                        <DiscordMultiEntitySelect
                            value={value.signupGroupIds}
                            options={groups.map((group) => ({
                                id: group.id,
                                name: group.name,
                            }))}
                            placeholder={dictionary.event.fields.signupGroupIds}
                            onChange={(ids) =>
                                update({
                                    signupGroupIds: ids,
                                    signupGroupLimits:
                                        value.signupGroupLimits.filter((item) =>
                                            ids.includes(item.groupId)
                                        ),
                                })
                            }
                        />
                    </div>
                    {groups
                        .filter((group) =>
                            value.signupGroupIds.includes(group.id)
                        )
                        .map((group) => (
                            <div
                                key={group.id}
                                className="flex items-center justify-between gap-3"
                            >
                                <Label htmlFor={`${id}-cap-${group.id}`}>
                                    {t.signups.capLabel.replace(
                                        "{name}",
                                        group.name
                                    )}
                                </Label>
                                <Input
                                    id={`${id}-cap-${group.id}`}
                                    className="w-24"
                                    type="number"
                                    min={1}
                                    max={500}
                                    placeholder={t.signups.noLimit}
                                    value={
                                        value.signupGroupLimits.find(
                                            (item) => item.groupId === group.id
                                        )?.max ?? ""
                                    }
                                    onChange={(event) =>
                                        update({
                                            signupGroupLimits: [
                                                ...value.signupGroupLimits.filter(
                                                    (item) =>
                                                        item.groupId !==
                                                        group.id
                                                ),
                                                ...(event.target.value
                                                    ? [
                                                          {
                                                              groupId: group.id,
                                                              max: Number(
                                                                  event.target
                                                                      .value
                                                              ),
                                                          },
                                                      ]
                                                    : []),
                                            ],
                                        })
                                    }
                                />
                            </div>
                        ))}
                    <div className="space-y-2">
                        <Label>{t.signups.reminder}</Label>
                        <DiscordMultiEntitySelect
                            value={value.signupReminderStatuses}
                            options={Object.entries(t.signups.statuses)
                                .filter(([id]) => id !== "mercenary")
                                .map(([id, name]) => ({ id, name }))}
                            placeholder={t.signups.reminderOptions.off}
                            onChange={(ids) =>
                                update({
                                    signupReminderStatuses: ids.filter(
                                        (
                                            status
                                        ): status is SharedMatchSettings["signupReminderStatuses"][number] =>
                                            [
                                                "recruit",
                                                "member",
                                                "reserve_member",
                                            ].includes(status)
                                    ),
                                })
                            }
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>{t.signups.attendanceReminders}</Label>
                        <DiscordMultiEntitySelect
                            value={value.attendanceReminderHours.map(String)}
                            options={[24, 18, 12, 6].map((hour) => ({
                                id: String(hour),
                                name: t.signups.attendanceHour.replace(
                                    "{hours}",
                                    String(hour)
                                ),
                            }))}
                            placeholder={t.signups.reminderOptions.off}
                            onChange={(hours) =>
                                update({
                                    attendanceReminderHours: hours.map(Number),
                                })
                            }
                        />
                    </div>
                </CardContent>
            </Card>
            <div className="flex justify-end gap-2">
                <Button asChild variant="outline">
                    <Link href={backHref}>{dictionary.common.cancel}</Link>
                </Button>
                <Button
                    disabled={pending}
                    onClick={() =>
                        start(async () => {
                            try {
                                await configureSharedMatch(
                                    serverId,
                                    event.id,
                                    value
                                )
                                toast.success(dictionary.sharedMatches.saved)
                                router.push(backHref)
                                router.refresh()
                            } catch (error) {
                                toast.error(
                                    error instanceof Error
                                        ? error.message
                                        : dictionary.sharedMatches.error
                                )
                            }
                        })
                    }
                >
                    {dictionary.common.save}
                </Button>
            </div>
        </div>
    )
}
