import { createGameRegistry } from "./game-registry";
import { hellLetLooseGame } from "./hell-let-loose/definition";

export const gameRegistry = createGameRegistry([
  hellLetLooseGame,
]);
