import { fetchMutation, fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";
import { NextRequest, NextResponse } from "next/server";

import { getClanDiscordMessages } from "@/lib/clan-language";
import { editDiscordInteractionOriginalResponse, sendDiscordBotDm } from "@/lib/discord";
import { getInternalAuthSecret } from "@/lib/env";
import { parsePlatformIdsInput } from "@/lib/platform-ids";

const getPlatformIdLinkTokenReference = makeFunctionReference<"query">("platformIdLinks:getPlatformIdLinkToken");
const consumePlatformIdLinkTokenReference = makeFunctionReference<"mutation">("platformIdLinks:consumePlatformIdLinkToken");

function formatTemplate(template: string, replacements: Record<string, string>) {
  return Object.entries(replacements).reduce(
    (message, [key, value]) => message.split(`{${key}}`).join(value),
    template,
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const tokenRecord = await fetchQuery(getPlatformIdLinkTokenReference, { token });

  if (!tokenRecord) {
    return NextResponse.json({ error: "Link not found." }, { status: 404 });
  }

  return NextResponse.json(tokenRecord);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const body = await request.json() as { platformId?: string };
  const platformIds = parsePlatformIdsInput(body.platformId);

  if (!platformIds.length) {
    return NextResponse.json({ error: "Enter a valid platform ID." }, { status: 400 });
  }

  try {
    const result = await fetchMutation(consumePlatformIdLinkTokenReference, {
      secret: getInternalAuthSecret(),
      token,
      platformId: platformIds[0],
    }) as {
      ok: true;
      guildId: string;
      userId: string;
      language: "en" | "cs";
      applyMessageUrl?: string;
      interactionToken?: string;
      interactionApplicationId?: string;
    };

    const messages = getClanDiscordMessages(result.language);
    const applicationMessageUrl = result.applyMessageUrl;

    if (applicationMessageUrl) {
      const dmContent = formatTemplate(messages.membership.platformIdReadyDm, {
        link: applicationMessageUrl,
      });

      try {
        await sendDiscordBotDm(result.userId, dmContent);
      } catch {
        if (result.interactionToken && result.interactionApplicationId) {
          try {
            await editDiscordInteractionOriginalResponse({
              applicationId: result.interactionApplicationId,
              interactionToken: result.interactionToken,
              content: formatTemplate(messages.membership.platformIdReadyInteraction, {
                link: applicationMessageUrl,
              }),
            });
          } catch {
            // Best effort only. The platform ID was still saved successfully.
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      message: "Platform ID saved. Return to Discord and click the clan application message again.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save platform ID.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
