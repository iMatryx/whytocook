import { z } from "zod";

import { RECIPE_ROUTE_ID_MAX_LENGTH, RECIPE_ROUTE_ID_PATTERN } from "./route-id.ts";

export const RecipeRouteIdSchema = z
  .string()
  .min(1)
  .max(RECIPE_ROUTE_ID_MAX_LENGTH)
  .regex(RECIPE_ROUTE_ID_PATTERN);
