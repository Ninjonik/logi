export type RankedSignupCopy = Record<
    | "title"
    | "edit"
    | "add"
    | "hint"
    | "remove"
    | "up"
    | "down"
    | "done"
    | "save"
    | "previous"
    | "next"
    | "expired"
    | "saved"
    | "empty"
    | "stale"
    | "locale",
    string
>
import {
    escapeMarkdownText,
    type MessageBlock,
    type MessageButton,
    type MessageView,
} from "./message-view"

export function reorderSignupChoices(
    choices: readonly string[],
    action: "up" | "down" | "remove",
    index: number
) {
    const next = [...choices]
    if (!Number.isInteger(index) || index < 0 || index >= next.length)
        return next
    if (action === "remove") next.splice(index, 1)
    else {
        const target = index + (action === "up" ? -1 : 1)
        if (target >= 0 && target < next.length)
            [next[index], next[target]] = [next[target], next[index]]
    }
    return next
}

/** Four choices per editor page leave room for Done and paging within Discord's budget. */
export function rankedSignupView(input: {
    token: string
    revision: number
    choices: readonly string[]
    options: Array<{ value: string; name: string; general?: boolean }>
    copy: RankedSignupCopy
    editing?: boolean
    page?: number
}): MessageView {
    const { copy, choices } = input
    const id = (action: string) =>
        `ranked-signup:${input.token}:${input.revision}:${action}`
    const button = (
        action: string,
        label: string,
        disabled = false
    ): MessageButton => ({
        kind: "action",
        id: id(action),
        label,
        style: "secondary",
        disabled,
    })
    const blocks: MessageBlock[] = [{ kind: "text", markdown: copy.hint }]
    if (input.editing) {
        const page = Math.max(
            0,
            Math.min(input.page ?? 0, Math.ceil(choices.length / 4) - 1)
        )
        choices.slice(page * 4, page * 4 + 4).forEach((name, offset) => {
            const index = page * 4 + offset
            blocks.push(
                {
                    kind: "text",
                    markdown: `**${index + 1}. ${escapeMarkdownText(name)}**`,
                },
                {
                    kind: "buttons",
                    buttons: [
                        button(`up-${index}`, "↑", index === 0),
                        button(
                            `down-${index}`,
                            "↓",
                            index === choices.length - 1
                        ),
                        button(`remove-${index}`, copy.remove),
                    ],
                }
            )
        })
        blocks.push({
            kind: "buttons",
            buttons: [
                button("done", copy.done),
                ...(choices.length > 4
                    ? [
                          button(`page-${page - 1}`, copy.previous, page === 0),
                          button(
                              `page-${page + 1}`,
                              copy.next,
                              (page + 1) * 4 >= choices.length
                          ),
                      ]
                    : []),
            ],
        })
    } else {
        if (choices.length)
            blocks.push({
                kind: "text",
                markdown: choices
                    .map(
                        (name, index) =>
                            `${index + 1}. ${escapeMarkdownText(name)}`
                    )
                    .join("\n"),
            })
        const remaining = input.options.filter(
            (option) =>
                !choices.includes(option.name) &&
                (!option.general || !choices.length)
        )
        if (remaining.length && choices.length < 25)
            blocks.push({
                kind: "select",
                select: {
                    id: id("add"),
                    placeholder: choices.length ? copy.add : copy.empty,
                    options: remaining.slice(0, 25).map((option) => ({
                        value: option.value,
                        label: option.name.slice(0, 100),
                    })),
                },
            })
        blocks.push({
            kind: "buttons",
            buttons: [
                ...(choices.length > 1 ? [button("edit", copy.edit)] : []),
                {
                    kind: "action",
                    id: id("save"),
                    label: copy.save,
                    style: "success",
                    disabled: !choices.length,
                },
            ],
        })
    }
    return {
        accent: "clan",
        ephemeral: true,
        buttonRowLimit: 5,
        header: { title: input.editing ? copy.edit : copy.title },
        blocks,
    }
}
