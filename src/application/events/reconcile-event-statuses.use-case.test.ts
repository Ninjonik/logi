import assert from "node:assert/strict";
import test from "node:test";

import { FakeClock } from "@/infrastructure/testing/fake-clock";

import { ReconcileEventStatusesUseCase } from "./reconcile-event-statuses.use-case";
import type { EventCommandRecord, EventCommandRepository, EventScorePort } from "./command-ports";

class Repo implements EventCommandRepository {
  constructor(public readonly events: Map<string, EventCommandRecord>) {}
  async getById(eventId: string) { return this.events.get(eventId) ?? null; }
  async listAll() { return [...this.events.values()]; }
  async create(): Promise<string> { throw new Error("unused"); }
  async update(eventId: string, patch: Record<string, unknown>) {
    const existing = this.events.get(eventId);
    if (existing) this.events.set(eventId, { ...existing, ...patch });
  }
  async updateStatus(eventId: string, patch: any) { await this.update(eventId, patch); }
}

class Scores implements EventScorePort {
  public readonly calls: string[] = [];
  async applyScoreToEventSignups(eventId: string) { this.calls.push(eventId); }
}

test("ReconcileEventStatusesUseCase updates stale event status and scores concluded events", async () => {
  const repo = new Repo(new Map([
    ["event-1", {
      id: "event-1",
      guildId: "guild-1",
      registrationEnd: "2026-07-21T10:00:00.000Z",
      meetingStart: "2026-07-21T11:00:00.000Z",
      gameEnd: "2026-07-21T14:00:00.000Z",
      status: "registration",
      participants: [],
      signUps: [],
      absenceNotices: [],
    }],
  ]));
  const scores = new Scores();
  const useCase = new ReconcileEventStatusesUseCase(repo, scores, new FakeClock(new Date("2026-07-22T12:00:00.000Z")));

  const changed = await useCase.execute();

  assert.deepEqual(changed, ["event-1"]);
  assert.equal(repo.events.get("event-1")?.status, "concluded");
  assert.deepEqual(scores.calls, ["event-1"]);
});
