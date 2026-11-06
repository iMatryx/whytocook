import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import original from "../../../docs/data/ingredients-v1.json";
import references from "../../../data/recipes/references.v1.json";
import { getSupabaseEnv } from "../../config/env/server.ts";
import { pantryIngredientSchema } from "../../features/pantry/contracts/index.ts";
import {
  shoppingBootstrapSchema,
  shoppingSnapshotSchema,
  shoppingMutationSchema,
  shoppingPreviewRequestSchema,
  shoppingPreviewSchema,
} from "../../features/shopping/contracts/index.ts";
import { aggregateShopping } from "../../features/shopping/application/shopping-model.ts";
import { recipeFiltersSchema } from "../../features/recipes/contracts/index.ts";
import { RecipeSearchError } from "../../features/recipes/domain/search-error.ts";
import { AccessError } from "../http/access-error.server.ts";
import { requestContext } from "../auth/session.server.ts";
import { sessionFromCookieHeader } from "../auth/session-config.server.ts";
import { createRecipeRpc } from "../supabase/recipe-rpc.server.ts";
import { recipeRequestContext } from "./recipe-context.server.ts";
import { loadRecipeSearchSnapshot, recipeSearchService } from "./recipes.server.ts";
async function session(request: Request) {
  const credentials =
    !!request.headers.get("authorization") ||
    /(?:^|;\s*)(?:__Host-)?cookly-session=/.test(request.headers.get("cookie") ?? "");
  if (!credentials) return { accountId: null, token: null };
  const context = await requestContext(request),
    token =
      request.headers.get("authorization")?.slice(7) ??
      sessionFromCookieHeader(request.headers.get("cookie"))?.accessToken;
  if (!token) throw new AccessError("AUTH_REQUIRED");
  return { accountId: context.actor.id, token };
}
function demoCatalog() {
  return [...original, ...references.ingredients].map((i) => {
    const h = createHash("sha256").update(`cookly-guest-ingredient:${i.slug}`).digest("hex");
    return pantryIngredientSchema.parse({
      id: `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`,
      slug: i.slug,
      name: i.name,
      active: true,
      allowedUnits: i.units,
      categoryId: null,
      categoryName:
        references.categories.find((c) => c.slug === i.category)?.name ??
        i.category.replaceAll("-", " "),
    });
  });
}
async function catalogFor(source: "demo" | "published", token: string | null) {
  return source === "demo" && !token
    ? demoCatalog()
    : z
        .array(pantryIngredientSchema)
        .max(1000)
        .parse(await createRecipeRpc(getSupabaseEnv()).request("smart_shopping_catalog"));
}
export async function shoppingBootstrap(request: Request, source: "demo" | "published") {
  const own = await session(request),
    snapshot = await loadRecipeSearchSnapshot(source),
    catalog = await catalogFor(source, own.token);
  const state = own.token
    ? shoppingSnapshotSchema.parse(
        await createRecipeRpc(getSupabaseEnv(), own.token).request("smart_shopping_snapshot"),
      )
    : { accountId: null, items: [] };
  if (state.accountId !== own.accountId) throw new RecipeSearchError("SESSION_CHANGED");
  return shoppingBootstrapSchema.parse({
    ...state,
    catalog,
    source,
    recipes: snapshot.recipes.map((r) => ({ slug: r.key, title: r.title, servings: r.servings })),
  });
}
export async function shoppingPreview(request: Request, value: unknown) {
  const input = shoppingPreviewRequestSchema.parse(value),
    context = await recipeRequestContext(request, input.inventory, input.expectedAccountId),
    snapshot = await loadRecipeSearchSnapshot(input.source),
    catalog = await catalogFor(input.source, context.token);
  const targets = snapshot.recipes.filter((r) => input.selections.some((s) => s.slug === r.key));
  if (targets.length !== input.selections.length) throw new RecipeSearchError("NOT_FOUND");
  const allowed = await recipeSearchService(
    { ...snapshot, recipes: targets },
    context.inventory,
    input.today,
  ).search(
    recipeFiltersSchema.parse({
      source: input.source,
      size: 24,
      allergy: context.allergies,
      exclude: context.excludedIngredients,
    }),
  );
  if (allowed.total !== targets.length) throw new RecipeSearchError("INVALID_REQUEST");
  try {
    return shoppingPreviewSchema.parse(
      aggregateShopping(
        targets,
        input.selections,
        catalog,
        context.inventory,
        input.today,
        input.includeOptional,
      ),
    );
  } catch {
    throw new RecipeSearchError("INVALID_REQUEST");
  }
}
export async function shoppingMutation(request: Request, value: unknown) {
  const input = shoppingMutationSchema.parse(value),
    own = await session(request);
  if (!own.token) throw new AccessError("AUTH_REQUIRED");
  if (own.accountId !== input.expectedAccountId) throw new RecipeSearchError("SESSION_CHANGED");
  const state = shoppingSnapshotSchema.parse(
    await createRecipeRpc(getSupabaseEnv(), own.token).request("smart_shopping_mutate", {
      p_operation_id: input.operationId,
      p_command: input.command,
    }),
  );
  if (state.accountId !== own.accountId) throw new RecipeSearchError("SESSION_CHANGED");
  return state;
}
export { session as shoppingSession, catalogFor as shoppingCatalogFor };
