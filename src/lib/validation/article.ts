import { z } from "zod"

/** Field codes the article form maps to localized messages. */
export type ArticleFieldError = "title" | "description" | "body" | "attachments"

/** An article written in the dashboard; the Convex mutation trims and stores it. */
export const articleCreateSchema = z.strictObject({
    title: z.string().trim().min(1).max(300),
    description: z.string().trim().min(1).max(2000),
    tags: z.array(z.string().max(100)).max(50).default([]),
    body: z
        .string()
        .max(200_000)
        .refine((value) => value.trim().length > 0),
    attachments: z
        .array(z.url({ protocol: /^https?$/ }).max(2048))
        .max(50)
        .default([]),
})

export type ArticleCreateInput = z.infer<typeof articleCreateSchema>

/** The first invalid field of a rejected article, for the form to highlight. */
export function getArticleFieldError(
    error: z.ZodError
): ArticleFieldError | undefined {
    const field = error.issues[0]?.path[0]
    return field === "title" ||
        field === "description" ||
        field === "body" ||
        field === "attachments"
        ? field
        : undefined
}
