/* eslint-disable @next/next/no-img-element -- Satori draws plain <img> elements; next/image does not exist in an image response. */
import type { CSSProperties, ReactElement } from "react"

import {
    formatPanelNumber,
    hllLeaderNation,
    panelImageFocus,
    panelImageSeedTarget,
    panelImageStateWord,
    type HllScoreImage,
    type PanelBannerImage,
    type PanelScoreImage,
    type WardogsScoreImage,
} from "@/domain/discord-publications/panel-image-model"
import {
    HLL_SIDE_COLORS,
    PANEL_STATE_COLORS,
    type HllNation,
    type PanelServerState,
    type WardogsFaction,
} from "@/domain/discord-publications/panel-emblems"
import {
    factionBars,
    hllScoreKind,
    minutesLeft,
    SCORE_IMAGE_HEIGHT,
    SCORE_IMAGE_WIDTH,
} from "@/domain/discord-publications/panel-graphics"
import {
    SEED_PROGRESS_SEGMENTS,
    seedProgress,
} from "@/domain/discord-seed/progress"
import { panelImageCopy } from "@/domain/discord-publications/panel-image-copy"

/**
 * Style A score image and style B banner as Satori layouts (P7 board,
 * 1200 × 400). Pure: the renderer loads images and fonts and passes them in
 * as data URLs, so the layout never reads files or the network.
 */

export type PanelImageArt = {
    /** Prepared background (already cropped, and darkened for the score image). */
    background: string | null
    nations: Partial<Record<HllNation, string>>
    factions: Partial<Record<WardogsFaction, string>>
}

const STATE_FILL: Record<PanelServerState, string> = {
    live: "rgba(59,165,92,0.22)",
    seeding: "rgba(240,178,50,0.22)",
    empty: "rgba(128,132,142,0.22)",
    offline: "rgba(237,66,69,0.22)",
}
const font = "Inter"
const muted = "#b5bac1"
const nowrap: CSSProperties = {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
}
/** Code-point safe truncation; Satori ellipsis needs a bounded box, this keeps lines short too. */
function cut(value: string, max: number) {
    const chars = Array.from(value)
    return chars.length > max ? `${chars.slice(0, max - 1).join("")}…` : value
}
function stamp(model: PanelScoreImage) {
    const copy = panelImageCopy(model.language)
    const time = new Intl.DateTimeFormat(copy.locale, {
        timeZone: model.timeZone,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
    }).format(new Date(model.renderedAt))
    return copy.stamp(time)
}

function Frame(props: {
    background: string | null
    overlay: string
    children: ReactElement | ReactElement[]
}) {
    return (
        <div
            style={{
                display: "flex",
                position: "relative",
                width: SCORE_IMAGE_WIDTH,
                height: SCORE_IMAGE_HEIGHT,
                background: "#0e1116",
                fontFamily: font,
                color: "#ffffff",
                lineHeight: 1.2,
            }}
        >
            {props.background ? (
                <img
                    alt=""
                    src={props.background}
                    width={SCORE_IMAGE_WIDTH}
                    height={SCORE_IMAGE_HEIGHT}
                    style={{ position: "absolute", left: 0, top: 0 }}
                />
            ) : null}
            <div
                style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: SCORE_IMAGE_WIDTH,
                    height: SCORE_IMAGE_HEIGHT,
                    backgroundImage: props.overlay,
                }}
            />
            {props.children}
        </div>
    )
}

function Chip(props: { label: string; color: string; fill: string }) {
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "4px 14px",
                borderRadius: 999,
                background: props.fill,
                border: `2px solid ${props.color}`,
                fontSize: 17,
                fontWeight: 700,
                letterSpacing: "0.06em",
                color: "#ffffff",
            }}
        >
            <div
                style={{
                    width: 11,
                    height: 11,
                    borderRadius: 999,
                    background: props.color,
                }}
            />
            {props.label.toUpperCase()}
        </div>
    )
}

function Emblem(props: { src: string | undefined; size: number }) {
    return props.src ? (
        <img
            alt=""
            src={props.src}
            width={props.size}
            height={props.size}
            style={{ flexShrink: 0 }}
        />
    ) : (
        <div style={{ width: props.size, height: props.size, flexShrink: 0 }} />
    )
}

/** Header, title, state chips, player bar and top three: the left column of both games. */
function LeftColumn(props: {
    model: PanelScoreImage
    art: PanelImageArt
    header: string[]
    detail: string | null
    columnWidth: number
    /** False when the right half shows the player count large (server status). */
    showPlayers: boolean
}) {
    const { model } = props
    const copy = panelImageCopy(model.language)
    const players = props.showPlayers ? model.players : null
    const seedTarget = panelImageSeedTarget(model)
    const share = (value: number) =>
        players ? Math.max(0, Math.min(1, value / players.capacity)) : 0
    // Satori resolves percentages unreliably inside flex items; widths are pixels.
    const px = (fraction: number) => Math.round(fraction * props.columnWidth)
    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 10,
                width: props.columnWidth,
                flexShrink: 0,
            }}
        >
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div
                    style={{
                        display: "flex",
                        fontSize: 16,
                        fontWeight: 700,
                        letterSpacing: "0.14em",
                        color: "#d0d4da",
                        ...nowrap,
                    }}
                >
                    {cut(props.header.join(" · ").toUpperCase(), 52)}
                </div>
                <div
                    style={{
                        display: "flex",
                        fontSize: 44,
                        lineHeight: 1.05,
                        fontWeight: 700,
                        ...nowrap,
                    }}
                >
                    {cut(model.serverName, 26)}
                </div>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        fontSize: 19,
                        color: "#e3e5e8",
                    }}
                >
                    <Chip
                        label={panelImageStateWord(model)}
                        color={PANEL_STATE_COLORS[model.state]}
                        fill={STATE_FILL[model.state]}
                    />
                    {model.newMap ? (
                        <Chip
                            label={copy.newMap}
                            color="#3ba55c"
                            fill="rgba(63,65,71,0.9)"
                        />
                    ) : null}
                    {props.detail ? (
                        <div style={{ display: "flex", ...nowrap }}>
                            {props.detail}
                        </div>
                    ) : null}
                </div>
            </div>
            {players ? (
                <div
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                    <div
                        style={{
                            display: "flex",
                            fontSize: 19,
                            fontWeight: 600,
                        }}
                    >
                        {copy.players(players.count, players.capacity)}
                        {players.queue ? (
                            <span style={{ color: "#f0b232", marginLeft: 6 }}>
                                {`· ${copy.queue(players.queue)}`}
                            </span>
                        ) : null}
                        {seedTarget !== null ? (
                            <span style={{ color: "#f0b232", marginLeft: 6 }}>
                                {`· ${copy.seedTo(seedTarget)}`}
                            </span>
                        ) : null}
                    </div>
                    <div
                        style={{
                            display: "flex",
                            position: "relative",
                            width: props.columnWidth,
                            height: 14,
                            borderRadius: 999,
                            background: "rgba(255,255,255,0.16)",
                            overflow: "hidden",
                        }}
                    >
                        <div
                            style={{
                                position: "absolute",
                                left: 0,
                                top: 0,
                                height: 14,
                                width: px(share(players.count)),
                                background: "#3ba55c",
                            }}
                        />
                        {players.queue ? (
                            <div
                                style={{
                                    position: "absolute",
                                    top: 0,
                                    height: 14,
                                    left: px(share(players.count)),
                                    width: Math.max(
                                        4,
                                        px(share(players.queue))
                                    ),
                                    background: "#f0b232",
                                }}
                            />
                        ) : null}
                        {seedTarget !== null &&
                        seedTarget < players.capacity ? (
                            <div
                                style={{
                                    position: "absolute",
                                    top: 0,
                                    height: 14,
                                    left: Math.max(
                                        0,
                                        px(share(seedTarget)) - 2
                                    ),
                                    width: 4,
                                    background: "#ffffff",
                                }}
                            />
                        ) : null}
                    </div>
                </div>
            ) : (
                <div style={{ display: "flex" }} />
            )}
            {model.leaders.length ? (
                <div
                    style={{ display: "flex", flexDirection: "column", gap: 4 }}
                >
                    <div
                        style={{
                            display: "flex",
                            fontSize: 14,
                            fontWeight: 700,
                            letterSpacing: "0.12em",
                            color: muted,
                        }}
                    >
                        {copy.topKills.toUpperCase()}
                    </div>
                    {model.leaders.map((leader, index) => {
                        const nation =
                            model.game === "hell_let_loose"
                                ? hllLeaderNation(
                                      model,
                                      leader.side as "allies" | "axis" | null
                                  )
                                : null
                        return (
                            <div
                                key={index}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                    fontSize: 19,
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        width: 18,
                                        color: muted,
                                        fontWeight: 700,
                                    }}
                                >
                                    {String(index + 1)}
                                </div>
                                {nation ? (
                                    <Emblem
                                        src={props.art.nations[nation]}
                                        size={22}
                                    />
                                ) : null}
                                <div
                                    style={{ display: "flex", fontWeight: 600 }}
                                >
                                    {cut(leader.name, 24)}
                                </div>
                                <div style={{ display: "flex", color: muted }}>
                                    {String(leader.value)}
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : (
                <div style={{ display: "flex" }} />
            )}
        </div>
    )
}

function Stamp(props: { model: PanelScoreImage }) {
    return (
        <div
            style={{
                display: "flex",
                position: "absolute",
                right: 18,
                bottom: 12,
                fontSize: 13,
                color: "rgba(255,255,255,0.6)",
            }}
        >
            {stamp(props.model)}
        </div>
    )
}
/** The right half when it shows no score (P4-16, P4-18, L3-33). */
function FocusColumn(props: { model: PanelScoreImage; width: number }) {
    const { model } = props
    const copy = panelImageCopy(model.language)
    const focus = panelImageFocus(model)
    const players = model.players
    const target = panelImageSeedTarget(model)
    const next =
        model.game === "hell_let_loose" && model.nextMap
            ? [
                  copy.nextMap(model.nextMap.name),
                  ...(model.nextMap.lighting
                      ? [copy.lighting[model.nextMap.lighting]]
                      : []),
              ].join(" · ")
            : null
    const caption = (parts: Array<string | null>) => {
        const line = parts.filter(Boolean).join(" · ")
        return line ? (
            <div
                style={{
                    display: "flex",
                    fontSize: 16,
                    color: muted,
                    ...nowrap,
                }}
            >
                {cut(line, 64)}
            </div>
        ) : (
            <div style={{ display: "flex" }} />
        )
    }
    const big = (text: string) => (
        <div
            style={{
                display: "flex",
                fontSize: 88,
                lineHeight: 1,
                fontWeight: 800,
            }}
        >
            {text}
        </div>
    )
    const column: CSSProperties = {
        display: "flex",
        width: props.width,
        flexShrink: 0,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
    }
    if (focus === "seed" && target !== null) {
        const progress = seedProgress(players?.count ?? null, target)
        return (
            <div style={column}>
                {big(
                    `${players ? formatPanelNumber(players.count, model.language) : "–"} / ${formatPanelNumber(target, model.language)}`
                )}
                <div style={{ display: "flex", gap: 6 }}>
                    {Array.from({ length: SEED_PROGRESS_SEGMENTS }, (_, i) => (
                        <div
                            key={i}
                            style={{
                                width: 34,
                                height: 12,
                                borderRadius: 3,
                                background:
                                    i < progress.filled
                                        ? "#f0b232"
                                        : "rgba(255,255,255,0.18)",
                            }}
                        />
                    ))}
                </div>
                {caption([copy.seedCaption(target), next])}
            </div>
        )
    }
    if (focus === "empty")
        return (
            <div style={column}>
                <div
                    style={{
                        display: "flex",
                        width: props.width,
                        justifyContent: "center",
                        textAlign: "center",
                        fontSize: 34,
                        lineHeight: 1.2,
                        fontWeight: 700,
                        color: "#e3e5e8",
                    }}
                >
                    {copy.emptyTitle}
                </div>
                {caption([next])}
            </div>
        )
    return (
        <div style={column}>
            {big(
                players
                    ? `${formatPanelNumber(players.count, model.language)} / ${formatPanelNumber(players.capacity, model.language)}`
                    : "–"
            )}
            <div
                style={{
                    display: "flex",
                    fontSize: 16,
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                }}
            >
                {copy.statusPlayers.toUpperCase()}
            </div>
            {caption([players?.queue ? copy.queue(players.queue) : null, next])}
        </div>
    )
}

const SCORE_OVERLAY =
    "linear-gradient(90deg, rgba(9,11,15,0.94) 0%, rgba(9,11,15,0.78) 46%, rgba(9,11,15,0.4) 100%)"
// Board geometry at 1200 × 400: 44 px side padding and a 36 px column gap.
const INNER = SCORE_IMAGE_WIDTH - 88
const HLL_RIGHT = 500
const HLL_LEFT = INNER - 36 - HLL_RIGHT
const WARDOGS_LEFT = 430
const WARDOGS_RIGHT = INNER - 36 - WARDOGS_LEFT
/** Icon 54 + name 170 + value 70 + three 14 px gaps around the bar. */
const FACTION_BAR = WARDOGS_RIGHT - 54 - 170 - 70 - 3 * 14
const content: CSSProperties = {
    display: "flex",
    position: "absolute",
    left: 0,
    top: 0,
    width: SCORE_IMAGE_WIDTH,
    height: SCORE_IMAGE_HEIGHT,
    padding: "34px 44px",
    justifyContent: "space-between",
    gap: 36,
}

function hllScore(model: HllScoreImage, art: PanelImageArt) {
    const copy = panelImageCopy(model.language)
    const focus = panelImageFocus(model)
    const kind = hllScoreKind({
        mode: model.mode,
        allies: model.allies.score,
        axis: model.axis.score,
    })
    const minutes = minutesLeft(model.timeLeftSeconds)
    const next = model.nextMap
        ? [
              copy.nextMap(model.nextMap.name),
              ...(model.nextMap.lighting
                  ? [copy.lighting[model.nextMap.lighting]]
                  : []),
          ].join(" · ")
        : null
    const score =
        model.allies.score != null && model.axis.score != null
            ? `${model.allies.score} : ${model.axis.score}`
            : "– : –"
    const side = (nation: HllNation, label: string) => (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
            }}
        >
            <Emblem src={art.nations[nation]} size={84} />
            <div
                style={{
                    display: "flex",
                    fontSize: 16,
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                }}
            >
                {label.toUpperCase()}
            </div>
        </div>
    )
    return (
        <Frame background={art.background} overlay={SCORE_OVERLAY}>
            <div style={content}>
                <LeftColumn
                    model={model}
                    art={art}
                    header={[
                        copy.game.hell_let_loose,
                        ...(model.map ? [model.map.name] : []),
                        ...(model.mode ? [copy.mode[model.mode]] : []),
                        ...(model.lighting
                            ? [copy.lighting[model.lighting]]
                            : []),
                    ]}
                    detail={minutes != null ? copy.timeLeft(minutes) : null}
                    columnWidth={HLL_LEFT}
                    showPlayers={focus !== "status"}
                />
                {focus !== "score" ? (
                    <FocusColumn model={model} width={HLL_RIGHT} />
                ) : (
                    <div
                        style={{
                            display: "flex",
                            width: HLL_RIGHT,
                            flexShrink: 0,
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 14,
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 22,
                            }}
                        >
                            {side(model.allies.nation, copy.allies)}
                            <div
                                style={{
                                    display: "flex",
                                    fontSize: 92,
                                    lineHeight: 1,
                                    fontWeight: 800,
                                }}
                            >
                                {score}
                            </div>
                            {side(model.axis.nation, copy.axis)}
                        </div>
                        {kind === "sectors" ? (
                            <div style={{ display: "flex", gap: 6 }}>
                                {Array.from({ length: 5 }, (_, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            width: 46,
                                            height: 12,
                                            borderRadius: 3,
                                            background:
                                                i < (model.allies.score ?? 0)
                                                    ? HLL_SIDE_COLORS.allies
                                                    : HLL_SIDE_COLORS.axis,
                                        }}
                                    />
                                ))}
                            </div>
                        ) : null}
                        <div
                            style={{
                                display: "flex",
                                fontSize: 14,
                                color: muted,
                            }}
                        >
                            {[
                                kind === "sectors" ? copy.sectors : copy.score,
                                ...(next ? [next] : []),
                            ].join(" · ")}
                        </div>
                    </div>
                )}
                <Stamp model={model} />
            </div>
        </Frame>
    )
}

function wardogsScore(model: WardogsScoreImage, art: PanelImageArt) {
    const copy = panelImageCopy(model.language)
    const focus = panelImageFocus(model)
    const bars = factionBars(model.factions)
    const cash = model.topCash
        ? copy.topCashNow(
              model.topCash.name,
              formatPanelNumber(model.topCash.value, model.language)
          )
        : null
    return (
        <Frame background={art.background} overlay={SCORE_OVERLAY}>
            <div style={content}>
                <LeftColumn
                    model={model}
                    art={art}
                    header={[
                        copy.game.wardogs,
                        ...(model.map ? [model.map.name] : []),
                    ]}
                    detail={
                        model.joinCode ? copy.joinCode(model.joinCode) : null
                    }
                    columnWidth={WARDOGS_LEFT}
                    showPlayers={focus !== "status"}
                />
                {focus !== "score" ? (
                    <FocusColumn model={model} width={WARDOGS_RIGHT} />
                ) : (
                    <div
                        style={{
                            display: "flex",
                            width: WARDOGS_RIGHT,
                            flexShrink: 0,
                            flexDirection: "column",
                            justifyContent: "center",
                            gap: 18,
                        }}
                    >
                        {bars.map((bar) => (
                            <div
                                key={bar.faction}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 14,
                                }}
                            >
                                <Emblem
                                    src={art.factions[bar.faction]}
                                    size={54}
                                />
                                <div
                                    style={{
                                        display: "flex",
                                        width: 170,
                                        flexShrink: 0,
                                        fontSize: 24,
                                        fontWeight: 700,
                                    }}
                                >
                                    {copy.wardogs[bar.faction]}
                                </div>
                                <div
                                    style={{
                                        display: "flex",
                                        width: FACTION_BAR,
                                        flexShrink: 0,
                                        height: 16,
                                        borderRadius: 999,
                                        background: "rgba(255,255,255,0.14)",
                                        overflow: "hidden",
                                    }}
                                >
                                    <div
                                        style={{
                                            width: Math.round(
                                                (bar.percent / 100) *
                                                    FACTION_BAR
                                            ),
                                            height: 16,
                                            background: bar.leading
                                                ? model.accentColor
                                                : "#c9ccd1",
                                        }}
                                    />
                                </div>
                                <div
                                    style={{
                                        display: "flex",
                                        width: 70,
                                        flexShrink: 0,
                                        justifyContent: "flex-end",
                                        fontSize: 30,
                                        fontWeight: 800,
                                    }}
                                >
                                    {formatPanelNumber(
                                        bar.points,
                                        model.language
                                    )}
                                </div>
                            </div>
                        ))}
                        <div
                            style={{
                                display: "flex",
                                fontSize: 14,
                                color: muted,
                            }}
                        >
                            {[copy.factionPoints, ...(cash ? [cash] : [])].join(
                                " · "
                            )}
                        </div>
                    </div>
                )}
                <Stamp model={model} />
            </div>
        </Frame>
    )
}

/** Style A: the scoreboard over the darkened map art (P7-07, P7-15). */
export function scoreImageElement(
    model: PanelScoreImage,
    art: PanelImageArt
): ReactElement {
    return model.game === "hell_let_loose"
        ? hllScore(model, art)
        : wardogsScore(model, art)
}

/** Style B: the server banner with the clan badge, name and subtitle (P7-13, P7-18, P7-19). */
export function bannerImageElement(
    model: PanelBannerImage,
    art: Pick<PanelImageArt, "background">
): ReactElement {
    return (
        <Frame
            background={art.background}
            overlay="linear-gradient(0deg, rgba(9,11,15,0.85) 0%, rgba(9,11,15,0.1) 60%)"
        >
            <div
                style={{
                    display: "flex",
                    position: "absolute",
                    left: 36,
                    bottom: 30,
                    alignItems: "center",
                    gap: 22,
                }}
            >
                <div
                    style={{
                        display: "flex",
                        width: 110,
                        height: 110,
                        borderRadius: 999,
                        background: "#171717",
                        border: `5px solid ${model.accentColor}`,
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 32,
                        fontWeight: 800,
                    }}
                >
                    {model.clanTag}
                </div>
                <div
                    style={{ display: "flex", flexDirection: "column", gap: 4 }}
                >
                    <div
                        style={{
                            display: "flex",
                            fontSize: 52,
                            lineHeight: 1,
                            fontWeight: 800,
                        }}
                    >
                        {cut(model.clanName, 28)}
                    </div>
                    <div
                        style={{
                            display: "flex",
                            fontSize: 22,
                            color: "#e3e5e8",
                        }}
                    >
                        {cut(model.subtitle, 64)}
                    </div>
                </div>
            </div>
        </Frame>
    )
}
