import { query } from "./_generated/server";

export const overview = query({
  args: {},
  handler: async (ctx) => {
    const [users, guilds, events] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("guilds").collect(),
      ctx.db.query("events").collect(),
    ]);

    return {
      players: users.length,
      teams: guilds.length,
      matches: events.filter((event) => (event.kind ?? "match") === "match").length,
      operations: events.length,
    };
  },
});
