export type GuildRuntimeDataLike<TConfig, TGroup, TSquadPreset, TTopicPreset, TGuild> = {
  guild: TGuild;
  config?: TConfig;
  groups: TGroup[];
  squadPresets: TSquadPreset[];
  topicPresets: TTopicPreset[];
};

export type EventSyncContextLike<TEvent, TRoster, TSyncState> = {
  event: TEvent;
  roster: TRoster | null;
  syncState: TSyncState | null;
};

export function buildGuildPayload<TConfig, TGroup, TEvent, TRoster, TTopicPreset, TSyncState, TSquadPreset, TGuild>(
  runtime: GuildRuntimeDataLike<TConfig, TGroup, TSquadPreset, TTopicPreset, TGuild> & { config: TConfig },
  contexts: Array<EventSyncContextLike<TEvent, TRoster, TSyncState> | null>,
) {
  const filteredContexts = contexts.filter((context): context is EventSyncContextLike<TEvent, TRoster, TSyncState> => Boolean(context));

  return {
    config: runtime.config,
    groups: runtime.groups,
    topicPresets: runtime.topicPresets,
    events: filteredContexts.map((context) => context.event),
    rosters: filteredContexts.flatMap((context) => (context.roster ? [context.roster] : [])),
    syncStates: filteredContexts.flatMap((context) => (context.syncState ? [context.syncState] : [])),
  };
}

export function buildEventSignatureMap<
  TEvent extends { id: string; updatedAt: string },
  TRoster extends { eventId: string; updatedAt: string },
>(index: {
  events: TEvent[];
  rosters: TRoster[];
}) {
  const rosterIndexByEventId = new Map(index.rosters.map((roster) => [roster.eventId, roster]));
  const signatures = new Map<string, string>();

  for (const event of index.events) {
    const roster = rosterIndexByEventId.get(event.id);
    signatures.set(event.id, `${event.updatedAt}|${roster?.updatedAt ?? "no-roster"}`);
  }

  return {
    rosterIndexByEventId,
    signatures,
  };
}

export function getChangedEventIds(
  nextSignaturesByEventId: Map<string, string>,
  previousSignaturesByEventId: Map<string, string>,
  initialLoad: boolean,
) {
  const changedEventIds: string[] = [];

  for (const [eventId, signature] of nextSignaturesByEventId) {
    if (initialLoad || previousSignaturesByEventId.get(eventId) !== signature) {
      changedEventIds.push(eventId);
    }
  }

  return changedEventIds;
}
