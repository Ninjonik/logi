import type {
    ArticleFields,
    ArticleRecord,
    ArticleRepository,
} from "../../application/articles/article-commands"
import type { MutationCtx } from "../../../convex/_generated/server"
import type { Id } from "../../../convex/_generated/dataModel"

export class ConvexArticleRepository implements ArticleRepository {
    constructor(private readonly ctx: MutationCtx) {}
    async get(id: string) {
        const record = await this.ctx.db.get(id as Id<"articles">)
        return record
            ? {
                  id: String(record._id),
                  guildId: record.guildId,
                  authorId: record.authorId,
                  title: record.title,
                  description: record.description,
                  body: record.body,
                  tags: record.tags,
                  attachments: record.attachments,
                  createdAt: record.createdAt,
                  updatedAt: record.updatedAt,
              }
            : null
    }
    async create(record: Omit<ArticleRecord, "id">) {
        return String(await this.ctx.db.insert("articles", record))
    }
    async update(id: string, fields: ArticleFields & { updatedAt: string }) {
        await this.ctx.db.patch(id as Id<"articles">, fields)
    }
    async delete(id: string) {
        await this.ctx.db.delete(id as Id<"articles">)
    }
}
