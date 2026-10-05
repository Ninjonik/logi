/**
 * The Discord markdown subset the bot's messages use, parsed for the
 * dashboard preview: headings, subtext (`-#`), quotes, bold, italic,
 * underline, strikethrough, inline code, masked and bare links, timestamps
 * (`<t:…:R>`), user, role and channel mentions, custom emoji and backslash
 * escapes. Nothing is rendered as HTML, so text from the bot can never inject
 * markup into the dashboard.
 */

export type TimestampStyle = "t" | "T" | "d" | "D" | "f" | "F" | "R"

export type MarkdownInline =
    | { type: "text"; text: string }
    | {
          type: "strong" | "em" | "underline" | "strike"
          children: MarkdownInline[]
      }
    | { type: "code"; text: string }
    | { type: "link"; href: string; children: MarkdownInline[] }
    | { type: "timestamp"; unix: number; style: TimestampStyle }
    | { type: "mention"; kind: "user" | "role" | "channel"; id: string }
    | { type: "emoji"; name: string; id: string; animated: boolean }

export type MarkdownBlock = {
    type: "paragraph" | "subtext" | "h1" | "h2" | "h3" | "quote"
    lines: MarkdownInline[][]
}

const ESCAPABLE = /[\\*_~`|[\]()<>#\-.:>!@&]/
const ANGLE =
    /^<(?:t:(-?\d{1,13})(?::([tTdDfFR]))?|@!?(\d{1,20})|@&(\d{1,20})|#(\d{1,20})|(a?):(\w{2,32}):(\d{1,20}))>/
const URL = /^https?:\/\/[^\s<>()]+[^\s<>().,:;!?'"]/
const EMPHASIS: Array<[string, "strong" | "underline" | "strike" | "em"]> = [
    ["**", "strong"],
    ["__", "underline"],
    ["~~", "strike"],
    ["*", "em"],
    ["_", "em"],
]

const isHttp = (value: string) => {
    try {
        const url = new globalThis.URL(value)
        return url.protocol === "http:" || url.protocol === "https:"
    } catch {
        return false
    }
}

/** The index of the closing delimiter, skipping escapes; -1 when absent. */
function closing(src: string, delimiter: string, from: number) {
    for (let index = from; index < src.length; index++) {
        if (src[index] === "\\") {
            index++
            continue
        }
        if (!src.startsWith(delimiter, index)) continue
        // A single `*` must not close on the first half of `**`.
        if (
            delimiter.length === 1 &&
            src[index + 1] === delimiter &&
            index > from
        ) {
            index++
            continue
        }
        if (index > from) return index
    }
    return -1
}

/** Inline markdown of one line. */
export function parseInlineMarkdown(src: string): MarkdownInline[] {
    const out: MarkdownInline[] = []
    let text = ""
    const flush = () => {
        if (text) out.push({ type: "text", text })
        text = ""
    }
    let index = 0
    outer: while (index < src.length) {
        const char = src[index]!
        if (char === "\\" && ESCAPABLE.test(src[index + 1] ?? "")) {
            text += src[index + 1]
            index += 2
            continue
        }
        if (char === "`") {
            const end = src.indexOf("`", index + 1)
            if (end > index + 1) {
                flush()
                out.push({ type: "code", text: src.slice(index + 1, end) })
                index = end + 1
                continue
            }
        }
        if (char === "<") {
            const match = ANGLE.exec(src.slice(index))
            if (match) {
                flush()
                const [whole, unix, style, user, role, channel, a, name, id] =
                    match
                if (unix !== undefined)
                    out.push({
                        type: "timestamp",
                        unix: Number(unix),
                        style: (style as TimestampStyle | undefined) ?? "f",
                    })
                else if (user)
                    out.push({ type: "mention", kind: "user", id: user })
                else if (role)
                    out.push({ type: "mention", kind: "role", id: role })
                else if (channel)
                    out.push({ type: "mention", kind: "channel", id: channel })
                else
                    out.push({
                        type: "emoji",
                        name: name!,
                        id: id!,
                        animated: a === "a",
                    })
                index += whole.length
                continue
            }
        }
        if (char === "[") {
            const middle = closing(src, "](", index + 1)
            const end = middle > 0 ? src.indexOf(")", middle + 2) : -1
            const href = end > 0 ? src.slice(middle + 2, end).trim() : ""
            if (middle > index + 1 && end > 0 && isHttp(href)) {
                flush()
                out.push({
                    type: "link",
                    href,
                    children: parseInlineMarkdown(src.slice(index + 1, middle)),
                })
                index = end + 1
                continue
            }
        }
        if (char === "h") {
            const match = URL.exec(src.slice(index))
            if (match && isHttp(match[0])) {
                flush()
                out.push({
                    type: "link",
                    href: match[0],
                    children: [{ type: "text", text: match[0] }],
                })
                index += match[0].length
                continue
            }
        }
        for (const [delimiter, type] of EMPHASIS) {
            if (!src.startsWith(delimiter, index)) continue
            const start = index + delimiter.length
            const end = closing(src, delimiter, start)
            if (end > start) {
                flush()
                out.push({
                    type,
                    children: parseInlineMarkdown(src.slice(start, end)),
                })
                index = end + delimiter.length
                continue outer
            }
        }
        text += char
        index++
    }
    flush()
    return out
}

const BLOCK_PREFIX: Array<[RegExp, MarkdownBlock["type"]]> = [
    [/^-# /, "subtext"],
    [/^### /, "h3"],
    [/^## /, "h2"],
    [/^# /, "h1"],
    [/^> ?/, "quote"],
]

/**
 * A message text as blocks: one block per heading, subtext or paragraph
 * line; consecutive quote lines form one quote.
 */
export function parseDiscordMarkdown(src: string): MarkdownBlock[] {
    const blocks: MarkdownBlock[] = []
    for (const line of src.replace(/\r\n?/g, "\n").split("\n")) {
        const prefix = BLOCK_PREFIX.find(([pattern]) => pattern.test(line))
        const type = prefix?.[1] ?? "paragraph"
        const inline = parseInlineMarkdown(
            prefix ? line.replace(prefix[0], "") : line
        )
        const last = blocks.at(-1)
        if (type === "quote" && last?.type === "quote") last.lines.push(inline)
        else blocks.push({ type, lines: [inline] })
    }
    return blocks
}
