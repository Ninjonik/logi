"use client"

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    DiscordChannelSelect,
    type SelectableDiscordChannel,
} from "@/components/app/discord-channel-select"
import type { EventDiscussionSettings } from "@/domain/events/discussion"
import type { Dictionary } from "@/i18n/dictionaries"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useId } from "react"

export function EventDiscussionFields({
    value,
    onChange,
    dictionary,
    channels,
    includeForum = false,
    includeDebriefForumChannel = true,
}: {
    value: EventDiscussionSettings
    onChange(value: EventDiscussionSettings): void
    dictionary: Dictionary
    channels: readonly SelectableDiscordChannel[]
    includeForum?: boolean
    includeDebriefForumChannel?: boolean
}) {
    const id = useId()
    const t = dictionary.newMatch.discord
    const enabled = value.createDebriefThread !== false
    const destination = value.debriefDestination ?? "private_thread"
    const update = (patch: EventDiscussionSettings) =>
        onChange({ ...value, ...patch })
    const toggle = (
        key:
            | "createForumChannel"
            | "createDebriefThread"
            | "deleteForumAfterConclusion",
        label: string,
        checked: boolean,
        disabled = false
    ) => (
        <div className="flex items-center gap-3">
            <Switch
                id={`${id}-${key}`}
                checked={checked}
                disabled={disabled}
                onCheckedChange={(checked) =>
                    update({
                        [key]: checked,
                        ...(key === "createDebriefThread" &&
                        checked &&
                        destination === "event_forum"
                            ? {
                                  createForumChannel: true,
                                  deleteForumAfterConclusion: false,
                              }
                            : {}),
                        ...(key === "createForumChannel" &&
                        !checked &&
                        destination === "event_forum"
                            ? { debriefDestination: "results_thread" as const }
                            : {}),
                    })
                }
            />
            <Label htmlFor={`${id}-${key}`}>{label}</Label>
        </div>
    )
    return (
        <div className="space-y-4">
            {includeForum
                ? toggle(
                      "createForumChannel",
                      t.forum,
                      value.createForumChannel ?? true
                  )
                : null}
            {includeForum ? (
                <p className="text-muted-foreground text-xs">
                    {t.discussionForumHint}
                </p>
            ) : null}
            {toggle("createDebriefThread", t.createDebriefThread, enabled)}
            {enabled ? (
                <>
                    <Label htmlFor={`${id}-destination`}>
                        {t.debriefDestination}
                    </Label>
                    <Select
                        value={destination}
                        onValueChange={(raw) => {
                            if (
                                raw !== "event_forum" &&
                                raw !== "results_thread" &&
                                raw !== "debrief_forum" &&
                                raw !== "private_thread"
                            )
                                return
                            const destination = raw
                            update({
                                debriefDestination: destination,
                                ...(destination === "event_forum"
                                    ? {
                                          createForumChannel: true,
                                          deleteForumAfterConclusion: false,
                                      }
                                    : {}),
                            })
                        }}
                    >
                        <SelectTrigger
                            id={`${id}-destination`}
                            className="w-full"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="event_forum">
                                {t.debriefEventForum}
                            </SelectItem>
                            <SelectItem value="results_thread">
                                {t.debriefResultsThread}
                            </SelectItem>
                            <SelectItem value="debrief_forum">
                                {t.debriefSeparateForum}
                            </SelectItem>
                            {destination === "private_thread" ? (
                                <SelectItem value="private_thread">
                                    {t.debriefLegacyPrivate}
                                </SelectItem>
                            ) : null}
                        </SelectContent>
                    </Select>
                    {destination === "results_thread" ? (
                        <p
                            role="note"
                            className="text-sm text-amber-700 dark:text-amber-400"
                        >
                            {t.debriefResultsWarning}
                        </p>
                    ) : null}
                    {destination === "debrief_forum" &&
                    includeDebriefForumChannel ? (
                        <div className="space-y-2">
                            <Label htmlFor={`${id}-forum`}>
                                {t.debriefForumChannel}
                            </Label>
                            <DiscordChannelSelect
                                id={`${id}-forum`}
                                value={value.debriefForumChannelId}
                                onChange={(id) =>
                                    update({ debriefForumChannelId: id ?? "" })
                                }
                                options={channels
                                    .filter((channel) => channel.type === 15)
                                    .map((channel) => ({
                                        id: channel.id,
                                        name: channel.name,
                                    }))}
                                placeholder={t.debriefForumChannel}
                            />
                        </div>
                    ) : null}
                </>
            ) : null}
            {value.createForumChannel
                ? toggle(
                      "deleteForumAfterConclusion",
                      t.deleteForumAfterConclusion,
                      value.deleteForumAfterConclusion ?? true,
                      enabled && destination === "event_forum"
                  )
                : null}
            <p className="text-muted-foreground text-xs">
                {t.createDebriefThreadHint}
            </p>
        </div>
    )
}
