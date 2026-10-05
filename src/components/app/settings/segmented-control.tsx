"use client"

import { useRef } from "react"

import { cn } from "@/lib/utils"

/**
 * A choice of a few options shown side by side (designs F1, G4). Arrow keys
 * move between the options like a radio group.
 */
export function SegmentedControl<T extends string>({
    value,
    onChange,
    options,
    labelledBy,
    label,
    disabled = false,
    className,
}: {
    value: T
    onChange(value: T): void
    options: ReadonlyArray<{ value: T; label: string }>
    labelledBy?: string
    label?: string
    disabled?: boolean
    className?: string
}) {
    const refs = useRef<Array<HTMLButtonElement | null>>([])
    function move(from: number, step: number) {
        const index = (from + step + options.length) % options.length
        onChange(options[index]!.value)
        refs.current[index]?.focus()
    }
    return (
        <div
            role="radiogroup"
            aria-labelledby={labelledBy}
            aria-label={label}
            className={cn(
                "bg-muted flex w-full gap-1 rounded-lg p-1",
                className
            )}
        >
            {options.map((option, index) => {
                const checked = option.value === value
                return (
                    <button
                        key={option.value}
                        ref={(element) => {
                            refs.current[index] = element
                        }}
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        tabIndex={checked ? 0 : -1}
                        disabled={disabled}
                        onClick={() => onChange(option.value)}
                        onKeyDown={(event) => {
                            if (
                                event.key === "ArrowRight" ||
                                event.key === "ArrowDown"
                            ) {
                                event.preventDefault()
                                move(index, 1)
                            } else if (
                                event.key === "ArrowLeft" ||
                                event.key === "ArrowUp"
                            ) {
                                event.preventDefault()
                                move(index, -1)
                            }
                        }}
                        className={cn(
                            "focus-visible:ring-ring/50 min-h-8 flex-1 rounded-md px-3 py-1 text-sm leading-tight transition-colors focus-visible:ring-[3px] focus-visible:outline-none disabled:opacity-50",
                            checked
                                ? "bg-background text-foreground font-semibold shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {option.label}
                    </button>
                )
            })}
        </div>
    )
}
