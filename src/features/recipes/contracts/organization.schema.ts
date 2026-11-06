import { z } from "zod";
export const organizedRecipeKeySchema = z
  .string()
  .max(220)
  .regex(/^(demo|published):[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const collectionNameSchema = z
  .string()
  .transform((s) => s.normalize("NFC").trim().replace(/\s+/g, " "))
  .pipe(z.string().min(1).max(80));
export const recipeCollectionSchema = z
  .object({
    id: z.uuid(),
    name: collectionNameSchema,
    recipeKeys: z.array(organizedRecipeKeySchema).max(500),
  })
  .strict();
export const organizationCommandSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("saveCollection"),
      id: z.uuid(),
      name: collectionNameSchema,
      create: z.boolean().default(false),
    })
    .strict(),
  z.object({ kind: z.literal("deleteCollection"), id: z.uuid() }).strict(),
  z
    .object({
      kind: z.literal("membership"),
      id: z.uuid(),
      recipeKey: organizedRecipeKeySchema,
      enabled: z.boolean(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("favorite"),
      recipeKey: organizedRecipeKeySchema,
      enabled: z.boolean(),
    })
    .strict(),
  z.object({ kind: z.literal("clearHistory") }).strict(),
]);
export const organizationSnapshotSchema = z
  .object({
    accountId: z.uuid().nullable(),
    favorites: z.array(organizedRecipeKeySchema),
    collections: z.array(recipeCollectionSchema).max(50),
    cooked: z.array(
      z
        .object({
          recipeKey: organizedRecipeKeySchema,
          at: z.iso.datetime({ offset: true }),
          servings: z.number().int().min(1).max(20),
        })
        .strict(),
    ),
    titles: z.record(organizedRecipeKeySchema, z.string().max(500).nullable()),
  })
  .strict();
export const organizationRequestSchema = z
  .object({ expectedAccountId: z.uuid(), command: organizationCommandSchema })
  .strict();
export type OrganizationCommand = z.infer<typeof organizationCommandSchema>;
export type OrganizationSnapshot = z.infer<typeof organizationSnapshotSchema>;
