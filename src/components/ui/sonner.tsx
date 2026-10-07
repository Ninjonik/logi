"use client"

import {
    CircleAlert,
    CircleCheck,
    Info,
    Loader2,
    TriangleAlert,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { useTheme } from "@/hooks/use-theme"

/*
 * Notices after saving (design K4): a card with a coloured icon, the result
 * in bold and an optional sentence on what happens next; failures get a red
 * outline. Follows the app's own theme provider.
 */
const Toaster = ({ ...props }: ToasterProps) => {
    const { theme } = useTheme()

    return (
        <Sonner
            theme={theme as ToasterProps["theme"]}
            className="toaster group"
            style={
                {
                    "--normal-bg": "var(--popover)",
                    "--normal-text": "var(--popover-foreground)",
                    "--normal-border": "var(--border)",
                } as React.CSSProperties
            }
            icons={{
                success: (
                    <CircleCheck className="text-status-success size-[18px]" />
                ),
                error: (
                    <CircleAlert className="text-status-danger size-[18px]" />
                ),
                warning: (
                    <TriangleAlert className="text-status-warning size-[18px]" />
                ),
                info: <Info className="text-status-info size-[18px]" />,
                loading: (
                    <Loader2 className="text-muted-foreground size-[18px] animate-spin" />
                ),
            }}
            toastOptions={{
                classNames: {
                    toast: "items-start! gap-2.5! rounded-xl! px-4! py-3.5! shadow-[0_8px_24px_rgba(0,0,0,0.08)]! font-sans!",
                    icon: "mt-px! size-[18px]! shrink-0",
                    title: "text-sm! leading-5! font-semibold!",
                    description:
                        "text-muted-foreground! text-[13px]! leading-5!",
                    error: "border-status-danger-border!",
                },
            }}
            position={"top-right"}
            {...props}
        />
    )
}

export { Toaster }
