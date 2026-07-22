import assert from "node:assert/strict";
import test from "node:test";

import { UpdateRosterAttendanceUseCase, UpsertRosterUseCase, type RosterCommandRepository } from "./roster-commands.use-case";

class InMemoryRosterCommandRepository implements RosterCommandRepository {
  constructor(
    public rosters: Map<string, any>,
    public event: any,
    public assignments: any[],
  ) {}

  async getRosterById(rosterId: string) { return this.rosters.get(rosterId) ?? null; }
  async getRosterByEventId(eventId: string) { return [...this.rosters.values()].find((roster) => roster.eventId === eventId) ?? null; }
  async getEvent() { return this.event; }
  async listAssignments() { return this.assignments; }
  async createRoster(roster: any) {
    const id = `roster-${this.rosters.size + 1}`;
    this.rosters.set(id, { id, ...roster });
    return id;
  }
  async updateRoster(rosterId: string, roster: any) {
    this.rosters.set(rosterId, { id: rosterId, ...roster });
  }
}

test("UpsertRosterUseCase adds tracked attendees to reserve when creating a roster", async () => {
  const repo = new InMemoryRosterCommandRepository(
    new Map(),
    {
      guildId: "guild-1",
      registrationEnd: "2026-07-21T10:00:00.000Z",
      participants: [{ userId: "user-1", status: "attending", updatedAt: "2026-07-20T10:00:00.000Z" }],
      updatedAt: "2026-07-20T10:00:00.000Z",
      createdAt: "2026-07-20T10:00:00.000Z",
    },
    [{ userId: "user-1", serverId: "guild-1", createdAt: "2026-07-19T10:00:00.000Z" }],
  );

  const rosterId = await new UpsertRosterUseCase(repo).execute({
    eventId: "event-1",
    squads: [],
    reservePlayerIds: [],
    reserveAttendances: [],
    notAttendingPlayerIds: [],
    published: false,
  });

  assert.equal(rosterId, "roster-1");
  assert.deepEqual(repo.rosters.get("roster-1")?.reservePlayerIds, ["user-1"]);
});

test("UpdateRosterAttendanceUseCase updates reserve attendance confirmation state", async () => {
  const repo = new InMemoryRosterCommandRepository(
    new Map([["roster-1", {
      id: "roster-1",
      eventId: "event-1",
      squads: [],
      reservePlayerIds: ["user-1"],
      reserveAttendances: [{ userId: "user-1", ack: false, confirmed: false }],
      notAttendingPlayerIds: [],
      published: false,
    }]]),
    null,
    [],
  );

  await new UpdateRosterAttendanceUseCase(repo).setStatus("event-1", "user-1", "confirmed");

  assert.deepEqual(repo.rosters.get("roster-1")?.reserveAttendances, [{ userId: "user-1", ack: true, confirmed: true }]);
});

test("UpdateRosterAttendanceUseCase updates squad player attendance", async () => {
  const repo = new InMemoryRosterCommandRepository(
    new Map([["roster-1", {
      id: "roster-1",
      eventId: "event-1",
      squads: [{
        name: "Able",
        group: "INF",
        order: 1,
        color: "#fff",
        players: [{ id: "user-1", ack: false, confirmed: false }],
      }],
      reservePlayerIds: [],
      reserveAttendances: [],
      notAttendingPlayerIds: [],
      published: false,
    }]]),
    null,
    [],
  );

  await new UpdateRosterAttendanceUseCase(repo).acknowledge("event-1", "user-1");

  assert.deepEqual(repo.rosters.get("roster-1")?.squads[0]?.players[0], { id: "user-1", ack: true, confirmed: false });
});

test("UpdateRosterAttendanceUseCase rejects missing rosters", async () => {
  const repo = new InMemoryRosterCommandRepository(new Map(), null, []);

  await assert.rejects(() => new UpdateRosterAttendanceUseCase(repo).setStatus("event-1", "user-1", "confirmed"), /Roster not found/);
});
