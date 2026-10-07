"use client"

import { Hash, Plus, X } from "lucide-react"
import { useState } from "react"

import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export type ChannelOption = { id: string; name: string }

const chipClass =
    "inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[13px]"

/**
 * Discord channels as removable "# name" chips with a "+ Kanál" button that
 * opens a searchable list (N3-11). Saved channels Discord no longer lists
 * stay visible by ID so saving never drops them silently.
 */
export function ChannelChips({
    value,
    onChange,
    channels,
    labels,
    disabled = false,
}: {
    value: string[]
    onChange(value: string[]): void
    channels: ChannelOption[] | null
    labels: {
        add: string
        addAria: string
        remove: (name: string) => string
        search: string
        empty: string
    }
    disabled?: boolean
}) {
    const [open, setOpen] = useState(false)
    const known = channels ?? []
    const name = (channelId: string) =>
        known.find((channel) => channel.id === channelId)?.name ?? channelId
    const available = known.filter((channel) => !value.includes(channel.id))
    return (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {value.map((channelId) => (
                <span
                    key={channelId}
                    className={cn(chipClass, "bg-background")}
                >
                    <Hash
                        className="text-muted-foreground size-3"
                        aria-hidden="true"
                    />
                    {name(channelId)}
                    <button
                        type="button"
                        disabled={disabled}
                        className="text-muted-foreground hover:text-foreground -mr-0.5 rounded-sm p-0.5"
                        aria-label={labels.remove(name(channelId))}
                        onClick={() =>
                            onChange(value.filter((id) => id !== channelId))
                        }
                    >
                        <X className="size-3" aria-hidden="true" />
                    </button>
                </span>
            ))}
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        disabled={disabled || !channels}
                        aria-label={labels.addAria}
                        className={cn(
                            chipClass,
                            "text-muted-foreground hover:text-foreground hover:border-foreground/30 border-dashed disabled:opacity-50"
                        )}
                    >
                        <Plus className="size-3" aria-hidden="true" />
                        {labels.add}
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0" align="start">
                    <Command>
                        <CommandInput placeholder={labels.search} />
                        <CommandList>
                            <CommandEmpty>{labels.empty}</CommandEmpty>
                            <CommandGroup>
                                {available.map((channel) => (
                                    <CommandItem
                                        key={channel.id}
                                        value={`${channel.name} ${channel.id}`}
                                        onSelect={() => {
                                            onChange([...value, channel.id])
                                            setOpen(false)
                                        }}
                                    >
                                        # {channel.name}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    )
}
