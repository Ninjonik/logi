import type {
    AssignmentCommandRepository,
    AssignmentRosterSyncPort,
} from "./ports"
import { selfAssignedSecondaryGroups } from "@/domain/assignments/self-groups"
import { UpsertAssignmentUseCase } from "./upsert-assignment.use-case"
import type { Clock } from "@/application/ports/clock"

export interface SelfGroupPolicyPort {
    allowedGroupIds(guildId: string, gameId: string): Promise<string[]>
}

export class SelfAssignGroupUseCase {
    constructor(
        private readonly repository: AssignmentCommandRepository,
        private readonly rosterSync: AssignmentRosterSyncPort,
        private readonly clock: Clock,
        private readonly policy: SelfGroupPolicyPort
    ) {}

    async execute(input: {
        guildId: string
        gameId: string
        userId: string
        groupId: string
        enabled: boolean
    }) {
        const allowedGroupIds = await this.policy.allowedGroupIds(
            input.guildId,
            input.gameId
        )
        const assignment = await this.repository.getByServerUser(
            input.guildId,
            input.userId,
            input.gameId
        )
        if (!assignment) throw new Error("self_groups:membership_required")
        const secondaryGroupIds = selfAssignedSecondaryGroups({
            ...input,
            allowedGroupIds,
            assignment,
        })
        if (
            JSON.stringify(secondaryGroupIds) ===
            JSON.stringify(assignment.secondaryGroupIds)
        )
            return assignment.id
        return new UpsertAssignmentUseCase(
            this.repository,
            this.rosterSync,
            this.clock
        ).execute({
            ...assignment,
            assignmentId: assignment.id,
            serverDiscordId: input.guildId,
            secondaryGroupIds,
        })
    }
}
