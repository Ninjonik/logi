import type { AttendanceStatus } from "@/domain/rosters/types";
import { acknowledgeRosterAttendance, setRosterAttendanceStatus } from "@/domain/rosters/attendance-policy";
import { mergeRosterWithEventState } from "@/domain/rosters/sync";

export type RosterCommandRecord = {
  id: string;
  eventId: string;
  squadPresetId?: string;
  squads: Array<{
    name: string;
    group: string;
    order: number;
    color: string;
    icon?: string;
    players: Array<{
      id?: string;
      customName?: string;
      ack: boolean;
      confirmed?: boolean;
      note?: string;
      roleName?: string;
      roleIcon?: string;
    }>;
  }>;
  reservePlayerIds: string[];
  reserveAttendances?: Array<{
    userId: string;
    ack: boolean;
    confirmed?: boolean;
  }>;
  notAttendingPlayerIds: string[];
  streamerId?: string;
  published: boolean;
};

type EventRosterRecord = {
  guildId: string;
  registrationEnd: string;
  participants?: Array<{ userId: string; status: "attending" | "not_attending"; group?: string | null; updatedAt: string }>;
  signUps?: Array<{ userId: string; group?: string | null }>;
  updatedAt?: string;
  createdAt?: string;
};

type AssignmentRosterRecord = {
  userId: string;
  serverId: string;
  createdAt: string;
};

export interface RosterCommandRepository {
  getRosterById(rosterId: string): Promise<RosterCommandRecord | null>;
  getRosterByEventId(eventId: string): Promise<RosterCommandRecord | null>;
  getEvent(eventId: string): Promise<EventRosterRecord | null>;
  listAssignments(serverDiscordId: string): Promise<AssignmentRosterRecord[]>;
  createRoster(roster: Omit<RosterCommandRecord, "id">): Promise<string>;
  updateRoster(rosterId: string, roster: Omit<RosterCommandRecord, "id">): Promise<void>;
}

export type UpsertRosterInput = Omit<RosterCommandRecord, "id"> & {
  rosterId?: string;
};

function buildPersistedRosterPayload(roster: Omit<RosterCommandRecord, "id">) {
  return {
    eventId: roster.eventId,
    squadPresetId: roster.squadPresetId,
    squads: roster.squads,
    reservePlayerIds: roster.reservePlayerIds,
    reserveAttendances: roster.reserveAttendances ?? [],
    notAttendingPlayerIds: roster.notAttendingPlayerIds,
    streamerId: roster.streamerId,
    published: roster.published,
  };
}

export class UpsertRosterUseCase {
  constructor(private readonly repository: RosterCommandRepository) {}

  async execute(input: UpsertRosterInput) {
    const event = await this.repository.getEvent(input.eventId);
    const assignments = event ? await this.repository.listAssignments(event.guildId) : [];
    const existing = input.rosterId
      ? await this.repository.getRosterById(input.rosterId)
      : await this.repository.getRosterByEventId(input.eventId);

    const merged = event
      ? mergeRosterWithEventState(
          {
            ...(existing ?? {}),
            ...input,
            reserveAttendances: input.reserveAttendances ?? existing?.reserveAttendances ?? [],
          } as RosterCommandRecord,
          event,
          assignments,
        )
      : {
          ...(existing ?? {}),
          ...input,
          reserveAttendances: input.reserveAttendances ?? existing?.reserveAttendances ?? [],
        };

    const payload = buildPersistedRosterPayload(merged);

    if (existing) {
      await this.repository.updateRoster(existing.id, payload);
      return existing.id;
    }

    return await this.repository.createRoster(payload);
  }
}

export class UpdateRosterAttendanceUseCase {
  constructor(private readonly repository: Pick<RosterCommandRepository, "getRosterByEventId" | "updateRoster">) {}

  async acknowledge(eventId: string, userId: string) {
    return await this.update(eventId, userId, (roster, nextUserId) => acknowledgeRosterAttendance(roster, nextUserId));
  }

  async setStatus(eventId: string, userId: string, status: AttendanceStatus) {
    return await this.update(eventId, userId, (roster, nextUserId) => setRosterAttendanceStatus(roster, nextUserId, status));
  }

  private async update(
    eventId: string,
    userId: string,
    mutate: (roster: RosterCommandRecord, nextUserId: string) => RosterCommandRecord,
  ) {
    const roster = await this.repository.getRosterByEventId(eventId);
    if (!roster) {
      throw new Error("Roster not found.");
    }

    const next = mutate(roster, userId);
    await this.repository.updateRoster(roster.id, buildPersistedRosterPayload(next));
    return { ok: true as const };
  }
}
