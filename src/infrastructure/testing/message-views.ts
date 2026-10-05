import {
    layoutMessageView,
    type MessageLayoutOptions,
} from "../../domain/discord-messages/message-layout"
import type {
    MessageButton,
    MessageView,
} from "../../domain/discord-messages/message-view"
import { validateMessageView } from "../../domain/discord-messages/message-validation"
import { getIntlLocaleForClanLanguage } from "../../lib/clan-language/core"
import { getSystemMessages } from "../../lib/clan-language/system"

/**
 * A view laid out exactly as the bot sends it, with the clan's real frame
 * copy: the visible text, the buttons and whether Discord would accept it.
 * For tests of the shared panel views; no Discord client involved.
 */
export function renderedView(view: MessageView, language = "cs") {
    const options: MessageLayoutOptions = {
        copy: getSystemMessages(language).kit,
        locale: getIntlLocaleForClanLanguage(language),
    }
    const layout = layoutMessageView(view, options)
    const texts = layout.nodes.flatMap((node) =>
        node.type === "text"
            ? [node.content]
            : node.type === "section"
              ? node.texts
              : []
    )
    const buttons: MessageButton[] = layout.nodes.flatMap((node) =>
        node.type === "buttons" ? node.buttons : []
    )
    const media = layout.nodes.flatMap((node) =>
        node.type === "gallery"
            ? node.items.map((item) => item.url)
            : node.type === "section"
              ? [node.thumbnail.url]
              : []
    )
    return {
        validation: validateMessageView(view, options),
        layout,
        text: texts.join("\n"),
        buttons,
        media,
    }
}
