export function logRouteError(scope: string, error: unknown) {
  console.error(`[${scope}]`, error);
}

export function getUserSafeErrorMessage(
  error: unknown,
  fallback: string,
) {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message;

  if (message.includes("Primary group does not belong to this server")) {
    return "Pick a valid primary group for this clan.";
  }

  if (message.includes("One of the selected secondary groups does not belong to this server")) {
    return "One of the selected secondary groups is not valid for this clan.";
  }

  if (message.includes("already assigned to this server")) {
    return "This player is already assigned to this clan.";
  }

  if (message.includes("A group with this name already exists")) {
    return "A group with this name already exists.";
  }

  if (message.includes("Registration end should be before meeting start")) {
    return "Registration end must be before meeting start.";
  }

  if (message.includes("Meeting start should be before game start")) {
    return "Meeting start must be before game start.";
  }

  if (message.includes("Game end should be after game start")) {
    return "Game end must be after game start.";
  }

  if (message.includes("valid match link")) {
    return "Please provide a valid match link.";
  }

  if (message.includes("must point to /games/[id]")) {
    return "The link must point to /games/[id].";
  }

  if (message.includes("Every squad needs at least one named role")) {
    return "Each squad preset needs at least one named role.";
  }

  if (message.includes("Add at least one squad")) {
    return "Add at least one squad.";
  }

  return fallback;
}
