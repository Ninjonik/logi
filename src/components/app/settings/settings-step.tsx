import type { ReactNode } from "react"

/** A numbered step on a settings page whose parts build on each other (design G5). */
export function SettingsStep({
    id,
    number,
    title,
    actions,
    children,
}: {
    id: string
    number: number
    title: string
    /** Shown on the right of the step title, such as "New key". */
    actions?: ReactNode
    children: ReactNode
}) {
    return (
        <section
            id={id}
            aria-labelledby={`${id}-title`}
            className="bg-card scroll-mt-6 space-y-4 rounded-2xl border p-5 sm:p-6"
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span
                        aria-hidden="true"
                        className="bg-primary text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                    >
                        {number}
                    </span>
                    <h2 id={`${id}-title`} className="text-base font-semibold">
                        {title}
                    </h2>
                </div>
                {actions}
            </div>
            {children}
        </section>
    )
}
