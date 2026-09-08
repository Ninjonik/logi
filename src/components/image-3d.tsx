"use client"

import { cn } from "@/lib/utils"
import Image from "next/image"

interface Image3DProps {
    lightSrc: string
    darkSrc: string
    alt: string
    className?: string
    direction?: "left" | "right"
}

export function Image3D({
    lightSrc,
    darkSrc,
    alt,
    className,
    direction = "left",
}: Image3DProps) {
    const isRight = direction === "right"

    return (
        <div className={cn("group relative aspect-[4/3] w-full", className)}>
            <div className="perspective-distant transform-3d">
                {/* Animated background glow */}
                <div className="from-primary/10 absolute rounded-3xl bg-gradient-to-r via-blue-500/10 to-purple-500/10 opacity-0 blur-2xl transition-all duration-1000 group-hover:opacity-100 sm:-inset-8" />

                {/* Main 3D container */}
                <div className="relative size-full transition-all duration-700 ease-out transform-3d group-hover:translate-z-16 group-hover:rotate-x-8 group-hover:rotate-y-12">
                    {/* Depth layers for 3D effect */}
                    <div className="absolute inset-0 translate-x-2 translate-y-4 -translate-z-8 rounded-2xl">
                        <div className="from-primary/10 via-background/40 to-secondary/10 size-full rounded-2xl bg-gradient-to-br shadow-xl" />
                    </div>

                    {/* Main image container */}
                    <div className="shadow-primary/20 relative z-10 size-full overflow-hidden rounded-2xl shadow-2xl">
                        {/* Shimmer effect */}
                        <div
                            className={cn(
                                "pointer-events-none absolute inset-0 z-20 -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-1000 ease-out",
                                isRight
                                    ? "translate-x-full group-hover:-translate-x-full"
                                    : "-translate-x-full group-hover:translate-x-full"
                            )}
                        />

                        {/* Content fade mask */}
                        <div
                            className={cn(
                                "pointer-events-none absolute inset-0 z-15",
                                isRight
                                    ? "from-background via-background/85 bg-linear-to-l from-0% via-15% to-transparent to-40%"
                                    : "from-background via-background/85 bg-linear-to-r from-0% via-15% to-transparent to-40%"
                            )}
                        />

                        {/* Theme-aware images */}
                        <Image
                            src={lightSrc}
                            alt={`${alt} - Light Mode`}
                            width={800}
                            height={600}
                            className={cn(
                                "block size-full object-cover transition-transform duration-700 group-hover:scale-105 dark:hidden",
                                isRight ? "object-center" : "object-left"
                            )}
                            loading="lazy"
                        />

                        <Image
                            src={darkSrc}
                            alt={`${alt} - Dark Mode`}
                            width={800}
                            height={600}
                            className={cn(
                                "hidden size-full object-cover transition-transform duration-700 group-hover:scale-105 dark:block",
                                isRight ? "object-center" : "object-left"
                            )}
                            loading="lazy"
                        />

                        {/* Border highlight */}
                        <div className="group-hover:ring-primary/40 absolute inset-0 rounded-2xl ring-1 ring-white/20 transition-all duration-500 dark:ring-white/10" />
                    </div>
                </div>
            </div>
        </div>
    )
}
