"use client"

import { useState, type ReactNode } from "react"
import { Plus, X } from "lucide-react"

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

export type RoleOption = { id: string; name: string }

const chipClass =
    "inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[13px]"

/** A fixed role shown beside the editable ones, such as the clan role. */
export function FixedRoleChip({
    children,
    tone = "muted",
}: {
    children: ReactNode
    tone?: "muted" | "attention"
}) {
    return (
        <span
            className={cn(
                chipClass,
                tone === "attention"
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200"
                    : "bg-muted text-muted-foreground border-transparent"
            )}
        >
            {children}
        </span>
    )
}

/**
 * Discord roles as removable chips with a "+ role" button that opens a
 * searchable list (designs F1, G5). Saved roles Discord no longer lists stay
 * visible by ID so saving never drops them silently.
 */
export function RoleChips({
    value,
    onChange,
    roles,
    labels,
    leading,
    disabled = false,
}: {
    value: string[]
    onChange(value: string[]): void
    roles: RoleOption[] | null
    labels: {
        add: string
        addAria: string
        remove: (name: string) => string
        search: string
        empty: string
    }
    /** Chips shown before the editable roles. */
    leading?: ReactNode
    disabled?: boolean
}) {
    const [open, setOpen] = useState(false)
    const known = roles ?? []
    const name = (roleId: string) =>
        known.find((role) => role.id === roleId)?.name ?? roleId
    const available = known.filter((role) => !value.includes(role.id))
    return (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {leading}
            {value.map((roleId) => (
                <span key={roleId} className={cn(chipClass, "bg-background")}>
                    @{name(roleId)}
                    <button
                        type="button"
                        disabled={disabled}
                        className="text-muted-foreground hover:text-foreground -mr-0.5 rounded-sm p-0.5"
                        aria-label={labels.remove(name(roleId))}
                        onClick={() =>
                            onChange(value.filter((id) => id !== roleId))
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
                        disabled={disabled || !roles}
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
                                {available.map((role) => (
                                    <CommandItem
                                        key={role.id}
                                        value={`${role.name} ${role.id}`}
                                        onSelect={() => {
                                            onChange([...value, role.id])
                                            setOpen(false)
                                        }}
                                    >
                                        @{role.name}
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
