import type { DashboardActor } from "../../../../convex/dashboardActor"
import type { TestRow } from "./database"

export const actorFixture: DashboardActor = {
    sid: "a".repeat(43),
    subject: "100000000000000001",
    userRecordId: "users:admin",
    superadmin: false,
}
/** Synthetic durable identity, independent of provider/Discord credentials. */
export function seedDashboardActor(
    db: { tables: Record<string, TestRow[]> },
    guildId = "guild-a"
) {
    db.tables.users ??= []
    db.tables.users.push({
        _id: actorFixture.userRecordId,
        discordId: actorFixture.subject,
        name: "Fixture admin",
        sessionVersion: 0,
    })
    db.tables.dashboardSessions = [
        {
            _id: "sessions:admin",
            sid: actorFixture.sid,
            subject: actorFixture.subject,
            userRecordId: actorFixture.userRecordId,
            userSessionVersion: 0,
            expiresAt: Date.now() + 3_600_000,
            createdAt: Date.now(),
        },
    ]
    db.tables.guilds ??= []
    let guild = db.tables.guilds.find((row) => row.discordId === guildId)
    if (!guild) {
        guild = { _id: "guilds:admin", discordId: guildId }
        db.tables.guilds.push(guild)
    }
    guild.adminIds ??= []
    db.tables.discordMemberAccess = [
        {
            _id: "access:admin",
            guildId,
            userId: actorFixture.subject,
            isAdmin: true,
            hasDashboardAccess: true,
        },
    ]
    return actorFixture
}
