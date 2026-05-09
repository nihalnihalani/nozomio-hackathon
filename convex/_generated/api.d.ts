/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as reinforce from "../reinforce.js";
import type * as reinforceNode from "../reinforceNode.js";
import type * as test from "../test.js";
import type * as tools from "../tools.js";
import type * as toolsNode from "../toolsNode.js";
import type * as traceState from "../traceState.js";
import type * as triage from "../triage.js";
import type * as triageAgent from "../triageAgent.js";
import type * as triageNode from "../triageNode.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  reinforce: typeof reinforce;
  reinforceNode: typeof reinforceNode;
  test: typeof test;
  tools: typeof tools;
  toolsNode: typeof toolsNode;
  traceState: typeof traceState;
  triage: typeof triage;
  triageAgent: typeof triageAgent;
  triageNode: typeof triageNode;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

/**
 * Components registry. Until `npx convex dev` regenerates this file
 * locally, we type `components` loosely so `components.agent` (registered
 * in `convex/convex.config.ts`) typechecks. Live codegen will overwrite
 * this with a precise type.
 */
import type { AnyApi } from "convex/server";
export declare const components: AnyApi;
