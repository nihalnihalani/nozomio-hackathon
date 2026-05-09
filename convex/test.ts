import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

export const pingHyperspell = internalAction({
  args: {},
  handler: async (ctx) => {
    const result = await ctx.runAction(internal.tools.recallSimilarIncidents, {
      query: "stripe webhook idempotency",
      maxResults: 5,
    });
    console.log("Hyperspell ping result:", JSON.stringify(result, null, 2));
    return result;
  },
});
