import assert from "node:assert/strict";
import test from "node:test";

import type { RosterScoreSettings } from "@/domain/events/score-policy";

import { ApplyEventScoreUseCase, type EventScoreRepository } from "./apply-event-score.use-case";

class InMemoryEventScoreRepository implements EventScoreRepository {
  public readonly updatedUsers: string[] = [];

  constructor(
    public event: Awaited<ReturnType<EventScoreRepository["getEvent"]>>,
    public roster: Awaited<ReturnType<EventScoreRepository["getRoster"]>>,
    public assignments: Array<{ userId: string; paused: boolean }>,
    public users: Array<{ id: string; userId: string; score?: number; scores?: Record<string, number> }>,
    public settings: RosterScoreSettings,
  ) {}

  async getEvent() { return this.event; }
  async getRoster() { return this.roster; }
  async listAssignments() { return this.assignments; }
  async getScoreSettings() { return this.settings; }
  async getUsers(userIds: string[]) { return this.users.filter((user) => userIds.includes(user.userId)); }
  async updateUserScore(userId: string, patch: { score: number; scores: Record<string, number> }) {
    this.updatedUsers.push(userId);
    this.users = this.users.map((user) => (user.userId === userId ? { ...user, ...patch } : user));
  }
  async markEventScoreApplied() {
    if (this.event) this.event = { ...this.event, scoreResolution: "applied" };
  }
  async markEventScoreSkipped() {
    if (this.event) this.event = { ...this.event, scoreResolution: "skipped" };
  }
}

test("ApplyEventScoreUseCase applies score deltas to active assignments only", async () => {
  const repo = new InMemoryEventScoreRepository(
    {
      id: "event-1",
      guildId: "guild-1",
      meetingStart: "2026-07-21T10:00:00.000Z",
      status: "concluded",
      participants: [{ userId: "user-1", status: "attending" }, { userId: "user-2", status: "not_attending" }],
      absenceNotices: [],
      concludedAt: "2026-07-21T13:00:00.000Z",
    },
    {
      squads: [{ players: [{ id: "user-1", confirmed: true }] }],
      reservePlayerIds: [],
      reserveAttendances: [],
    },
    [{ userId: "user-1", paused: false }, { userId: "user-2", paused: true }],
    [
      { id: "1", userId: "user-1", score: 10, scores: { "guild-1": 10 } },
      { id: "2", userId: "user-2", score: 8, scores: { "guild-1": 8 } },
    ],
    {
      noCategory: 0,
      declined: 1,
      rosterPresent: 5,
      reservePresent: 3,
      rosterAbsent: -2,
      reserveAbsent: -1,
      excusedAbsence: 2,
    },
  );

  const result = await new ApplyEventScoreUseCase(repo).execute("event-1");

  assert.equal(result, true);
  assert.deepEqual(repo.updatedUsers, ["user-1"]);
  assert.equal(repo.users.find((user) => user.userId === "user-1")?.scores?.["guild-1"], 15);
  assert.equal(repo.event?.scoreResolution, "applied");
});

test("ApplyEventScoreUseCase skips events concluded before meeting start", async () => {
  const repo = new InMemoryEventScoreRepository(
    {
      id: "event-1",
      guildId: "guild-1",
      meetingStart: "2026-07-21T10:00:00.000Z",
      status: "concluded",
      participants: [],
      absenceNotices: [],
      concludedAt: "2026-07-21T09:00:00.000Z",
    },
    null,
    [],
    [],
    {
      noCategory: 0,
      declined: 1,
      rosterPresent: 5,
      reservePresent: 3,
      rosterAbsent: -2,
      reserveAbsent: -1,
      excusedAbsence: 2,
    },
  );

  const result = await new ApplyEventScoreUseCase(repo).execute("event-1");

  assert.equal(result, false);
  assert.equal(repo.event?.scoreResolution, "skipped");
});
