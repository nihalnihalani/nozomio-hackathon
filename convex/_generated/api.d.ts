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
import type * as reinforce_node from "../reinforce_node.js";
import type * as tools from "../tools.js";
import type * as tools_node from "../tools_node.js";
import type * as traceState from "../traceState.js";
import type * as triage from "../triage.js";
import type * as triage_node from "../triage_node.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  reinforce: typeof reinforce;
  reinforce_node: typeof reinforce_node;
  tools: typeof tools;
  tools_node: typeof tools_node;
  traceState: typeof traceState;
  triage: typeof triage;
  triage_node: typeof triage_node;
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

export declare const components: {};
