import { resolveGameScope } from "../../domain/games/game"
import type { Clock } from "../ports/clock"

export type GroupFields = {
    name: string
    color: string
    order: number
    parentId?: string
    description?: string
    discordRoleId?: string
    discordEmoji?: string
}
export type GroupRecord = GroupFields & {
    id: string
    guildId: string
    gameId?: string
    createdAt: string
    updatedAt: string
}
export type GroupAssignment = {
    id: string
    primaryGroupId?: string
    secondaryGroupIds?: string[]
}
export interface GroupRepository {
    get(id: string): Promise<GroupRecord | null>
    findByName(guildId: string, name: string): Promise<GroupRecord[]>
    create(record: Omit<GroupRecord, "id">): Promise<string>
    update(
        id: string,
        fields: GroupFields & { updatedAt: string }
    ): Promise<void>
    assignments(guildId: string): Promise<GroupAssignment[]>
    updateAssignment(
        id: string,
        fields: {
            primaryGroupId?: string
            secondaryGroupIds: string[]
            updatedAt: string
        }
    ): Promise<void>
    delete(id: string): Promise<void>
}

export class GroupCommands {
    constructor(
        private readonly repository: GroupRepository,
        private readonly clock: Clock
    ) {}
    async save(
        input: GroupFields & {
            guildId: string
            gameId?: string
            groupId?: string
        }
    ) {
        const name = input.name.trim()
        if (!name) throw new Error("Group name is required.")
        if (
            !/^#[0-9A-Fa-f]{6}$/.test(input.color) ||
            !Number.isInteger(input.order)
        )
            throw new Error(
                "name, a #RRGGBB color, and an integer order are required."
            )
        const existing = input.groupId
            ? await this.repository.get(input.groupId)
            : null
        if (input.groupId && (!existing || existing.guildId !== input.guildId))
            throw new Error("Group not found.")
        const gameId = existing?.gameId ?? input.gameId
        if (input.parentId) {
            const parent = await this.repository.get(input.parentId)
            if (
                !parent ||
                parent.guildId !== input.guildId ||
                resolveGameScope(parent.gameId) !== resolveGameScope(gameId)
            )
                throw new Error("Parent group not found.")
        }
        const duplicates = await this.repository.findByName(input.guildId, name)
        if (
            duplicates.some(
                (group) =>
                    group.id !== input.groupId &&
                    resolveGameScope(group.gameId) === resolveGameScope(gameId)
            )
        )
            throw new Error("A group with this name already exists.")
        const now = this.clock.now().toISOString()
        const fields = {
            name,
            color: input.color,
            order: input.order,
            parentId: input.parentId,
            description: input.description,
            discordRoleId: input.discordRoleId?.trim() || undefined,
            discordEmoji: input.discordEmoji?.trim() || undefined,
            updatedAt: now,
        }
        if (existing) {
            await this.repository.update(existing.id, fields)
            return { ...existing, ...fields }
        }
        const record = {
            ...fields,
            guildId: input.guildId,
            gameId,
            createdAt: now,
        }
        return { ...record, id: await this.repository.create(record) }
    }
    async remove(guildId: string, groupId: string) {
        const group = await this.repository.get(groupId)
        if (!group || group.guildId !== guildId)
            throw new Error("Group not found.")
        const assignments = await this.repository.assignments(guildId)
        const now = this.clock.now().toISOString()
        for (const assignment of assignments) {
            if (
                assignment.primaryGroupId === groupId ||
                assignment.secondaryGroupIds?.includes(groupId)
            )
                await this.repository.updateAssignment(assignment.id, {
                    primaryGroupId:
                        assignment.primaryGroupId === groupId
                            ? undefined
                            : assignment.primaryGroupId,
                    secondaryGroupIds: (
                        assignment.secondaryGroupIds ?? []
                    ).filter((id) => id !== groupId),
                    updatedAt: now,
                })
        }
        await this.repository.delete(groupId)
    }
}
