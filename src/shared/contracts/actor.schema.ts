import { z } from "zod";

export const roleSchema = z.enum(["editor", "moderator", "admin"]);
export const actorSchema = z
  .object({
    id: z.uuid(),
    roles: z
      .array(roleSchema)
      .max(3)
      .refine((roles) => new Set(roles).size === roles.length)
      .readonly(),
    aal: z.enum(["aal1", "aal2"]),
  })
  .readonly();

export type Role = z.infer<typeof roleSchema>;
export type Actor = z.infer<typeof actorSchema>;
