import {
    errorCard,
    notAllowedCard,
    wrongPlaceCard,
    type MessageButton,
    type MessageView,
} from "../discord-messages/message-view"
import { channelMention, joinNatural, roleMention } from "./text"
import { fillTemplate } from "../discord-messages/format"
import type { CommandDecision } from "./permissions"
import type { CommandAudience } from "./catalog"

/** The access copy of the commands module (`clan-language/commands.ts`). */
export type CommandAccessCopy = {
    disabledTitle: string
    disabledBody: string
    notAllowedTitle: Record<Exclude<CommandAudience, "everyone">, string>
    notAllowedBody: Record<Exclude<CommandAudience, "everyone">, string>
    extraRoles: string
    wrongChannelTitle: string
    wrongChannelBody: string
    verifyFailedTitle: string
    verifyFailedBody: string
    notConnectedTitle: string
    notConnectedBody: string
    aboutLogi: string
    and: string
    or: string
}

/**
 * The private card for a refused command (M3-B01): "vypnuto" says who can
 * switch it on, "nepovoleno" who may use it, "jinde" where it works. The
 * command name is shown as it is typed, e.g. `/player`.
 */
export function commandDecisionCard(
    decision: Exclude<CommandDecision, { kind: "allowed" }>,
    input: { command: string; copy: CommandAccessCopy }
): MessageView {
    const { copy } = input
    const command = `/${input.command}`
    switch (decision.kind) {
        case "disabled":
            return errorCard({
                title: fillTemplate(copy.disabledTitle, { command }),
                body: copy.disabledBody,
            })
        case "notAllowed": {
            const audience =
                decision.audience === "everyone"
                    ? "logiAdmins"
                    : decision.audience
            const roles = decision.roleIds
                .map(roleMention)
                .filter((value): value is string => Boolean(value))
            return notAllowedCard({
                title: fillTemplate(copy.notAllowedTitle[audience], {
                    command,
                }),
                whoMay: [
                    copy.notAllowedBody[audience],
                    ...(roles.length
                        ? [
                              fillTemplate(copy.extraRoles, {
                                  roles: joinNatural(roles, copy.or),
                              }),
                          ]
                        : []),
                ].join(" "),
            })
        }
        case "wrongChannel": {
            const channels = decision.channelIds
                .map(channelMention)
                .filter((value): value is string => Boolean(value))
            return wrongPlaceCard({
                title: fillTemplate(copy.wrongChannelTitle, { command }),
                whereItWorks: fillTemplate(copy.wrongChannelBody, {
                    channels: joinNatural(channels, copy.or),
                }),
            })
        }
    }
}

/** Discord did not answer the fresh role check (M3-33's wording). */
export function verifyFailedCard(copy: CommandAccessCopy): MessageView {
    return errorCard({
        title: copy.verifyFailedTitle,
        body: copy.verifyFailedBody,
    })
}

/** The server is not connected to Logi yet (M2-10), with "Co je Logi". */
export function notConnectedCard(
    copy: CommandAccessCopy,
    aboutUrl: string | undefined
): MessageView {
    const action: MessageButton | undefined = aboutUrl
        ? { kind: "link", url: aboutUrl, label: copy.aboutLogi }
        : undefined
    return errorCard({
        title: copy.notConnectedTitle,
        body: copy.notConnectedBody,
        action,
    })
}
