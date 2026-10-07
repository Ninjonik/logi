import { Lock } from "lucide-react"

import {
    HLL_NATIONS,
    HLL_NATION_SVG,
    PANEL_STATE_SVG,
    PANEL_SERVER_STATES,
    PLAYER_GAUGE_COLORS,
    PLAYER_GAUGE_PIECES,
    WARDOGS_SIGNS,
    wardogsSignPath,
} from "@/domain/discord-publications/panel-emblems"
import { playerGauge } from "@/domain/discord-publications/panel-graphics"
import type { PanelGraphicsPageData } from "@/lib/panel-graphics-view"
import type { Dictionary } from "@/i18n/dictionaries"
import { cn } from "@/lib/utils"

import { GraphicsPanel } from "./graphics-panel"
import { fill } from "./panel-graphics-state"

type Text = Dictionary["panelGraphicsPage"]

const svgSource = (svg: string) =>
    `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`

/** "Nahráno do Discordu ✓ · 12 emoji", amber while the bot still uploads. */
export function EmojiStatusChip({
    group,
    text,
}: {
    group: PanelGraphicsPageData["emoji"]["faction"]
    text: Text["factions"]
}) {
    return (
        <span
            className={cn(
                "inline-flex h-6 items-center rounded-full border px-2.5 text-xs font-medium",
                group.complete
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100"
            )}
        >
            {group.complete
                ? fill(text.uploaded, { count: group.total })
                : fill(text.pending, {
                      ready: group.ready,
                      total: group.total,
                  })}
        </span>
    )
}

function Sign({
    icon,
    name,
    hint,
    dark = false,
}: {
    icon: string
    name: string
    hint: string
    dark?: boolean
}) {
    return (
        <li className="flex min-w-0 items-center gap-2.5">
            <span
                className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg",
                    dark && "bg-[#2b2d31]"
                )}
            >
                {/* eslint-disable-next-line @next/next/no-img-element -- fixed packaged icons and inline SVG */}
                <img src={icon} alt="" className="size-7" />
            </span>
            <span className="min-w-0">
                <span className="block text-sm font-medium">{name}</span>
                <span className="text-muted-foreground block text-xs leading-4">
                    {hint}
                </span>
            </span>
        </li>
    )
}

/** "Ikony frakcí" (P8-20..23): 8 Logi nation signs and 4 Wardogs icons. */
export function FactionIconsSection({
    emoji,
    text,
}: {
    emoji: PanelGraphicsPageData["emoji"]
    text: Text["factions"]
}) {
    return (
        <GraphicsPanel
            id="panel-graphics-factions"
            title={text.title}
            description={text.description}
            chip={<EmojiStatusChip group={emoji.faction} text={text} />}
        >
            <div className="space-y-2.5">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold">{text.hllTitle}</span>
                    <span className="bg-muted rounded-full border px-2 py-0.5">
                        {text.hllChip}
                    </span>
                </div>
                <ul
                    aria-label={text.hllTitle}
                    className="grid grid-cols-1 gap-x-4 gap-y-3 min-[420px]:grid-cols-2 lg:grid-cols-4"
                >
                    {HLL_NATIONS.map((nation) => (
                        <Sign
                            key={nation}
                            icon={svgSource(HLL_NATION_SVG[nation])}
                            name={text.nations[nation].name}
                            hint={text.nations[nation].side}
                        />
                    ))}
                </ul>
            </div>
            <div className="space-y-2.5">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold">{text.wardogsTitle}</span>
                    <span className="bg-muted rounded-full border px-2 py-0.5">
                        {text.wardogsChip}
                    </span>
                    <span className="text-muted-foreground">
                        {text.wardogsHint}
                    </span>
                </div>
                <ul
                    aria-label={text.wardogsTitle}
                    className="grid grid-cols-1 gap-x-4 gap-y-3 min-[420px]:grid-cols-2 lg:grid-cols-4"
                >
                    {WARDOGS_SIGNS.map((sign) => (
                        <Sign
                            key={sign}
                            dark
                            icon={wardogsSignPath(sign)}
                            name={text.wardogs[sign].name}
                            hint={text.wardogs[sign].role}
                        />
                    ))}
                </ul>
            </div>
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <Lock className="size-3.5 shrink-0" aria-hidden="true" />
                {text.note}
            </p>
        </GraphicsPanel>
    )
}

function GaugePiece({
    piece,
}: {
    piece: (typeof PLAYER_GAUGE_PIECES)[number]
}) {
    return (
        <span
            aria-hidden="true"
            className="inline-block h-2.5 w-3.5 shrink-0 rounded-[3px]"
            style={{ background: PLAYER_GAUGE_COLORS[piece] }}
        />
    )
}

function GaugeSample({
    players,
    capacity,
    queue,
    caption,
    label,
}: {
    players: number
    capacity: number
    queue?: number
    caption: string
    label: string
}) {
    const gauge = playerGauge({ players, capacity, queue })
    if (!gauge) return null
    return (
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-[#dbdee1]">
            <span
                role="img"
                aria-label={label}
                className="flex items-center gap-0.5"
            >
                {gauge.segments.map((piece, index) => (
                    <GaugePiece key={index} piece={piece} />
                ))}
                {gauge.queue ? (
                    <span className="ml-1.5 flex gap-0.5">
                        {Array.from({ length: gauge.queue }, (_, index) => (
                            <GaugePiece key={index} piece="queue" />
                        ))}
                    </span>
                ) : null}
            </span>
            <span>{caption}</span>
        </div>
    )
}

/** "Stavové ikony a ukazatel hráčů" (P8-24..27). */
export function StatusIconsSection({
    emoji,
    text,
    factionsText,
    sample,
}: {
    emoji: PanelGraphicsPageData["emoji"]
    text: Text["status"]
    factionsText: Text["factions"]
    /** Captions in the dashboard language: "78 / 100 · fronta 3", "12 / 100 · seed do 40". */
    sample: { queue: string; seed: string }
}) {
    const tile =
        "flex min-h-14 items-center gap-3 rounded-xl bg-[#2b2d31] px-3.5 py-2.5 text-[#f2f3f5]"
    return (
        <GraphicsPanel
            id="panel-graphics-status"
            title={text.title}
            description={text.description}
            chip={<EmojiStatusChip group={emoji.status} text={factionsText} />}
        >
            <ul className="grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-2 lg:grid-cols-4">
                {PANEL_SERVER_STATES.map((state) => (
                    <li key={state} className={tile}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- fixed inline SVG */}
                        <img
                            src={svgSource(PANEL_STATE_SVG[state])}
                            alt=""
                            className="size-6 shrink-0"
                        />
                        <span className="min-w-0">
                            <span className="block text-sm font-semibold">
                                {text.states[state].name}
                            </span>
                            <span className="block text-xs leading-4 text-[#b5bac1]">
                                {text.states[state].hint}
                            </span>
                        </span>
                    </li>
                ))}
                {PLAYER_GAUGE_PIECES.map((piece) => (
                    <li key={piece} className={tile}>
                        <GaugePiece piece={piece} />
                        <span className="min-w-0">
                            <span className="block text-sm font-semibold">
                                {text.gauge[piece].name}
                            </span>
                            {text.gauge[piece].hint ? (
                                <span className="block text-xs leading-4 text-[#b5bac1]">
                                    {text.gauge[piece].hint}
                                </span>
                            ) : null}
                        </span>
                    </li>
                ))}
            </ul>
            <div className="space-y-2 rounded-xl bg-[#2b2d31] px-3.5 py-3">
                <p className="text-xs font-semibold tracking-[0.06em] text-[#b5bac1] uppercase">
                    {text.sample}
                </p>
                <GaugeSample
                    players={78}
                    capacity={100}
                    queue={3}
                    caption={sample.queue}
                    label={fill(text.sampleQueue, {
                        count: 78,
                        capacity: 100,
                        queue: 3,
                    })}
                />
                <GaugeSample
                    players={12}
                    capacity={100}
                    caption={sample.seed}
                    label={fill(text.sampleSeed, {
                        count: 12,
                        capacity: 100,
                        target: 40,
                    })}
                />
            </div>
        </GraphicsPanel>
    )
}
