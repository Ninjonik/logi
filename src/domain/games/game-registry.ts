import type { GameDefinition } from "./game-definition";

export type GameRegistry = {
  get(gameId: string): GameDefinition | undefined;
  require(gameId: string): GameDefinition;
  list(): GameDefinition[];
};

export function createGameRegistry(definitions: GameDefinition[]): GameRegistry {
  const byId = new Map<string, GameDefinition>();

  for (const definition of definitions) {
    if (byId.has(definition.id)) {
      throw new Error(`Duplicate game ID: ${definition.id}`);
    }

    byId.set(definition.id, definition);
  }

  return {
    get(gameId) {
      return byId.get(gameId);
    },
    require(gameId) {
      const definition = byId.get(gameId);
      if (!definition) {
        throw new Error(`Unsupported game: ${gameId}`);
      }

      return definition;
    },
    list() {
      return [...byId.values()];
    },
  };
}
