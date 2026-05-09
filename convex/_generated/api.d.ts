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
import type * as triage from "../triage.js";
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
  triage: typeof triage;
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

export declare const components: {};
