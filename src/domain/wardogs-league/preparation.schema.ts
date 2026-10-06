import { PREPARATION_TONES } from "./preparation"
import { z } from "zod"

/** Zod schema of a preparation chip (`panels.ts` view schemas); the chips themselves are built in `preparation.ts`. */
const tone = z.enum(PREPARATION_TONES)
const count = z.number().int().nonnegative().nullable()
const iso = z.iso.datetime().nullable()
export const preparationChipSchema = z.discriminatedUnion("kind", [
    /** "Pravidla 2/3". */
    z.object({
        kind: z.literal("rules"),
        tone,
        picked: count,
        total: count,
    }),
    /** "Hlasování o mapě · končí za 15 h" / "Hlasování o mapě od so 10. 10.". */
    z.object({
        kind: z.literal("mapVote"),
        tone,
        closesAt: iso,
        opensAt: iso,
    }),
    /** "Moderátor přidělen" / "Moderátor zatím není". */
    z.object({ kind: z.literal("moderator"), tone }),
    /** "Ready check nezačal" / running / done. */
    z.object({ kind: z.literal("readyCheck"), tone }),
    /** "Příprava ještě nezačala": every step is still grey. */
    z.object({ kind: z.literal("notStarted"), tone: z.literal("pending") }),
])
export type PreparationChip = z.infer<typeof preparationChipSchema>
