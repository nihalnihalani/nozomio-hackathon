/* eslint-disable */
/**
 * Hand-written FALLBACK stub for `convex/_generated/api`.
 *
 * `npx convex dev` (or `npx convex codegen`) regenerates this file with
 * real per-function typed `FunctionReference`s. That overwrite is fine —
 * the regenerated version is strictly more precise.
 *
 * This stub exists so a fresh clone with NO Convex auth still typechecks
 * and builds. `lib/hooks/useTriage.ts` imports `api.triage.start` and
 * `api.triage.byId` from this module, and codegen needs `CONVEX_DEPLOYMENT`
 * to run — without this stub a clean clone would fail `npm run typecheck`.
 *
 * The real codegen overwrites this file but its outputs are otherwise
 * gitignored (see .gitignore). This file is the only `convex/_generated/`
 * file checked into git; pair it with `api.js`.
 *
 * @module
 */

import type { AnyApi, AnyComponents } from "convex/server";

export declare const api: AnyApi;
export declare const internal: AnyApi;
export declare const components: AnyComponents;
