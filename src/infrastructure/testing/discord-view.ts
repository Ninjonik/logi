import assert from "node:assert/strict"

import {
    layoutMessageView,
    type MessageLayout,
} from "@/domain/discord-messages/message-layout"
import { validateMessageView } from "@/domain/discord-messages/message-validation"
import type { MessageView } from "@/domain/discord-messages/message-view"
import { getIntlLocaleForClanLanguage } from "@/lib/clan-language/core"
import { getSystemMessages } from "@/lib/clan-language/system"

/**
 * Lays a view out the way the bot sends it, after asserting it passes the
 * board rules and Discord's limits. For tests of message builders.
 */
export function layoutForTest(
    view: MessageView,
    language = "cs"
): MessageLayout {
    const options = {
        copy: getSystemMessages(language).kit,
        locale: getIntlLocaleForClanLanguage(language),
    }
    const validation = validateMessageView(view, options)
    assert.equal(validation.ok, true, JSON.stringify(validation.issues))
    return layoutMessageView(view, options)
}

/** Every text Discord would show, joined with new lines. */
export function viewText(view: MessageView, language = "cs") {
    return layoutForTest(view, language)
        .nodes.flatMap((node) =>
            node.type === "text"
                ? [node.content]
                : node.type === "section"
                  ? node.texts
                  : node.type === "buttons"
                    ? node.buttons.map((button) => `[${button.label}]`)
                    : []
        )
        .join("\n")
}

/** The buttons of a view in order, with their style or link. */
export function viewButtons(view: MessageView) {
    return view.blocks.flatMap((block) =>
        block.kind === "buttons"
            ? block.buttons.map((button) =>
                  button.kind === "link"
                      ? { label: button.label, link: button.url }
                      : {
                            label: button.label,
                            style: button.style,
                            id: button.id,
                        }
              )
            : []
    )
}
