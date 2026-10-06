import type { ReactNode } from "react"

import {
    resolveMessageViewAccent,
    type ChipTone,
    type MessageBlock,
    type MessageButton,
    type MessageChip,
    type MessageField,
    type MessageMedia,
    type MessageView,
} from "@/domain/discord-messages/message-view"
import {
    footerText,
    headerLabelText,
    headerState,
    listLines,
    metaLineText,
} from "@/domain/discord-messages/message-layout"
import type { MessageStyle } from "@/domain/discord-messages/message-style"
import { getIntlLocaleForClanLanguage } from "@/lib/clan-language/core"
import { getSystemMessages } from "@/lib/clan-language/system"
import type { Dictionary } from "@/i18n/dictionaries"
import { cn } from "@/lib/utils"

import {
    parseDiscordMarkdown,
    type MarkdownLineBlock,
    type MarkdownInline,
} from "./markdown"
import { formatPreviewTimestamp } from "./timestamp"

/** Names for mention pills; unknown IDs show a generic word. */
export type DiscordPreviewMentions = {
    users?: Record<string, string>
    roles?: Record<string, string>
    channels?: Record<string, string>
}

export type DiscordMessagePreviewProps = {
    view: MessageView
    /**
     * Markdown sent above the card as plain message content, e.g. the role
     * ping of a match announcement ("@Klan").
     */
    content?: string
    /** The clan language: the bot's words and every timestamp follow it. */
    language: string
    /** The clan's message style (clan colour and icon density). */
    style?: MessageStyle | null
    /** Discord's own words (ephemeral line, APP tag) in the dashboard language. */
    labels: Dictionary["discordPreview"]
    /**
     * "Now" for relative timestamps (`<t:…:R>`), so server and client render
     * the same. Without it they show the absolute date and time instead.
     */
    now?: number
    /** The reader's time zone for absolute timestamps. */
    timeZone?: string
    mentions?: DiscordPreviewMentions
    /** The message header: the bot's name and the posting time. Off by default. */
    author?: { name?: string; time?: string; edited?: boolean }
    /** The "<name> použil(a) /<command>" line above a command reply. */
    invokedBy?: { user: string; command: string }
    className?: string
}

const TONE_COLORS: Record<ChipTone, string> = {
    success: "#3ba55c",
    warning: "#f0b232",
    danger: "#ed4245",
    neutral: "#80848e",
    info: "#5865f2",
}

const BUTTON_COLORS = {
    primary: "bg-[#5865f2]",
    success: "bg-[#248046]",
    secondary: "bg-[#4e5058]",
    danger: "bg-[#b3302f]",
    link: "bg-[#4e5058]",
} as const

const hex = (color: number) => `#${color.toString(16).padStart(6, "0")}`

type RenderContext = Pick<
    DiscordMessagePreviewProps,
    "language" | "now" | "timeZone" | "mentions" | "labels"
>

function Inline({
    nodes,
    context,
}: {
    nodes: MarkdownInline[]
    context: RenderContext
}) {
    return nodes.map((node, index) => {
        switch (node.type) {
            case "text":
                return <span key={index}>{node.text}</span>
            case "strong":
                return (
                    <strong
                        key={index}
                        className="font-semibold text-[#f2f3f5]"
                    >
                        <Inline nodes={node.children} context={context} />
                    </strong>
                )
            case "em":
                return (
                    <em key={index}>
                        <Inline nodes={node.children} context={context} />
                    </em>
                )
            case "underline":
                return (
                    <span key={index} className="underline">
                        <Inline nodes={node.children} context={context} />
                    </span>
                )
            case "strike":
                return (
                    <s key={index}>
                        <Inline nodes={node.children} context={context} />
                    </s>
                )
            case "code":
                return (
                    <code
                        key={index}
                        className="rounded-[4px] bg-[#1e1f22] px-1 py-px font-mono text-[0.85em]"
                    >
                        {node.text}
                    </code>
                )
            case "link":
                return (
                    <a
                        key={index}
                        href={node.href}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-[#00a8fc] hover:underline"
                    >
                        <Inline nodes={node.children} context={context} />
                    </a>
                )
            case "timestamp": {
                const text =
                    formatPreviewTimestamp({
                        unix: node.unix,
                        style:
                            node.style === "R" && context.now === undefined
                                ? "f"
                                : node.style,
                        language: context.language,
                        now: context.now ?? node.unix * 1000,
                        timeZone: context.timeZone,
                    }) ?? ""
                return (
                    <time
                        key={index}
                        dateTime={new Date(node.unix * 1000).toISOString()}
                    >
                        {text}
                    </time>
                )
            }
            case "mention": {
                const names =
                    node.kind === "user"
                        ? context.mentions?.users
                        : node.kind === "role"
                          ? context.mentions?.roles
                          : context.mentions?.channels
                const fallback =
                    node.kind === "user"
                        ? context.labels.unknownUser
                        : node.kind === "role"
                          ? context.labels.unknownRole
                          : context.labels.unknownChannel
                return (
                    <span
                        key={index}
                        className="rounded-[3px] bg-[#5865f2]/30 px-0.5 font-medium text-[#c9cdfb]"
                    >
                        {node.kind === "channel" ? "#" : "@"}
                        {names?.[node.id] ?? fallback}
                    </span>
                )
            }
            case "emoji":
                return (
                    <span key={index} className="text-[#b5bac1]">
                        :{node.name}:
                    </span>
                )
        }
    })
}

function MarkdownText({
    markdown,
    context,
    className,
}: {
    markdown: string
    context: RenderContext
    className?: string
}) {
    const blocks = parseDiscordMarkdown(markdown)
    const line = (block: MarkdownLineBlock) =>
        block.lines.map((nodes, index) => (
            <span key={index} className="block min-h-[1em]">
                <Inline nodes={nodes} context={context} />
            </span>
        ))
    return (
        <div className={cn("min-w-0 [overflow-wrap:anywhere]", className)}>
            {blocks.map((block, index) => {
                switch (block.type) {
                    case "code":
                        return (
                            <pre
                                key={index}
                                className="overflow-x-auto rounded border border-[#1e1f22] bg-[#2b2d31] px-2.5 py-2 font-mono text-[12.5px] leading-[19px] whitespace-pre text-[#dbdee1]"
                            >
                                {block.lines.map((segments, row) => (
                                    <span
                                        key={row}
                                        className="block min-h-[1em]"
                                    >
                                        {segments.map((segment, part) =>
                                            segment.strong ? (
                                                <span
                                                    key={part}
                                                    className="font-bold text-white"
                                                >
                                                    {segment.text}
                                                </span>
                                            ) : (
                                                <span key={part}>
                                                    {segment.text}
                                                </span>
                                            )
                                        )}
                                    </span>
                                ))}
                            </pre>
                        )
                    case "h1":
                        return (
                            <p
                                key={index}
                                className="text-xl leading-7 font-bold text-[#f2f3f5]"
                            >
                                {line(block)}
                            </p>
                        )
                    case "h2":
                        return (
                            <p
                                key={index}
                                className="text-lg leading-6 font-bold text-[#f2f3f5]"
                            >
                                {line(block)}
                            </p>
                        )
                    case "h3":
                        return (
                            <p
                                key={index}
                                className="text-base leading-[22px] font-semibold text-[#f2f3f5]"
                            >
                                {line(block)}
                            </p>
                        )
                    case "subtext":
                        return (
                            <p
                                key={index}
                                className="text-xs leading-4 text-[#949ba4]"
                            >
                                {line(block)}
                            </p>
                        )
                    case "quote":
                        return (
                            <blockquote
                                key={index}
                                className="border-l-4 border-[#4e5058] pl-3"
                            >
                                {line(block)}
                            </blockquote>
                        )
                    default:
                        return <p key={index}>{line(block)}</p>
                }
            })}
        </div>
    )
}

function Chip({ chip }: { chip: MessageChip }) {
    return (
        <span className="inline-flex h-[22px] flex-none items-center gap-1.5 rounded-full bg-[#3f4147] px-[9px] text-xs font-semibold whitespace-nowrap text-[#f2f3f5]">
            <span
                aria-hidden="true"
                className="size-2 rounded-full"
                style={{ background: TONE_COLORS[chip.tone] }}
            />
            {chip.label}
        </span>
    )
}

function ExternalIcon() {
    return (
        <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M15 3h6v6" />
            <path d="M10 14 21 3" />
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        </svg>
    )
}

/** A button as Discord draws it; the preview never runs its action. */
function PreviewButton({
    button,
    labels,
}: {
    button: MessageButton
    labels: Dictionary["discordPreview"]
}) {
    const style = button.kind === "link" ? "link" : button.style
    return (
        <li
            className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-[4px] px-3.5 text-[13px] font-medium whitespace-nowrap text-white",
                BUTTON_COLORS[style],
                button.disabled && "opacity-50"
            )}
        >
            {button.emoji && <span aria-hidden="true">{button.emoji}</span>}
            <span>{button.label}</span>
            {button.kind === "link" && (
                <>
                    <ExternalIcon />
                    <span className="sr-only">({labels.externalLink})</span>
                </>
            )}
            {button.disabled && (
                <span className="sr-only">({labels.unavailable})</span>
            )}
        </li>
    )
}

function Media({
    media,
    className,
}: {
    media: MessageMedia
    className?: string
}) {
    // Previews show remote or attached images as given; attachments have no URL here.
    return media.url.startsWith("attachment://") ? (
        <span
            role="img"
            aria-label={media.description ?? media.url.slice(13)}
            className={cn(
                "flex items-center justify-center bg-[#3f4147] p-1 text-center text-[10px] leading-[13px] text-[#b5bac1]",
                className
            )}
        >
            {media.description ?? media.url.slice(13)}
        </span>
    ) : (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary remote previews
        <img
            src={media.url}
            alt={media.description ?? ""}
            className={cn("object-cover", className)}
            loading="lazy"
        />
    )
}

function Field({
    field,
    context,
}: {
    field: MessageField
    context: RenderContext
}) {
    // One accessory per row, as in Discord: the button wins over an image.
    if (field.action)
        return (
            <div className="flex min-w-0 items-start justify-between gap-3">
                <Field
                    field={{
                        ...field,
                        action: undefined,
                        thumbnail: undefined,
                    }}
                    context={context}
                />
                <ul
                    aria-label={context.labels.buttons}
                    className="m-0 flex flex-none list-none p-0"
                >
                    <PreviewButton
                        button={field.action}
                        labels={context.labels}
                    />
                </ul>
            </div>
        )
    const body = (
        <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-[#f2f3f5]">
                    {field.title}
                </span>
                {field.chip && <Chip chip={field.chip} />}
            </div>
            {field.text?.trim() && (
                <MarkdownText
                    markdown={field.text}
                    context={context}
                    className="text-[13px] leading-[18px] text-[#b5bac1]"
                />
            )}
        </div>
    )
    return field.thumbnail ? (
        <div className="flex min-w-0 items-start gap-3">
            {body}
            <Media
                media={field.thumbnail}
                className="size-16 shrink-0 rounded-md"
            />
        </div>
    ) : (
        body
    )
}

function Block({
    block,
    context,
    style,
}: {
    block: MessageBlock
    context: RenderContext
    style?: MessageStyle | null
}): ReactNode {
    switch (block.kind) {
        case "text":
            return block.markdown.trim() ? (
                <MarkdownText markdown={block.markdown} context={context} />
            ) : null
        case "meta":
            return (
                <MarkdownText
                    markdown={block.lines
                        .filter((line) => line.text.trim())
                        .map((line) => metaLineText(line, style?.iconDensity))
                        .join("\n")}
                    context={context}
                    className="text-[13px] leading-[18px] text-[#b5bac1]"
                />
            )
        case "list":
            return (
                <MarkdownText
                    markdown={listLines(block).join("\n")}
                    context={context}
                    className="flex flex-col gap-1.5 text-[13px] leading-[18px] [&>p]:block"
                />
            )
        case "fields":
            return (
                <div className="flex flex-col gap-2.5">
                    {block.items.map((field, index) => (
                        <div key={index} className="flex flex-col gap-2.5">
                            {index > 0 && (
                                <hr className="m-0 border-0 border-t border-[#3f4147]" />
                            )}
                            <Field field={field} context={context} />
                        </div>
                    ))}
                </div>
            )
        case "separator":
            return block.divider === false ? (
                <div
                    aria-hidden="true"
                    className={block.spacing === "large" ? "h-4" : "h-1"}
                />
            ) : (
                <hr
                    className={cn(
                        "m-0 border-0 border-t border-[#3f4147]",
                        block.spacing === "large" && "my-2"
                    )}
                />
            )
        case "gallery":
            return (
                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(160px,100%),1fr))] gap-1">
                    {block.items.map((item, index) => (
                        <Media
                            key={index}
                            media={item}
                            // Discord shows a single image at its own aspect
                            // ratio (the 1200 × 400 score image, P7-07).
                            className={cn(
                                "w-full rounded-md",
                                block.items.length > 1 && "aspect-video"
                            )}
                        />
                    ))}
                </div>
            )
        case "buttons":
            return (
                <ul
                    aria-label={context.labels.buttons}
                    className="m-0 flex list-none flex-wrap gap-2 p-0"
                >
                    {block.buttons.map((button, index) => (
                        <PreviewButton
                            key={index}
                            button={button}
                            labels={context.labels}
                        />
                    ))}
                </ul>
            )
        case "select": {
            const chosen = block.select.options.filter(
                (option) => option.default
            )
            return (
                <div
                    className={cn(
                        "flex h-10 min-w-0 items-center justify-between gap-2 rounded-[4px] bg-[#1e1f22] px-3 text-sm text-[#949ba4]",
                        block.select.disabled && "opacity-50"
                    )}
                >
                    <span className="truncate">
                        {chosen.length
                            ? chosen.map((option) => option.label).join(", ")
                            : (block.select.placeholder ?? "")}
                    </span>
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                    >
                        <path d="m6 9 6 6 6-6" />
                    </svg>
                </div>
            )
        }
    }
}

/**
 * One bot message in the Discord dark look of the design boards: the accent
 * bar, the "DRUH · HRA" header with title and chips, an optional image,
 * content, buttons and the footer, plus Discord's own ephemeral line for a
 * private reply. It renders the same {@link MessageView} the bot sends
 * through `discord-bot/src/ui/`, with the same words.
 */
export function DiscordMessagePreview({
    view,
    content,
    language,
    style,
    labels,
    now,
    timeZone,
    mentions,
    author,
    invokedBy,
    className,
}: DiscordMessagePreviewProps) {
    const copy = getSystemMessages(language).kit
    const locale = getIntlLocaleForClanLanguage(language)
    const context: RenderContext = { language, now, timeZone, mentions, labels }
    const accent = hex(resolveMessageViewAccent(view.accent, style))
    const header = view.header
    const state = header ? headerState(header, copy) : undefined
    const hasHeader = Boolean(
        header?.label?.trim() ||
        header?.title?.trim() ||
        header?.subtitle?.trim() ||
        state?.chips.length ||
        state?.status
    )
    const footer = view.footer ? footerText(view.footer, copy) : ""

    return (
        <figure
            aria-label={labels.regionLabel}
            className={cn(
                "m-0 flex min-w-0 flex-col gap-1 rounded-xl bg-[#313338] p-4 font-sans text-sm leading-5 text-[#dbdee1]",
                className
            )}
        >
            {invokedBy && (
                <p className="m-0 ml-5 flex min-w-0 items-center gap-1.5 text-xs text-[#949ba4]">
                    <span
                        aria-hidden="true"
                        className="h-2 w-5 flex-none rounded-tl-md border-t-2 border-l-2 border-[#4e5058]"
                    />
                    <span
                        aria-hidden="true"
                        className="size-4 flex-none rounded-full bg-[#4e5058]"
                    />
                    <span className="min-w-0 truncate">
                        {labels.usedCommand
                            .replace("{user}", invokedBy.user)
                            .split("{command}")
                            .flatMap((part, index) =>
                                index === 0
                                    ? [part]
                                    : [
                                          <span
                                              key={index}
                                              className="text-[#00a8fc]"
                                          >
                                              {invokedBy.command}
                                          </span>,
                                          part,
                                      ]
                            )}
                    </span>
                </p>
            )}
            <div className="flex min-w-0 gap-3">
                {author ? (
                    <span
                        aria-hidden="true"
                        className="flex size-10 flex-none items-center justify-center rounded-full bg-[#171717] font-semibold text-[#fafafa]"
                    >
                        {(author.name ?? "Logi").slice(0, 1)}
                    </span>
                ) : null}
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    {author && (
                        <p className="m-0 flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold text-[#f2f3f5]">
                                {author.name ?? "Logi"}
                            </span>
                            <span className="rounded-[3px] bg-[#5865f2] px-1 py-px text-[10px] leading-[14px] font-semibold text-white">
                                {labels.appTag}
                            </span>
                            {author.time && (
                                <span className="text-xs text-[#949ba4]">
                                    {author.time}
                                </span>
                            )}
                        </p>
                    )}
                    {content?.trim() && (
                        <MarkdownText
                            markdown={content.trim()}
                            context={context}
                            className="text-[#c9cdfb]"
                        />
                    )}
                    <article
                        className="flex min-w-0 flex-col gap-2.5 rounded-md border-l-4 bg-[#2b2d31] px-3.5 pt-3 pb-3.5 [overflow-wrap:anywhere]"
                        style={{ borderLeftColor: accent }}
                    >
                        {view.lead && (
                            <Media
                                media={view.lead}
                                className="w-full rounded-md"
                            />
                        )}
                        {hasHeader && header && (
                            <header className="flex min-w-0 items-start justify-between gap-3">
                                <div className="flex min-w-0 flex-col gap-1">
                                    {header.label?.trim() && (
                                        <span className="text-xs leading-4 font-semibold tracking-[0.04em] text-[#b5bac1]">
                                            {headerLabelText(
                                                header.label.trim(),
                                                locale
                                            )}
                                        </span>
                                    )}
                                    {header.title?.trim() && (
                                        <span className="text-base leading-[22px] font-semibold text-[#f2f3f5]">
                                            {header.title.trim()}
                                        </span>
                                    )}
                                    {header.subtitle?.trim() && (
                                        <MarkdownText
                                            markdown={header.subtitle.trim()}
                                            context={context}
                                            className="text-[13px] leading-[18px] text-[#b5bac1]"
                                        />
                                    )}
                                    {state &&
                                        (state.chips.length > 0 ||
                                            state.status) && (
                                            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-[18px] text-[#b5bac1]">
                                                {state.chips.map(
                                                    (chip, index) => (
                                                        <Chip
                                                            key={index}
                                                            chip={chip}
                                                        />
                                                    )
                                                )}
                                                {state.status && (
                                                    <MarkdownText
                                                        markdown={state.status}
                                                        context={context}
                                                    />
                                                )}
                                            </div>
                                        )}
                                </div>
                                {header.thumbnail && (
                                    <Media
                                        media={header.thumbnail}
                                        className="h-[54px] w-[72px] flex-none rounded-md"
                                    />
                                )}
                            </header>
                        )}
                        {view.blocks.map((block, index) => (
                            <Block
                                key={index}
                                block={block}
                                context={context}
                                style={style}
                            />
                        ))}
                        {footer && (
                            <MarkdownText
                                markdown={footer}
                                context={context}
                                className="text-xs leading-4 text-[#949ba4]"
                            />
                        )}
                    </article>
                    {author?.edited && (
                        <span className="text-[11px] leading-[14px] text-[#949ba4]">
                            {labels.edited}
                        </span>
                    )}
                    {view.ephemeral && (
                        <p className="m-0 flex flex-wrap items-center gap-1.5 text-xs leading-4 text-[#949ba4]">
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
                                <circle cx="12" cy="12" r="3" />
                            </svg>
                            <span>{labels.onlyYouCanSee} ·</span>
                            <span className="text-[#00a8fc]">
                                {labels.dismissMessage}
                            </span>
                        </p>
                    )}
                </div>
            </div>
        </figure>
    )
}
