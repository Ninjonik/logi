import {
    projectEventSummary,
    projectMatchSummary,
} from "../src/domain/api/event-summaries"
import { projectHealth, projectSnapshot } from "../src/domain/game-data/policy"
import { projectResultSummary } from "../src/domain/api/result-summaries"
import type { SyncResource } from "../src/domain/integrations/change"
import type { Doc } from "./_generated/dataModel"

/**
 * The website projections of one tracked row, read by the change feed
 * (`integrationChanges:readSyncRecord`). Kept apart from `integrationMutation.ts`:
 * the mutation wrapper compares fingerprints and must not bundle the
 * summary schemas behind these projections.
 */
export type ProjectedTable =
    "events" | "gameDataConnections" | "userAssignments"
type Row = Doc<"events"> | Doc<"gameDataConnections"> | Doc<"userAssignments">
export function projectIntegrationRow(
    table: ProjectedTable,
    row: Row | null,
    now: number
): Array<{
    resource: SyncResource
    data: { id: string; guildId: string; gameId: string }
}> {
    if (!row) return []
    if (table === "userAssignments") return [] // Per-key membership projection is read separately.
    if (table === "events") {
        const event = row as Doc<"events">
        // Drafts are not part of the website feed until they are published.
        if (event.isDraft === true) return []
        return [
            { resource: "event-summaries", data: projectEventSummary(event) },
            ...((event.kind ?? "match") === "match"
                ? [
                      {
                          resource: "match-summaries" as const,
                          data: projectMatchSummary(event),
                      },
                      {
                          resource: "result-summaries" as const,
                          data: projectResultSummary(event),
                      },
                  ]
                : []),
        ]
    }
    const connection = {
        ...(row as Doc<"gameDataConnections">),
        id: String(row._id),
    }
    return [
        {
            resource: "server-snapshots",
            data: projectSnapshot(connection, now),
        },
        {
            resource: "integration-health",
            data: projectHealth(connection, now),
        },
    ]
}
