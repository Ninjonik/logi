import type { ReactNode } from "react"

/** A numbered step on a settings page whose parts build on each other. */
export function SettingsStep({
    id,
    number,
    title,
    children,
}: {
    id: string
    number: number
    title: string
    children: ReactNode
}) {
    return (
        <section
            aria-labelledby={id}
            className="border-border/60 bg-card space-y-4 rounded-2xl border p-4 sm:p-5"
        >
            <div className="flex items-center gap-3">
                <span
                    aria-hidden="true"
                    className="bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                >
                    {number}
                </span>
                <h2 id={id} className="text-base font-semibold">
                    {title}
                </h2>
            </div>
            {children}
        </section>
    )
}
