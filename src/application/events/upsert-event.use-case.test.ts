import assert from "node:assert/strict";
import test from "node:test";

import { FakeClock } from "@/infrastructure/testing/fake-clock";

import { UpsertEventUseCase } from "./upsert-event.use-case";
import type { EventCommandRecord, EventCommandRepository, EventScorePort } from "./command-ports";

class InMemoryEventCommandRepository implements EventCommandRepository {
  constructor(public readonly events: Map<string, EventCommandRecord>) {}

  async getById(eventId: string): Promise<EventCommandRecord | null> {
    return this.events.get(eventId) ?? null;
  }

  async listAll(): Promise<EventCommandRecord[]> {
    return [...this.events.values()];
  }

  async create(input: any): Promise<string> {
    const id = `event-${this.events.size + 1}`;
    this.events.set(id, { id, ...input });
    return id;
  }

  async update(eventId: string, patch: Record<string, unknown>): Promise<void> {
    const existing = this.events.get(eventId);
    if (!existing) return;
    this.events.set(eventId, { ...existing, ...patch });
  }

  async updateStatus(eventId: string, patch: any): Promise<void> {
    await this.update(eventId, patch);
  }
}

class RecordingScorePort implements EventScorePort {
  public readonly calls: string[] = [];
  async applyScoreToEventSignups(eventId: string): Promise<void> {
    this.calls.push(eventId);
  }
}

test("UpsertEventUseCase creates a new event record", async () => {
  const repo = new InMemoryEventCommandRepository(new Map());
  const scores = new RecordingScorePort();
  const useCase = new UpsertEventUseCase(repo, scores, new FakeClock(new Date("2026-07-22T12:00:00.000Z")));

  const eventId = await useCase.execute({
    guildId: "guild-1",
    kind: "match",
    name: " New Event ",
    registrationEnd: "2026-07-23T10:00:00.000Z",
    meetingStart: "2026-07-23T11:00:00.000Z",
    gameStart: "2026-07-23T12:00:00.000Z",
    gameEnd: "2026-07-23T14:00:00.000Z",
    pingClan: true,
  });

  assert.equal(eventId, "event-1");
  assert.equal(repo.events.get(eventId)?.name, "New Event");
  assert.equal(scores.calls.length, 0);
});

test("UpsertEventUseCase updates an existing event and triggers scoring when concluded", async () => {
  const repo = new InMemoryEventCommandRepository(new Map([
    ["event-1", {
      id: "event-1",
      guildId: "guild-1",
      kind: "match",
      name: "Old",
      registrationEnd: "2026-07-21T10:00:00.000Z",
      meetingStart: "2026-07-21T11:00:00.000Z",
      gameEnd: "2026-07-21T14:00:00.000Z",
      status: "registration",
      participants: [],
      signUps: [],
      absenceNotices: [],
    }],
  ]));
  const scores = new RecordingScorePort();
  const useCase = new UpsertEventUseCase(repo, scores, new FakeClock(new Date("2026-07-22T12:00:00.000Z")));

  const eventId = await useCase.execute({
    eventId: "event-1",
    guildId: "guild-1",
    kind: "match",
    name: "Updated",
    registrationEnd: "2026-07-21T10:00:00.000Z",
    meetingStart: "2026-07-21T11:00:00.000Z",
    gameStart: "2026-07-21T12:00:00.000Z",
    gameEnd: "2026-07-21T14:00:00.000Z",
    pingClan: false,
  });

  assert.equal(eventId, "event-1");
  assert.equal(repo.events.get("event-1")?.status, "concluded");
  assert.deepEqual(scores.calls, ["event-1"]);
});
