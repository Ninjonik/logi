import type {
    GroupFields,
    GroupRecord,
    GroupRepository,
} from "../../application/groups/group-commands"
import type { MutationCtx } from "../../../convex/_generated/server"
import type { Id } from "../../../convex/_generated/dataModel"

export class ConvexGroupRepository implements GroupRepository {
    constructor(private readonly ctx: MutationCtx) {}
    async get(id: string) {
        const record = await this.ctx.db.get(id as Id<"groups">)
        return record ? { ...record, id: String(record._id) } : null
    }
    async findByName(guildId: string, name: string) {
        return (
            await this.ctx.db
                .query("groups")
                .withIndex("guildId_name", (q) =>
                    q.eq("guildId", guildId).eq("name", name)
                )
                .collect()
        ).map((record) => ({ ...record, id: String(record._id) }))
    }
    async create(record: Omit<GroupRecord, "id">) {
        return String(
            await this.ctx.db.insert("groups", {
                ...record,
                parentId: record.parentId as Id<"groups"> | undefined,
            })
        )
    }
    async update(id: string, fields: GroupFields & { updatedAt: string }) {
        await this.ctx.db.patch(id as Id<"groups">, {
            ...fields,
            parentId: fields.parentId as Id<"groups"> | undefined,
        })
    }
    async assignments(guildId: string) {
        return (
            await this.ctx.db
                .query("userAssignments")
                .withIndex("serverId", (q) => q.eq("serverId", guildId))
                .collect()
        ).map((record) => ({ ...record, id: String(record._id) }))
    }
    async updateAssignment(
        id: string,
        fields: {
            primaryGroupId?: string
            secondaryGroupIds: string[]
            updatedAt: string
        }
    ) {
        await this.ctx.db.patch(id as Id<"userAssignments">, {
            ...fields,
            primaryGroupId: fields.primaryGroupId as Id<"groups"> | undefined,
            secondaryGroupIds: fields.secondaryGroupIds as Id<"groups">[],
        })
    }
    async delete(id: string) {
        await this.ctx.db.delete(id as Id<"groups">)
    }
}
