/**
 * The rules every bot message follows (boards L3 and M3, Discord limits):
 * at most one primary action, at most five buttons in a row and two rows,
 * link buttons only to http(s) and without a hand-written arrow (Discord
 * draws ↗ itself), unique custom IDs, and the Components V2 text and
 * component limits.
 */

import {
    DISCORD_MESSAGE_LIMITS as LIMITS,
    type MessageButton,
    type MessageMedia,
    type MessageView,
} from "./message-view"
import {
    countLayoutComponents,
    layoutMessageView,
    layoutTextLength,
    type MessageLayoutOptions,
} from "./message-layout"
import { parseDiscordColor } from "./format"

export type MessageViewIssueCode =
    | "empty"
    | "accent-invalid"
    | "too-many-primary"
    | "row-empty"
    | "row-too-long"
    | "too-many-button-rows"
    | "label-empty"
    | "label-too-long"
    | "link-not-http"
    | "link-label-arrow"
    | "url-too-long"
    | "custom-id-invalid"
    | "duplicate-custom-id"
    | "select-options"
    | "select-option-too-long"
    | "select-placeholder-too-long"
    | "select-values"
    | "gallery-size"
    | "media-url"
    | "media-description-too-long"
    | "text-too-long"
    | "too-many-components"

export type MessageViewIssue = { code: MessageViewIssueCode; detail: string }

export type MessageViewValidation =
    { ok: true; issues: [] } | { ok: false; issues: MessageViewIssue[] }

const isHttpUrl = (value: string) => {
    try {
        const url = new URL(value)
        return url.protocol === "https:" || url.protocol === "http:"
    } catch {
        return false
    }
}

const isMediaUrl = (value: string) =>
    isHttpUrl(value) || /^attachment:\/\/[^\s/]+$/.test(value)

function checkMedia(media: MessageMedia, issues: MessageViewIssue[]) {
    if (!isMediaUrl(media.url) || media.url.length > LIMITS.url)
        issues.push({ code: "media-url", detail: media.url.slice(0, 80) })
    if ((media.description?.length ?? 0) > LIMITS.mediaDescription)
        issues.push({
            code: "media-description-too-long",
            detail: `${media.description?.length} characters`,
        })
}

function checkButton(
    button: MessageButton,
    ids: Set<string>,
    issues: MessageViewIssue[]
) {
    if (!button.label.trim() && !button.emoji)
        issues.push({ code: "label-empty", detail: "a button has no label" })
    if (button.label.length > LIMITS.buttonLabel)
        issues.push({ code: "label-too-long", detail: button.label })
    if (button.kind === "link") {
        if (!isHttpUrl(button.url))
            issues.push({ code: "link-not-http", detail: button.label })
        if (button.url.length > LIMITS.url)
            issues.push({ code: "url-too-long", detail: button.label })
        if (button.label.includes("↗"))
            issues.push({ code: "link-label-arrow", detail: button.label })
        return
    }
    checkCustomId(button.id, ids, issues)
}

function checkCustomId(
    id: string,
    ids: Set<string>,
    issues: MessageViewIssue[]
) {
    if (!id || id.length > LIMITS.customId)
        issues.push({ code: "custom-id-invalid", detail: id.slice(0, 40) })
    else if (ids.has(id))
        issues.push({ code: "duplicate-custom-id", detail: id })
    ids.add(id)
}

/**
 * Checks a view against the board rules and Discord's limits. Text limits
 * are measured on the laid-out message, so the copy is needed.
 */
export function validateMessageView(
    view: MessageView,
    options: MessageLayoutOptions
): MessageViewValidation {
    const issues: MessageViewIssue[] = []
    if (
        typeof view.accent === "object" &&
        !parseDiscordColor(view.accent.custom)
    )
        issues.push({ code: "accent-invalid", detail: view.accent.custom })
    if (!view.header?.title?.trim() && !view.blocks.length && !view.lead)
        issues.push({ code: "empty", detail: "no title and no content" })
    if (view.lead) checkMedia(view.lead, issues)
    if (view.header?.thumbnail) checkMedia(view.header.thumbnail, issues)

    const ids = new Set<string>()
    let buttonRows = 0
    let primary = 0
    for (const block of view.blocks) {
        if (block.kind === "buttons") {
            buttonRows += 1
            if (!block.buttons.length)
                issues.push({
                    code: "row-empty",
                    detail: "an empty button row",
                })
            if (block.buttons.length > LIMITS.buttonsPerRow)
                issues.push({
                    code: "row-too-long",
                    detail: `${block.buttons.length} buttons in a row`,
                })
            for (const button of block.buttons) {
                if (
                    button.kind === "action" &&
                    (button.style === "primary" || button.style === "success")
                )
                    primary += 1
                checkButton(button, ids, issues)
            }
        } else if (block.kind === "fields") {
            for (const field of block.items) {
                if (field.thumbnail) checkMedia(field.thumbnail, issues)
                if (!field.action) continue
                if (
                    field.action.kind === "action" &&
                    (field.action.style === "primary" ||
                        field.action.style === "success")
                )
                    primary += 1
                checkButton(field.action, ids, issues)
            }
        } else if (block.kind === "select") {
            const { select } = block
            checkCustomId(select.id, ids, issues)
            if (
                !select.options.length ||
                select.options.length > LIMITS.selectOptions
            )
                issues.push({
                    code: "select-options",
                    detail: `${select.options.length} options`,
                })
            for (const option of select.options)
                if (
                    !option.label ||
                    !option.value ||
                    option.label.length > LIMITS.selectOptionText ||
                    option.value.length > LIMITS.selectOptionText ||
                    (option.description?.length ?? 0) > LIMITS.selectOptionText
                )
                    issues.push({
                        code: "select-option-too-long",
                        detail: option.label.slice(0, 40),
                    })
            if ((select.placeholder?.length ?? 0) > LIMITS.selectPlaceholder)
                issues.push({
                    code: "select-placeholder-too-long",
                    detail: select.placeholder!.slice(0, 40),
                })
            const min = select.minValues ?? 1
            const max = select.maxValues ?? 1
            if (min < 0 || max < 1 || min > max || max > select.options.length)
                issues.push({
                    code: "select-values",
                    detail: `${min}..${max} of ${select.options.length}`,
                })
        } else if (block.kind === "gallery") {
            if (!block.items.length || block.items.length > LIMITS.galleryItems)
                issues.push({
                    code: "gallery-size",
                    detail: `${block.items.length} images`,
                })
            for (const item of block.items) checkMedia(item, issues)
        }
    }
    if (primary > LIMITS.primaryButtons)
        issues.push({
            code: "too-many-primary",
            detail: `${primary} primary buttons`,
        })
    if (buttonRows > LIMITS.buttonRows)
        issues.push({
            code: "too-many-button-rows",
            detail: `${buttonRows} rows of buttons`,
        })

    const layout = layoutMessageView(view, options)
    const text = layoutTextLength(layout)
    if (text > LIMITS.totalText)
        issues.push({ code: "text-too-long", detail: `${text} characters` })
    const components = countLayoutComponents(layout)
    if (components > LIMITS.components)
        issues.push({
            code: "too-many-components",
            detail: `${components} components`,
        })
    return issues.length ? { ok: false, issues } : { ok: true, issues: [] }
}

export class InvalidMessageViewError extends Error {
    constructor(readonly issues: MessageViewIssue[]) {
        super(
            `Invalid Discord message: ${issues
                .map((issue) => `${issue.code} (${issue.detail})`)
                .join(", ")}`
        )
        this.name = "InvalidMessageViewError"
    }
}

/** Throws {@link InvalidMessageViewError} when the view breaks a rule. */
export function assertValidMessageView(
    view: MessageView,
    options: MessageLayoutOptions
) {
    const result = validateMessageView(view, options)
    if (!result.ok) throw new InvalidMessageViewError(result.issues)
}
