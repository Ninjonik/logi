"use client"

import { useTranslations } from "next-intl"

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    canUseChannelType,
    type ChannelPurpose,
} from "@/domain/discord-publications/channel-types"
import type { SelectableDiscordChannel } from "@/components/app/discord-channel-select"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const NONE = "__none__"

export type ChannelKind = "text" | "category" | "voice"

/** The Discord channels a picker of this kind offers, by name. */
export function channelOptions(
    channels: readonly SelectableDiscordChannel[],
    kind: ChannelKind,
    purpose: ChannelPurpose = "publication"
) {
    return channels
        .filter((channel) =>
            kind === "category"
                ? channel.type === 4
                : kind === "voice"
                  ? channel.type === 2 || channel.type === 13
                  : canUseChannelType(purpose, channel.type)
        )
        .map((channel) => ({ id: channel.id, name: channel.name }))
}

/**
 * One Discord channel as a single dropdown (designs A2, F2). When the channel
 * list could not be loaded it becomes a field for the channel ID, so a setting
 * can still be changed.
 */
export function SettingsChannelPicker({
    id,
    value,
    onChange,
    options,
    kind,
    placeholder,
    noneLabel,
    loading = false,
    unavailable = false,
    attention = false,
    className,
}: {
    id?: string
    value?: string
    onChange(value?: string): void
    options: Array<{ id: string; name: string }>
    kind: ChannelKind
    placeholder: string
    /** Offered as the first entry to clear the setting. */
    noneLabel?: string
    loading?: boolean
    unavailable?: boolean
    /** A required setting that is still empty. */
    attention?: boolean
    className?: string
}) {
    const t = useTranslations("settingsHub.channelPicker")
    const triggerClass = cn(
        "w-full rounded-lg",
        attention &&
            "border-amber-400 ring-[3px] ring-amber-400/20 dark:border-amber-500/70",
        className
    )
    if (unavailable)
        return (
            <Input
                id={id}
                inputMode="numeric"
                aria-label={t("channelId")}
                placeholder={t("pasteId")}
                value={value ?? ""}
                onChange={(event) =>
                    onChange(event.target.value.trim() || undefined)
                }
                className={triggerClass}
            />
        )
    const prefix = kind === "text" ? "# " : ""
    const known = options.some((option) => option.id === value)
    return (
        <Select
            value={value ?? NONE}
            onValueChange={(next) => onChange(next === NONE ? undefined : next)}
            disabled={loading}
        >
            <SelectTrigger id={id} className={triggerClass}>
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value={NONE}>
                    <span className="text-muted-foreground">
                        {noneLabel ?? placeholder}
                    </span>
                </SelectItem>
                {value && !known ? (
                    <SelectItem value={value}>
                        {value} · {t("checkAccess")}
                    </SelectItem>
                ) : null}
                {options.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                        {prefix}
                        {option.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}
