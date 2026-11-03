import { ClockArrowUp } from "lucide-react"

import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"

export function LateSignupBadge({
    label,
    reason,
}: {
    label: string
    reason: string
}) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span
                    tabIndex={0}
                    aria-label={`${label}: ${reason}`}
                    className="text-primary shrink-0"
                >
                    <ClockArrowUp className="size-3.5" aria-hidden="true" />
                </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-64 whitespace-pre-wrap">
                <span className="font-semibold">{label}</span>
                {": "}
                {reason}
            </TooltipContent>
        </Tooltip>
    )
}
