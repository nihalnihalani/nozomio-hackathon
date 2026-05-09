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

export const pingNiaSearchCode = internalAction({
  args: {},
  handler: async (ctx) => {
    const result = await ctx.runAction(internal.tools.searchCode, {
      query: "FastAPI Depends dependency injection source code",
    });
    console.log("Nia ping result:", JSON.stringify(result, null, 2));
    return result;
  },
});
