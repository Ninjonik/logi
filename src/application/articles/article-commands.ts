import type { Clock } from "../ports/clock"

export type ArticleFields = {
    title: string
    description: string
    body: string
    tags: string[]
    attachments: string[]
}
export type ArticleRecord = ArticleFields & {
    id: string
    guildId: string
    authorId: string
    createdAt: string
    updatedAt: string
}
export interface ArticleRepository {
    get(id: string): Promise<ArticleRecord | null>
    create(record: Omit<ArticleRecord, "id">): Promise<string>
    update(
        id: string,
        fields: ArticleFields & { updatedAt: string }
    ): Promise<void>
    delete(id: string): Promise<void>
}

export class ArticleCommands {
    constructor(
        private readonly repository: ArticleRepository,
        private readonly clock: Clock
    ) {}

    async save(
        input: ArticleFields & {
            guildId: string
            authorId: string
            articleId?: string
        }
    ) {
        const fields: ArticleFields = {
            title: input.title.trim(),
            description: input.description.trim(),
            body: input.body,
            tags: input.tags
                .map((value) => value.trim())
                .filter(Boolean)
                .slice(0, 20),
            attachments: input.attachments
                .map((value) => value.trim())
                .filter(Boolean),
        }
        if (!fields.title || !fields.description || !fields.body)
            throw new Error("Title, description, and body are required.")
        const existing = input.articleId
            ? await this.repository.get(input.articleId)
            : null
        if (
            input.articleId &&
            (!existing || existing.guildId !== input.guildId)
        )
            throw new Error("Article not found.")
        const now = this.clock.now().toISOString()
        if (existing) {
            await this.repository.update(existing.id, {
                ...fields,
                updatedAt: now,
            })
            return { ...existing, ...fields, updatedAt: now }
        }
        const record = {
            ...fields,
            guildId: input.guildId,
            authorId: input.authorId,
            createdAt: now,
            updatedAt: now,
        }
        return { ...record, id: await this.repository.create(record) }
    }

    async remove(guildId: string, articleId: string) {
        const existing = await this.repository.get(articleId)
        if (!existing || existing.guildId !== guildId)
            throw new Error("Article not found.")
        await this.repository.delete(articleId)
    }
}
