import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/** One titled block of a settings page (designs D4, G2, G3). */
export function SettingsPanel({
    id,
    title,
    description,
    actions,
    children,
    className,
}: {
    id: string
    title: ReactNode
    description?: ReactNode
    actions?: ReactNode
    children: ReactNode
    className?: string
}) {
    return (
        <section
            aria-labelledby={id}
            className={cn(
                "bg-card space-y-4 rounded-2xl border p-5 sm:p-6",
                className
            )}
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                    <h2 id={id} className="text-base font-semibold">
                        {title}
                    </h2>
                    {description ? (
                        <p className="text-muted-foreground text-sm">
                            {description}
                        </p>
                    ) : null}
                </div>
                {actions}
            </div>
            {children}
        </section>
    )
}

/**
 * A choice between a few options shown side by side (design D4 "Střídmé /
 * Emoji u každého řádku"). Arrow keys move the choice like native radios.
 */
export function SegmentedControl<T extends string>({
    label,
    labelledBy,
    value,
    options,
    onChange,
    className,
}: {
    label?: string
    labelledBy?: string
    value: T
    options: ReadonlyArray<{ value: T; label: string }>
    onChange: (value: T) => void
    className?: string
}) {
    function move(step: number) {
        const index = options.findIndex((option) => option.value === value)
        const next = options[(index + step + options.length) % options.length]
        if (next) onChange(next.value)
    }
    return (
        <div
            role="radiogroup"
            aria-label={label}
            aria-labelledby={labelledBy}
            className={cn(
                "bg-muted grid auto-cols-fr grid-flow-col gap-1 rounded-xl p-1",
                className
            )}
            onKeyDown={(event) => {
                if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                    event.preventDefault()
                    move(1)
                } else if (
                    event.key === "ArrowLeft" ||
                    event.key === "ArrowUp"
                ) {
                    event.preventDefault()
                    move(-1)
                }
            }}
        >
            {options.map((option) => {
                const checked = option.value === value
                return (
                    <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        tabIndex={checked ? 0 : -1}
                        onClick={() => onChange(option.value)}
                        className={cn(
                            "focus-visible:ring-ring/50 min-h-9 rounded-lg px-3 py-1.5 text-sm transition outline-none focus-visible:ring-[3px]",
                            checked
                                ? "bg-background font-semibold shadow-sm"
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

/** A setting with its label and help on the left and the control on the right. */
export function SettingsField({
    label,
    help,
    children,
}: {
    label: ReactNode
    help?: ReactNode
    children: ReactNode
}) {
    return (
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-start md:gap-6">
            <div className="min-w-0 space-y-1">
                <div className="text-sm font-medium">{label}</div>
                {help ? (
                    <div className="text-muted-foreground text-[13px] leading-5">
                        {help}
                    </div>
                ) : null}
            </div>
            <div className="min-w-0">{children}</div>
        </div>
    )
}
