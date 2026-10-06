import type { ReactNode } from "react"

/**
 * A block of the "Grafika panelů" page. Like `SettingsPanel`, with the
 * status chip on the title row and the description under both, as on the P8
 * board ("Obrázky map … 1 vlastní", "Ikony frakcí … Nahráno do Discordu").
 */
export function GraphicsPanel({
    id,
    title,
    description,
    chip,
    children,
}: {
    id: string
    title: string
    description: string
    chip?: ReactNode
    children: ReactNode
}) {
    return (
        <section
            aria-labelledby={id}
            className="bg-card space-y-4 rounded-2xl border p-5 sm:p-6"
        >
            <div className="space-y-1">
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
                    <h2 id={id} className="text-base font-semibold">
                        {title}
                    </h2>
                    {chip}
                </div>
                <p className="text-muted-foreground text-sm">{description}</p>
            </div>
            {children}
        </section>
    )
}
