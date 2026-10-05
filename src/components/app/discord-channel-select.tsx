"use client"
import {
    canUseChannelType,
    type ChannelPurpose,
} from "@/domain/discord-publications/channel-types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useTranslations } from "next-intl"
import { useId, useState } from "react"
export type SelectableDiscordChannel = {
    id: string
    name: string
    type: number
    parentId?: string
}
export function DiscordChannelSelect({
    value,
    onChange,
    channels,
    placeholder,
    noneLabel,
    allowNone = true,
    purpose = "publication",
}: {
    value?: string
    onChange(value?: string): void
    channels: SelectableDiscordChannel[]
    placeholder: string
    noneLabel?: string
    allowNone?: boolean
    purpose?: ChannelPurpose
}) {
    // The picker's own copy comes from the reader's dictionary
    // (settingsHub.channelPicker), so every caller is translated.
    const t = useTranslations("settingsHub.channelPicker"),
        controlId = useId()
    const [manual, setManual] = useState(false),
        [search, setSearch] = useState("")
    const categories = new Map(
        channels.filter((c) => c.type === 4).map((c) => [c.id, c.name])
    )
    const matches = channels.filter(
        (c) =>
            c.type !== 4 &&
            `${c.name} ${c.id}`.toLowerCase().includes(search.toLowerCase())
    )
    const groups = [...new Set(matches.map((c) => c.parentId ?? ""))]
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <label className="sr-only" htmlFor={controlId}>
                    {placeholder}
                </label>
                <Input
                    id={manual ? controlId : undefined}
                    aria-label={manual ? t("channelId") : t("search")}
                    placeholder={manual ? t("pasteId") : t("searchPlaceholder")}
                    value={manual ? (value ?? "") : search}
                    onChange={(e) =>
                        manual
                            ? onChange(e.target.value.trim() || undefined)
                            : setSearch(e.target.value)
                    }
                />
                <Button
                    variant="outline"
                    type="button"
                    onClick={() => setManual(!manual)}
                >
                    {manual ? t("showList") : t("enterId")}
                </Button>
            </div>
            {!manual && (
                <select
                    id={controlId}
                    aria-label={placeholder}
                    className="bg-background w-full rounded-lg border p-2"
                    value={value ?? ""}
                    onChange={(e) => onChange(e.target.value || undefined)}
                >
                    <option value="" disabled={!allowNone}>
                        {noneLabel ?? placeholder}
                    </option>
                    {value && !matches.some((c) => c.id === value) && (
                        <option value={value}>
                            {value} · {t("checkAccess")}
                        </option>
                    )}
                    {groups.map((group) => (
                        <optgroup
                            key={group}
                            label={categories.get(group) ?? t("noCategory")}
                        >
                            {matches
                                .filter((c) => (c.parentId ?? "") === group)
                                .map((c) => (
                                    <option
                                        key={c.id}
                                        value={c.id}
                                        disabled={
                                            !canUseChannelType(purpose, c.type)
                                        }
                                    >
                                        #{c.name}
                                        {!canUseChannelType(purpose, c.type)
                                            ? ` · ${t("unsupportedType")}`
                                            : ""}
                                    </option>
                                ))}
                        </optgroup>
                    ))}
                </select>
            )}
            {manual && (
                <p className="text-muted-foreground text-xs">
                    {t("manualHelp")}
                </p>
            )}
        </div>
    )
}
