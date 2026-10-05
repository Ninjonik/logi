"use client"

import { Lock } from "lucide-react"
import Image from "next/image"
import { useRef } from "react"
import Link from "next/link"

import {
    DEFAULT_PANEL_STYLE,
    PANEL_STYLES,
    type PanelStyle,
} from "@/domain/discord-publications/panel-graphics"
import { SettingsPanel } from "@/components/app/settings/settings-panel"
import type { Dictionary } from "@/i18n/dictionaries"
import { cn } from "@/lib/utils"

type Text = Dictionary["panelGraphicsPage"]["style"]

function Dots({ filled }: { filled: number }) {
    return (
        <span className="flex gap-[3px]">
            {Array.from({ length: 10 }, (_, index) => (
                <span
                    key={index}
                    className={cn(
                        "h-1.5 w-2 rounded-[2px]",
                        index < filled ? "bg-[#3ba55c]" : "bg-[#4e5058]"
                    )}
                />
            ))}
        </span>
    )
}

/** Small schematic of each style, as on the P8 board. */
function StyleThumbnail({ style }: { style: PanelStyle }) {
    const frame =
        "relative flex aspect-[16/7] w-full overflow-hidden rounded-lg border-l-[3px] border-[#e8a33d] bg-[#2b2d31]"
    if (style === "a")
        return (
            <span aria-hidden="true" className={frame}>
                <span className="absolute inset-x-2 top-2 bottom-7 overflow-hidden rounded">
                    <Image
                        src="/maps/foy.webp"
                        alt=""
                        fill
                        sizes="240px"
                        quality={70}
                        className="object-cover brightness-[0.55]"
                    />
                    <span className="absolute inset-0 flex items-center justify-end gap-1 pr-3 text-[11px] font-bold text-white">
                        ★ 3 : 2 ✚
                    </span>
                </span>
                <span className="absolute inset-x-2 bottom-4 h-1 rounded bg-[#4e5058]" />
                <span className="absolute bottom-2 left-2 h-1 w-2/3 rounded bg-[#4e5058]" />
            </span>
        )
    if (style === "b")
        return (
            <span aria-hidden="true" className={frame}>
                <span className="absolute inset-x-2 top-2 h-[45%] overflow-hidden rounded">
                    <Image
                        src="/maps/foy.webp"
                        alt=""
                        fill
                        sizes="240px"
                        quality={70}
                        className="object-cover"
                    />
                </span>
                <span className="absolute bottom-8 left-2 h-1 w-1/2 rounded bg-[#dbdee1]" />
                <span className="absolute bottom-5 left-2 h-1 w-3/5 rounded bg-[#4e5058]" />
                <span className="absolute bottom-2 left-2">
                    <Dots filled={6} />
                </span>
                <span className="absolute right-2 bottom-2 size-6 overflow-hidden rounded">
                    <Image
                        src="/maps/foy.webp"
                        alt=""
                        fill
                        sizes="48px"
                        quality={70}
                        className="object-cover"
                    />
                </span>
            </span>
        )
    return (
        <span aria-hidden="true" className={cn(frame, "flex-col gap-1.5 p-2")}>
            <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full border-2 border-[#3ba55c]" />
                <span className="h-1 w-3/5 rounded bg-[#dbdee1]" />
            </span>
            <span className="flex items-center gap-1.5">
                <span className="text-[9px] leading-none text-white">★</span>
                <span className="h-1 w-2/5 rounded bg-[#4e5058]" />
                <span className="text-[9px] leading-none text-white">✚</span>
            </span>
            <Dots filled={7} />
        </span>
    )
}

/**
 * "Styl panelu" (P8-03..05): the clan's default style as three radio cards.
 * "Výchozí" marks Logi's own default (style A); the selected card is the
 * clan's choice.
 */
export function PanelStylePicker({
    value,
    onChange,
    editorHref,
    text,
}: {
    value: PanelStyle
    onChange(style: PanelStyle): void
    editorHref: string
    text: Text
}) {
    const refs = useRef<Array<HTMLButtonElement | null>>([])
    function move(from: number, step: number) {
        const index = (from + step + PANEL_STYLES.length) % PANEL_STYLES.length
        onChange(PANEL_STYLES[index]!)
        refs.current[index]?.focus()
    }
    return (
        <SettingsPanel
            id="panel-graphics-style"
            title={text.title}
            description={text.description}
        >
            <div className="space-y-2.5">
                <p
                    id="panel-graphics-default-style"
                    className="text-sm font-semibold"
                >
                    {text.defaultLabel}
                </p>
                <div
                    role="radiogroup"
                    aria-labelledby="panel-graphics-default-style"
                    className="grid grid-cols-1 gap-3 md:grid-cols-3"
                >
                    {PANEL_STYLES.map((style, index) => {
                        const checked = value === style
                        return (
                            <button
                                key={style}
                                ref={(element) => {
                                    refs.current[index] = element
                                }}
                                type="button"
                                role="radio"
                                aria-checked={checked}
                                tabIndex={checked ? 0 : -1}
                                onClick={() => onChange(style)}
                                onKeyDown={(event) => {
                                    if (
                                        event.key === "ArrowRight" ||
                                        event.key === "ArrowDown"
                                    ) {
                                        event.preventDefault()
                                        move(index, 1)
                                    } else if (
                                        event.key === "ArrowLeft" ||
                                        event.key === "ArrowUp"
                                    ) {
                                        event.preventDefault()
                                        move(index, -1)
                                    }
                                }}
                                className={cn(
                                    "bg-card focus-visible:ring-ring/50 flex flex-col gap-2.5 rounded-xl border p-3 text-left transition outline-none focus-visible:ring-[3px]",
                                    checked
                                        ? "border-foreground border-2 p-[11px]"
                                        : "hover:border-foreground/40"
                                )}
                            >
                                <StyleThumbnail style={style} />
                                <span className="text-sm font-semibold">
                                    {text.options[style].title}
                                </span>
                                {style === DEFAULT_PANEL_STYLE ? (
                                    <span className="-mt-1 w-fit rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-200">
                                        {text.logiDefault}
                                    </span>
                                ) : null}
                                <span className="text-muted-foreground text-[13px] leading-5">
                                    {text.options[style].description}
                                </span>
                            </button>
                        )
                    })}
                </div>
            </div>
            <p className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
                <Lock className="size-3.5 shrink-0" aria-hidden="true" />
                {text.perPanel}{" "}
                <Link
                    href={editorHref}
                    className="text-foreground underline underline-offset-4"
                >
                    {text.perPanelLink}
                </Link>
            </p>
        </SettingsPanel>
    )
}
