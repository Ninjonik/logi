import assert from "node:assert/strict";
import test from "node:test";

import { FakeClock } from "@/infrastructure/testing/fake-clock";

import { CompleteTrainingUseCase } from "./complete-training.use-case";
import type { EventCommandRecord, EventCommandRepository, EventScorePort } from "./command-ports";

class Repo implements EventCommandRepository {
  constructor(public readonly events: Map<string, EventCommandRecord>) {}
  async getById(eventId: string) { return this.events.get(eventId) ?? null; }
  async listAll() { return [...this.events.values()]; }
  async listPage(cursor: string | null, limit: number) {
    const records = [...this.events.values()];
    const start = cursor ? Number(cursor) : 0;
    const page = records.slice(start, start + limit);
    const nextIndex = start + page.length;
    return {
      records: page,
      continueCursor: nextIndex < records.length ? String(nextIndex) : null,
      isDone: nextIndex >= records.length,
    };
  }
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

test("CompleteTrainingUseCase stores completion results and concludes the training", async () => {
  const repo = new Repo(new Map([
    ["event-1", {
      id: "event-1",
      kind: "training",
      guildId: "guild-1",
      registrationEnd: "2026-07-22T10:00:00.000Z",
      meetingStart: "2026-07-22T11:00:00.000Z",
      gameEnd: "2026-07-22T14:00:00.000Z",
      status: "starting",
      participants: [
        { userId: "user-1", status: "attending", updatedAt: "2026-07-22T11:00:00.000Z" },
        { userId: "user-2", status: "attending", updatedAt: "2026-07-22T11:00:00.000Z" },
        { userId: "user-3", status: "not_attending", updatedAt: "2026-07-22T11:00:00.000Z" },
      ],
    }],
  ]));
  const scores = new Scores();
  const useCase = new CompleteTrainingUseCase(repo, scores, new FakeClock(new Date("2026-07-22T12:30:00.000Z")));

  const result = await useCase.execute("event-1", {
    participants: [
      { userId: "user-1", completed: "passed" },
      { userId: "user-2", completed: "failed" },
    ],
  });

  assert.deepEqual(result, { ok: true });
  assert.equal(repo.events.get("event-1")?.status, "concluded");
  assert.deepEqual(repo.events.get("event-1")?.participants, [
    { userId: "user-1", status: "attending", completed: "passed", updatedAt: "2026-07-22T12:30:00.000Z" },
    { userId: "user-2", status: "attending", completed: "failed", updatedAt: "2026-07-22T12:30:00.000Z" },
    { userId: "user-3", status: "not_attending", updatedAt: "2026-07-22T11:00:00.000Z" },
  ]);
  assert.deepEqual(scores.calls, ["event-1"]);
});

test("CompleteTrainingUseCase requires results for each attending participant", async () => {
  const repo = new Repo(new Map([
    ["event-1", {
      id: "event-1",
      kind: "training",
      guildId: "guild-1",
      registrationEnd: "2026-07-22T10:00:00.000Z",
      meetingStart: "2026-07-22T11:00:00.000Z",
      gameEnd: "2026-07-22T14:00:00.000Z",
      status: "starting",
      participants: [
        { userId: "user-1", status: "attending", updatedAt: "2026-07-22T11:00:00.000Z" },
        { userId: "user-2", status: "attending", updatedAt: "2026-07-22T11:00:00.000Z" },
      ],
    }],
  ]));
  const useCase = new CompleteTrainingUseCase(repo, new Scores(), new FakeClock(new Date("2026-07-22T12:30:00.000Z")));

  await assert.rejects(
    () => useCase.execute("event-1", {
      participants: [{ userId: "user-1", completed: "passed" }],
    }),
    /Each attending participant must have a completion result\./,
  );
});
