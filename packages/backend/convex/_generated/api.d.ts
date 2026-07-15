/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as chat from "../chat.js";
import type * as healthCheck from "../healthCheck.js";
import type * as http from "../http.js";
import type * as lib_extraction from "../lib/extraction.js";
import type * as lib_plans from "../lib/plans.js";
import type * as lib_profile from "../lib/profile.js";
import type * as lib_profileExport from "../lib/profileExport.js";
import type * as lib_profileSummary from "../lib/profileSummary.js";
import type * as lib_prompts from "../lib/prompts.js";
import type * as lib_studyData from "../lib/studyData.js";
import type * as lib_tensions from "../lib/tensions.js";
import type * as lib_usageMath from "../lib/usageMath.js";
import type * as polar from "../polar.js";
import type * as privateData from "../privateData.js";
import type * as profile from "../profile.js";
import type * as tensions from "../tensions.js";
import type * as usage from "../usage.js";
import type * as userPreferences from "../userPreferences.js";
import type * as waitlist from "../waitlist.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  chat: typeof chat;
  healthCheck: typeof healthCheck;
  http: typeof http;
  "lib/extraction": typeof lib_extraction;
  "lib/plans": typeof lib_plans;
  "lib/profile": typeof lib_profile;
  "lib/profileExport": typeof lib_profileExport;
  "lib/profileSummary": typeof lib_profileSummary;
  "lib/prompts": typeof lib_prompts;
  "lib/studyData": typeof lib_studyData;
  "lib/tensions": typeof lib_tensions;
  "lib/usageMath": typeof lib_usageMath;
  polar: typeof polar;
  privateData: typeof privateData;
  profile: typeof profile;
  tensions: typeof tensions;
  usage: typeof usage;
  userPreferences: typeof userPreferences;
  waitlist: typeof waitlist;
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

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
  polar: import("@convex-dev/polar/_generated/component.js").ComponentApi<"polar">;
  agent: import("@convex-dev/agent/_generated/component.js").ComponentApi<"agent">;
};
