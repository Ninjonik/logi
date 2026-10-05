import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * A validation message under the field it belongs to (design K4), not only in
 * a toast. Give the field `aria-invalid` and `aria-describedby` with this id.
 */
export function FieldError({
    id,
    children,
    className,
}: {
    id: string
    children?: ReactNode
    className?: string
}) {
    if (!children) return null
    return (
        <p
            id={id}
            role="alert"
            className={cn("text-status-danger text-[13px]", className)}
        >
            {children}
        </p>
    )
}
