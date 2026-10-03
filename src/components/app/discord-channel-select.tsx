"use client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useId, useState } from "react"
import { useLocale } from "next-intl"
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
}: {
    value?: string
    onChange(value?: string): void
    channels: SelectableDiscordChannel[]
    placeholder: string
    noneLabel?: string
    allowNone?: boolean
}) {
    const cs = useLocale() === "cs",
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
                    aria-label={
                        manual
                            ? cs
                                ? "ID místnosti"
                                : "Channel ID"
                            : cs
                              ? "Hledat místnost"
                              : "Search channels"
                    }
                    placeholder={
                        manual
                            ? cs
                                ? "Vložit ID místnosti"
                                : "Paste channel ID"
                            : cs
                              ? "Hledat název nebo ID"
                              : "Search name or ID"
                    }
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
                    {manual ? (cs ? "Seznam" : "List") : "ID"}
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
                            {value} · {cs ? "ověřit přístup" : "verify access"}
                        </option>
                    )}
                    {groups.map((group) => (
                        <optgroup
                            key={group}
                            label={
                                categories.get(group) ??
                                (cs ? "Bez kategorie" : "No category")
                            }
                        >
                            {matches
                                .filter((c) => (c.parentId ?? "") === group)
                                .map((c) => (
                                    <option
                                        key={c.id}
                                        value={c.id}
                                        disabled={![0, 5].includes(c.type)}
                                    >
                                        #{c.name}
                                        {![0, 5].includes(c.type)
                                            ? cs
                                                ? " · nepodporovaný typ"
                                                : " · unsupported type"
                                            : ""}
                                    </option>
                                ))}
                        </optgroup>
                    ))}
                </select>
            )}
            {manual && (
                <p className="text-muted-foreground text-xs">
                    {cs
                        ? "ID se při uložení ověří na tomto Discord serveru."
                        : "The ID is verified in this Discord server when saved."}
                </p>
            )}
        </div>
    )
}
