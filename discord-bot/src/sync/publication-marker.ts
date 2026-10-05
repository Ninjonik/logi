/**
 * How a managed message is found again after an uncertain create, without
 * anything visible. Ownership is the stored message ID: edits, existence
 * checks and removal always use `discordPublications.messageId`. Only the
 * window between "POST sent" and "message ID saved" (a crash or a lost
 * response) needs a tag, and that tag is the numeric component `id` of the
 * message's first top-level component, which Discord stores but never shows.
 * The old disabled "Automatic updates" button is gone.
 */

import { createHash } from "node:crypto"

import { isJSONEncodable, type MessageCreateOptions } from "discord.js"

type TopLevelComponent = NonNullable<MessageCreateOptions["components"]>[number]

/**
 * Bumped when the delivered payload shape changes so every managed message
 * is edited once: v2 removes the "Automatic updates" marker row from
 * messages created before.
 */
export const PUBLICATION_RENDER_VERSION = "v2-no-marker"

/**
 * The invisible component id for one create attempt (`marker` is
 * `logi:publication:<id>:<fence>`): a stable 32-bit integer far above the
 * small sequential ids Discord assigns to untagged components.
 */
export function publicationComponentId(marker: string) {
    const hash = createHash("sha256").update(marker).digest()
    return 1_000_000_000 + (hash.readUInt32BE(0) % 1_000_000_000)
}

/** The Discord nonce of a create attempt, so a retried POST is deduplicated. */
export function publicationNonce(marker: string) {
    return BigInt(
        `0x${createHash("sha256").update(marker).digest("hex").slice(0, 16)}`
    ).toString()
}

/**
 * The components of a create request with the attempt's id on the first
 * top-level component. Nothing is added: a message without components gets
 * no tag, and its uncertain create then waits for operator reconciliation.
 */
export function tagPublicationComponents(
    components: readonly TopLevelComponent[] | undefined,
    marker: string
): TopLevelComponent[] {
    const [first, ...rest] = components ?? []
    if (!first) return []
    const json = isJSONEncodable(first) ? first.toJSON() : first
    return [{ ...json, id: publicationComponentId(marker) }, ...rest]
}

/**
 * The create request of one attempt: the message as given, its first
 * component tagged, no pings unless the message allows them, and the nonce
 * Discord uses to drop a retried POST.
 */
export function publicationCreatePayload(
    message: MessageCreateOptions,
    marker: string
): MessageCreateOptions {
    return {
        ...message,
        components: tagPublicationComponents(message.components, marker),
        allowedMentions: message.allowedMentions ?? { parse: [] },
        nonce: publicationNonce(marker),
        enforceNonce: true,
    }
}

const componentId = (component: unknown) => {
    const json =
        typeof component === "object" &&
        component !== null &&
        isJSONEncodable(component)
            ? component.toJSON()
            : component
    return typeof json === "object" && json !== null && "id" in json
        ? json.id
        : undefined
}

/**
 * The bot's message from a create attempt among recent channel messages,
 * matched by the invisible component id. Null when it is not there; more
 * than one match needs an operator.
 */
export function findPublicationMessage(
    messages: Iterable<{
        id: string
        author: { id: string }
        components: readonly unknown[]
    }>,
    marker: string,
    botUserId: string | undefined
) {
    const id = publicationComponentId(marker)
    const matches = [...messages].filter(
        (message) =>
            message.author.id === botUserId &&
            message.components.some(
                (component) => componentId(component) === id
            )
    )
    if (matches.length > 1)
        throw new Error(
            "Multiple owned publication markers require operator reconciliation."
        )
    return matches[0]?.id ?? null
}
