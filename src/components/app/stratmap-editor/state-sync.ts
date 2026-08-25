export type RemoteStateDecision = "acknowledge" | "own-echo" | "apply-remote" | "preserve-local";

export function decideRemoteState(input: {
  remoteJson: string;
  currentJson: string;
  acknowledgedJson: string;
  submittedJsons: ReadonlySet<string>;
}): RemoteStateDecision {
  if (input.remoteJson === input.currentJson) return "acknowledge";
  if (input.submittedJsons.has(input.remoteJson)) return "own-echo";
  if (input.currentJson === input.acknowledgedJson) return "apply-remote";
  return "preserve-local";
}
