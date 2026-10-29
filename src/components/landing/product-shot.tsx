"use client"

import { Expand } from "lucide-react"
import { cn } from "@/lib/utils"
import Image from "next/image"

export const LANDING_SHOTS = {
    overview: { width: 1440, height: 900 },
    event: { width: 1045, height: 810 },
    roster: { width: 1045, height: 810 },
    performance: { width: 1045, height: 490 },
    calendar: { width: 1440, height: 1100 },
} as const
export type LandingShot = keyof typeof LANDING_SHOTS
export type ShotView = {
    src: string
    title: string
    width: number
    height: number
}

export function ProductShot({
    shot,
    title,
    zoomLabel,
    onOpen,
    className,
    priority = false,
}: {
    shot: LandingShot
    title: string
    zoomLabel: string
    onOpen: (view: ShotView) => void
    className?: string
    priority?: boolean
}) {
    const size = LANDING_SHOTS[shot]
    const asset = shot === "calendar" ? "calendar-month" : shot
    return (
        <button
            type="button"
            onClick={() => {
                // Use the applied theme, including the system theme, just as the visible images do.
                const theme = document.documentElement.classList.contains(
                    "dark"
                )
                    ? "dark"
                    : "light"
                onOpen({
                    src: `/images/landing/${asset}-${theme}.jpg`,
                    title,
                    ...size,
                })
            }}
            aria-label={`${zoomLabel}: ${title}`}
            className={cn(
                "group/shot relative block w-full cursor-zoom-in overflow-hidden rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-4",
                className
            )}
        >
            <Image
                src={`/images/landing/${asset}-light.jpg`}
                alt={title}
                {...size}
                sizes="(max-width: 768px) 100vw, 1100px"
                quality={85}
                preload={priority}
                className="block h-auto w-full dark:hidden"
            />
            <Image
                src={`/images/landing/${asset}-dark.jpg`}
                alt={title}
                {...size}
                sizes="(max-width: 768px) 100vw, 1100px"
                quality={85}
                loading={priority ? "eager" : "lazy"}
                className="hidden h-auto w-full dark:block"
            />
            <span
                aria-hidden
                className="absolute right-3 bottom-3 flex size-8 items-center justify-center rounded-lg border border-white/20 bg-black/60 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover/shot:opacity-100 group-focus-visible/shot:opacity-100"
            >
                <Expand className="size-4" />
            </span>
        </button>
    )
}
