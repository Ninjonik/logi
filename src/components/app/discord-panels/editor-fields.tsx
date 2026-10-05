"use client"

import { useId, type ReactNode } from "react"

import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

/** A switch with its label and one help line (board P2 "Co ukázat"). */
export function SwitchRow({
    label,
    help,
    checked,
    disabled,
    onChange,
    children,
}: {
    label: string
    help?: ReactNode
    checked: boolean
    disabled?: boolean
    onChange: (checked: boolean) => void
    /** Fields under the switch, indented with the label. */
    children?: ReactNode
}) {
    const id = useId()
    return (
        <div className="space-y-2">
            <div className="flex items-start gap-3">
                <Switch
                    id={id}
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={onChange}
                    aria-describedby={help ? `${id}-help` : undefined}
                    className="mt-0.5"
                />
                <div className="min-w-0">
                    <label
                        htmlFor={id}
                        className={cn(
                            "text-sm",
                            disabled && "text-muted-foreground"
                        )}
                    >
                        {label}
                    </label>
                    {help ? (
                        <p
                            id={`${id}-help`}
                            className="text-muted-foreground text-xs"
                        >
                            {help}
                        </p>
                    ) : null}
                </div>
            </div>
            {children ? (
                <div className="space-y-2 pl-12">{children}</div>
            ) : null}
        </div>
    )
}

/** A small uppercase-free section title inside a step ("Co ukázat", "Připojení"). */
export function StepSection({
    title,
    children,
    divided = false,
}: {
    title: string
    children: ReactNode
    divided?: boolean
}) {
    return (
        <div className={cn("space-y-3", divided && "border-t pt-4")}>
            <h3 className="text-[13px] font-semibold">{title}</h3>
            {children}
        </div>
    )
}

/** A labelled control with a help line underneath. */
export function Field({
    label,
    htmlFor,
    help,
    error,
    children,
}: {
    label: ReactNode
    htmlFor?: string
    help?: ReactNode
    error?: string | null
    children: ReactNode
}) {
    return (
        <div className="space-y-1.5">
            {htmlFor ? (
                <label htmlFor={htmlFor} className="block text-sm">
                    {label}
                </label>
            ) : (
                <div className="text-sm">{label}</div>
            )}
            {children}
            {error ? (
                <p role="alert" className="text-destructive text-xs">
                    {error}
                </p>
            ) : help ? (
                <p className="text-muted-foreground text-xs">{help}</p>
            ) : null}
        </div>
    )
}

/** A grey note box ("Kanál vidí všichni…", league note). */
export function Note({
    icon,
    tone = "muted",
    children,
}: {
    icon?: ReactNode
    tone?: "muted" | "success" | "warning" | "danger"
    children: ReactNode
}) {
    return (
        <div
            className={cn(
                "flex items-start gap-2 rounded-lg px-3 py-2 text-xs",
                tone === "muted" && "bg-muted/70 text-foreground/80",
                tone === "success" &&
                    "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
                tone === "warning" &&
                    "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
                tone === "danger" &&
                    "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200"
            )}
        >
            {icon ? <span className="mt-px shrink-0">{icon}</span> : null}
            <div className="min-w-0">{children}</div>
        </div>
    )
}
