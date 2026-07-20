import { env } from "./environment";

type CacheRevalidationPayload =
  | {
      type: "assignment-changed";
      serverId: string;
      userId: string;
      assignmentId?: string;
    }
  | {
      type: "roster-changed";
      serverId: string;
      rosterId: string;
      eventId?: string;
    }
  | {
      type: "event-changed";
      serverId: string;
      eventId: string;
    }
  | {
      type: "discord-config-changed";
      serverId: string;
    }
  | {
      type: "server-context-changed";
      serverId: string;
    };

export async function revalidateAppData(payload: CacheRevalidationPayload) {
  await fetch(new URL("/api/cache/revalidate", env.appSiteUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      secret: env.internalSecret,
      payload,
    }),
  }).catch(() => null);
}
