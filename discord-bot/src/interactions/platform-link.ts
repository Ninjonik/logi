import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type APIMessageComponentEmoji,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";

import { getClanDiscordMessages, type ClanLanguage } from "../../../src/lib/clan-language";
import { detectPlatformFromId, stripPlatformPrefix } from "../../../src/lib/platform-ids";

type PlatformLinkMode = "membership" | "link";
type PlatformKey = "steam" | "epic" | "xbox" | "playstation";

type PlatformLinkContext = {
  mode: PlatformLinkMode;
  categoryId?: string;
};

type PlatformEmojiMap = Partial<Record<PlatformKey, APIMessageComponentEmoji>>;

const FLOW_PREFIX = "plink";
const MODAL_PREFIX = "plink-modal";
const APPLY_MODAL_PREFIX = "plink-apply";
const MOCK_APPLY_MODAL_PREFIX = "plink-mock-apply";
const SEARCH_MODAL_PREFIX = "plink-search";

const PLATFORM_GUIDES: Record<PlatformKey, string> = {
  steam: "https://help.steampowered.com/en/faqs/view/2816-BE67-5B69-0FEC",
  epic: "https://www.epicgames.com/help/c-202300000001645/c-Trending_0/what-is-an-epic-games-account-id-and-where-can-i-find-it-a202300000011535",
  xbox: "https://support.xbox.com/en-US/help/account-profile/profile/change-xbox-live-gamertag",
  playstation: "https://www.playstation.com/en-us/support/account/change-online-id/",
};

function getPlatformFlowMessages(language: ClanLanguage) {
  return getClanDiscordMessages(language).platformFlow ?? getClanDiscordMessages("en").platformFlow!;
}

export const MOCK_PLATFORM_PLAYERS = [
  { id: "ace-miller", label: "Ace Miller", description: "Mock player from recent server history" },
  { id: "bravo-fox", label: "Bravo Fox", description: "Mock player from recent server history" },
  { id: "charlie-nova", label: "Charlie Nova", description: "Mock player from recent server history" },
  { id: "delta-reed", label: "Delta Reed", description: "Mock player from recent server history" },
  { id: "echo-stone", label: "Echo Stone", description: "Mock player from recent server history" },
] as const;

function formatStoredPlatformId(platformId: string) {
  const platform = detectPlatformFromId(platformId);
  return {
    platform,
    rawId: stripPlatformPrefix(platformId),
  };
}

function decodeContext(mode: string, categoryId: string | undefined): PlatformLinkContext | null {
  if (mode !== "membership" && mode !== "link") {
    return null;
  }

  return {
    mode,
    categoryId: categoryId && categoryId !== "_" ? categoryId : undefined,
  };
}

export function buildPlatformLinkCustomId(step: string, context: PlatformLinkContext, extra?: string) {
  return [FLOW_PREFIX, step, context.mode, context.categoryId ?? "_", extra].filter(Boolean).join(":");
}

export function buildPlatformLinkModalId(context: PlatformLinkContext, platform: PlatformKey) {
  return `${MODAL_PREFIX}:${context.mode}:${context.categoryId ?? "_"}:${platform}`;
}

export function buildPlatformLinkApplyModalId(categoryId: string, platform: PlatformKey) {
  return `${APPLY_MODAL_PREFIX}:membership:${categoryId}:${platform}`;
}

export function buildPlatformLinkMockApplyModalId(categoryId: string, mockPlayerId: string) {
  return `${MOCK_APPLY_MODAL_PREFIX}:membership:${categoryId}:${mockPlayerId}`;
}

export function parsePlatformLinkInteractionId(customId: string) {
  const [prefix, step, mode, categoryId, ...rest] = customId.split(":");
  if (prefix !== FLOW_PREFIX || !step || !mode) {
    return null;
  }

  return {
    step,
    context: decodeContext(mode, categoryId),
    extra: rest.length ? rest.join(":") : undefined,
  };
}

export function parsePlatformLinkModalId(customId: string) {
  const [prefix, mode, categoryId, platform] = customId.split(":");
  if (prefix !== MODAL_PREFIX || !mode || !platform) {
    return null;
  }

  if (platform !== "steam" && platform !== "epic" && platform !== "xbox" && platform !== "playstation") {
    return null;
  }

  return {
    context: decodeContext(mode, categoryId),
    platform,
  } satisfies { context: PlatformLinkContext | null; platform: PlatformKey };
}

export function buildPlatformLinkSearchModalId(context: PlatformLinkContext) {
  return `${SEARCH_MODAL_PREFIX}:${context.mode}:${context.categoryId ?? "_"}`;
}

export function parsePlatformLinkSearchModalId(customId: string) {
  const [prefix, mode, categoryId] = customId.split(":");
  if (prefix !== SEARCH_MODAL_PREFIX || !mode) {
    return null;
  }

  return decodeContext(mode, categoryId);
}

export function parsePlatformLinkApplyModalId(customId: string) {
  const [prefix, mode, categoryId, platform] = customId.split(":");
  if (prefix !== APPLY_MODAL_PREFIX || mode !== "membership" || !categoryId || !platform) {
    return null;
  }

  if (platform !== "steam" && platform !== "epic" && platform !== "xbox" && platform !== "playstation") {
    return null;
  }

  return { categoryId, platform } satisfies { categoryId: string; platform: PlatformKey };
}

export function parsePlatformLinkMockApplyModalId(customId: string) {
  const [prefix, mode, categoryId, mockPlayerId] = customId.split(":");
  if (prefix !== MOCK_APPLY_MODAL_PREFIX || mode !== "membership" || !categoryId || !mockPlayerId) {
    return null;
  }

  return { categoryId, mockPlayerId };
}

export function buildPlatformLinkStartMessage(language: ClanLanguage, context: PlatformLinkContext) {
  const messages = getPlatformFlowMessages(language);
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(messages.title)
    .setDescription(context.mode === "membership" ? messages.membershipIntro : messages.linkIntro);

  const components = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(buildPlatformLinkCustomId("start", context))
        .setLabel(messages.startButton)
        .setStyle(ButtonStyle.Primary),
    ),
  ];

  return { embeds: [embed], components };
}

export function buildPlatformLinkManageMessage(input: {
  language: ClanLanguage;
  platformIds: string[];
  emojis?: PlatformEmojiMap;
}) {
  const messages = getPlatformFlowMessages(input.language);
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(messages.title)
    .setDescription(
      input.platformIds.length
        ? "Manage your linked platform IDs below."
        : messages.linkIntro,
    );

  if (input.platformIds.length) {
    embed.addFields({
      name: "Linked platform IDs",
      value: input.platformIds.map((platformId, index) => {
        const formatted = formatStoredPlatformId(platformId);
        const label = formatted.platform === "other" ? "platform" : formatted.platform;
        return `${index + 1}. \`${formatted.rawId}\` (${label})`;
      }).join("\n"),
    });
  }

  const addButton = new ButtonBuilder()
    .setCustomId(buildPlatformLinkCustomId("start", { mode: "link" }))
    .setLabel(input.platformIds.length ? "Add another platform ID" : messages.startButton)
    .setStyle(ButtonStyle.Primary);

  const removeButton = new ButtonBuilder()
    .setCustomId(buildPlatformLinkCustomId("unlink", { mode: "link" }))
    .setLabel("Unlink a platform ID")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(!input.platformIds.length);

  return {
    embeds: [embed],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(addButton, removeButton)],
  };
}

export function buildPlayedBeforeMessage(language: ClanLanguage, context: PlatformLinkContext) {
  const messages = getPlatformFlowMessages(language);
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(messages.title)
    .setDescription(messages.playedBeforePrompt);

  const menu = new StringSelectMenuBuilder()
    .setCustomId(buildPlatformLinkCustomId("played", context))
    .setPlaceholder(messages.playedBeforePlaceholder)
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(messages.playedBeforeYes)
        .setDescription(messages.playedBeforeYesDescription)
        .setValue("yes"),
      new StringSelectMenuOptionBuilder()
        .setLabel(messages.playedBeforeNo)
        .setDescription(messages.playedBeforeNoDescription)
        .setValue("no"),
    );

  return {
    embeds: [embed],
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)],
  };
}

export function buildMockPlayerMessage(language: ClanLanguage, context: PlatformLinkContext) {
  const messages = getPlatformFlowMessages(language);
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(messages.title)
    .setDescription(messages.playerSearchIntro);

  const button = new ButtonBuilder()
    .setCustomId(buildPlatformLinkCustomId("player-search", context))
    .setLabel("Search player")
    .setStyle(ButtonStyle.Primary);

  return {
    embeds: [embed],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(button)],
  };
}

export function buildPlayerSearchResultsMessage(input: {
  language: ClanLanguage;
  context: PlatformLinkContext;
  results: Array<{ playerId: string; playerName: string; description: string; emoji?: APIMessageComponentEmoji }>;
}) {
  const messages = getPlatformFlowMessages(input.language);
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(messages.title)
    .setDescription(input.results.length ? "Select your player from the results below." : "No matching players were found. Try a different name or code.");

  if (!input.results.length) {
    return {
      embeds: [embed],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(buildPlatformLinkCustomId("player-search", input.context))
            .setLabel("Search again")
            .setStyle(ButtonStyle.Primary),
        ),
      ],
    };
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId(buildPlatformLinkCustomId("player", input.context))
    .setPlaceholder(messages.playerSearchPlaceholder)
    .addOptions(
      input.results.slice(0, 25).map((player) => {
        const option = new StringSelectMenuOptionBuilder()
          .setLabel(player.playerName.slice(0, 100))
          .setDescription(player.description.slice(0, 100))
          .setValue(player.playerId.slice(0, 100));
        if (player.emoji) {
          option.setEmoji(player.emoji);
        }
        return option;
      }),
    );

  return {
    embeds: [embed],
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)],
  };
}

export function buildPlatformSelectMessageWithEmojis(input: {
  language: ClanLanguage;
  context: PlatformLinkContext;
  emojis?: PlatformEmojiMap;
}) {
  const { language, context, emojis } = input;
  const messages = getPlatformFlowMessages(language);
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(messages.title)
    .setDescription(messages.platformIntro);

  const steam = new StringSelectMenuOptionBuilder().setLabel(messages.platformSteam).setValue("steam");
  const epic = new StringSelectMenuOptionBuilder().setLabel(messages.platformEpic).setValue("epic");
  const xbox = new StringSelectMenuOptionBuilder().setLabel(messages.platformXbox).setValue("xbox");
  const playstation = new StringSelectMenuOptionBuilder().setLabel(messages.platformPlaystation).setValue("playstation");
  if (emojis?.steam) {
    steam.setEmoji(emojis.steam);
  }
  if (emojis?.epic) {
    epic.setEmoji(emojis.epic);
  }
  if (emojis?.xbox) {
    xbox.setEmoji(emojis.xbox);
  }
  if (emojis?.playstation) {
    playstation.setEmoji(emojis.playstation);
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId(buildPlatformLinkCustomId("platform", context))
    .setPlaceholder(messages.platformPlaceholder)
    .addOptions(steam, epic, xbox, playstation);

  return {
    embeds: [embed],
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)],
  };
}

export function buildUnlinkPlatformMessage(input: {
  language: ClanLanguage;
  platformIds: string[];
  emojis?: PlatformEmojiMap;
}) {
  const messages = getPlatformFlowMessages(input.language);
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(messages.title)
    .setDescription("Select the platform ID you want to unlink.");

  const menu = new StringSelectMenuBuilder()
    .setCustomId(buildPlatformLinkCustomId("unlink-select", { mode: "link" }))
    .setPlaceholder("Select a platform ID to unlink")
    .addOptions(
      input.platformIds.slice(0, 25).map((platformId) => {
        const formatted = formatStoredPlatformId(platformId);
        const option = new StringSelectMenuOptionBuilder()
          .setLabel(stripPlatformPrefix(platformId).slice(0, 100))
          .setDescription((formatted.platform === "other" ? "platform" : formatted.platform).slice(0, 100))
          .setValue(platformId);

        const emoji = formatted.platform === "other" ? undefined : input.emojis?.[formatted.platform];
        if (emoji) {
          option.setEmoji(emoji);
        }
        return option;
      }),
    );

  return {
    embeds: [embed],
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)],
  };
}

function getPlatformGuideCopy(language: ClanLanguage, platform: PlatformKey) {
  const messages = getPlatformFlowMessages(language);
  switch (platform) {
    case "steam":
      return messages.guides.steam;
    case "epic":
      return messages.guides.epic;
    case "xbox":
      return messages.guides.xbox;
    case "playstation":
      return messages.guides.playstation;
  }
}

export function buildPlatformGuideMessage(language: ClanLanguage, context: PlatformLinkContext, platform: PlatformKey, emojis?: PlatformEmojiMap) {
  const messages = getPlatformFlowMessages(language);
  const copy = getPlatformGuideCopy(language, platform);
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(messages.title)
    .setDescription([
      `${copy.label}`,
      copy.help,
      "",
      `1. ${copy.stepOne}`,
      `2. ${copy.stepTwo}`,
      `3. ${copy.stepThree}`,
      "",
      `${messages.guideLinkLabel}: ${PLATFORM_GUIDES[platform]}`,
    ].join("\n"));

  const button = new ButtonBuilder()
    .setCustomId(buildPlatformLinkCustomId("manual", context, platform))
    .setLabel(context.mode === "membership" ? messages.continueWithIdButton : messages.submitIdButton)
    .setStyle(ButtonStyle.Primary);

  const emoji = emojis?.[platform];
  if (emoji) {
    button.setEmoji(emoji);
  }

  return {
    embeds: [embed],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(button)],
  };
}
