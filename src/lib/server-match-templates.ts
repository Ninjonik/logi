import { makeFunctionReference } from "convex/server"
import { fetchMutation } from "convex/nextjs"

import type {
    MatchTemplate,
    MatchTemplateError,
} from "@/domain/events/match-templates"
import { getInternalAuthSecret } from "@/lib/env"

const saveMatchTemplatesReference = makeFunctionReference<"mutation">(
    "guilds:saveMatchTemplates"
)

export type SaveMatchTemplatesResult =
    | { ok: true; templates: MatchTemplate[] }
    | { ok: false; error: MatchTemplateError; index?: number }

/** Replaces a clan's match templates; Convex drops references to other clans. */
export async function saveMatchTemplates(
    serverId: string,
    templates: MatchTemplate[]
): Promise<SaveMatchTemplatesResult> {
    return (await fetchMutation(saveMatchTemplatesReference, {
        secret: getInternalAuthSecret(),
        guildId: serverId as never,
        templates,
    })) as SaveMatchTemplatesResult
}
