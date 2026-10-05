import { ChevronDown, X } from "lucide-react"

import type { ApplicationFieldModel } from "@/domain/membership/application-fields"

/**
 * A faithful mock of one application window as Discord shows it (N4-25):
 * the modal title, each field's label with the red required star, its
 * description, the text input or select with its placeholder or chosen
 * values, and Discord's own "Zrušit" and "Odeslat". Discord's modals are
 * not message components, so the message preview cannot draw them.
 */
export function WindowPreview({
    title,
    fields,
    labels,
}: {
    title: string
    fields: readonly ApplicationFieldModel[]
    labels: { region: string; close: string; cancel: string; submit: string }
}) {
    return (
        <section
            aria-label={labels.region}
            className="rounded-2xl bg-[#111214] p-3 text-[#dbdee1] sm:p-4"
        >
            <div className="overflow-hidden rounded-xl bg-[#313338] shadow-lg">
                <div className="flex items-start gap-3 px-4 pt-4 pb-2">
                    <span
                        aria-hidden="true"
                        className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[#1e1f22] text-[10px] font-bold text-white"
                    >
                        L
                    </span>
                    <h4 className="min-w-0 flex-1 text-lg leading-snug font-bold break-words text-[#f2f3f5]">
                        {title}
                    </h4>
                    <span
                        aria-label={labels.close}
                        role="img"
                        className="text-[#b5bac1]"
                    >
                        <X className="size-5" aria-hidden="true" />
                    </span>
                </div>
                <div className="space-y-4 px-4 pt-2 pb-4">
                    {fields.map((field) => (
                        <div key={field.id} className="space-y-1.5">
                            <p className="text-sm font-semibold text-[#f2f3f5]">
                                {field.label}
                                {field.required ? (
                                    <span
                                        aria-hidden="true"
                                        className="ml-1 text-[#f23f43]"
                                    >
                                        *
                                    </span>
                                ) : null}
                            </p>
                            {field.description ? (
                                <p className="text-xs text-[#b5bac1]">
                                    {field.description}
                                </p>
                            ) : null}
                            <FieldControlPreview field={field} />
                        </div>
                    ))}
                </div>
                <div className="flex items-center justify-end gap-4 bg-[#2b2d31] px-4 py-3">
                    <span className="text-sm text-[#f2f3f5]">
                        {labels.cancel}
                    </span>
                    <span className="rounded-[3px] bg-[#5865f2] px-4 py-2 text-sm font-medium text-white">
                        {labels.submit}
                    </span>
                </div>
            </div>
        </section>
    )
}

function FieldControlPreview({ field }: { field: ApplicationFieldModel }) {
    const control = field.control
    const box =
        "flex w-full items-center rounded-[3px] bg-[#1e1f22] px-3 text-sm"
    if (control.kind === "text")
        return (
            <div
                className={`${box} ${control.paragraph ? "min-h-16 items-start py-2" : "min-h-10"}`}
            >
                {control.value ? (
                    <span className="text-[#dbdee1]">{control.value}</span>
                ) : (
                    <span className="text-[#87898c]">
                        {control.placeholder ?? ""}
                    </span>
                )}
            </div>
        )
    const chosen =
        control.kind === "select"
            ? control.options
                  .filter((option) => control.values.includes(option.value))
                  .map((option) => option.label)
                  .join(", ")
            : ""
    return (
        <div className={`${box} min-h-10 justify-between gap-2`}>
            <span className={chosen ? "text-[#dbdee1]" : "text-[#87898c]"}>
                {chosen || control.placeholder}
            </span>
            <ChevronDown
                className="size-4 shrink-0 text-[#b5bac1]"
                aria-hidden="true"
            />
        </div>
    )
}
