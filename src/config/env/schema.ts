import { z } from "zod";

type EnvSource = Readonly<Record<string, unknown>>;

function isOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    return !url.username && !url.password && !url.search && !url.hash && url.pathname === "/" && (url.protocol === "https:" || (url.protocol === "http:" && loopback));
  } catch {
    return false;
  }
}

function validate<T extends z.ZodType>(schema: T, source: unknown): z.output<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const fields = [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
    throw new Error(`Invalid environment configuration: ${fields.join(", ")}`);
  }
  return result.data;
}

const optionalString = (schema: z.ZodString) => z.preprocess((value) => value === "" ? undefined : value, schema.optional());
const originSchema = z.string().min(1).refine(isOrigin);
const publicKeySchema = z.string().startsWith("sb_publishable_").min(16);
const bucketSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*$/);

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  COOKLY_ENV: z.enum(["development", "test", "preview", "production"]).default("development"),
  APP_BASE_URL: originSchema.optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  SUPABASE_MEDIA_BUCKET: bucketSchema.default("recipe-media"),
  SUPABASE_EXPORTS_BUCKET: bucketSchema.default("account-exports"),
}).superRefine((value, context) => {
  if (value.NODE_ENV === "production" && value.COOKLY_ENV !== "production" && value.COOKLY_ENV !== "preview") {
    context.addIssue({ code: "custom", path: ["COOKLY_ENV"], message: "Production execution requires production or preview configuration." });
  }
  if ((value.COOKLY_ENV === "production" || value.COOKLY_ENV === "preview") && !value.APP_BASE_URL?.startsWith("https://")) {
    context.addIssue({ code: "custom", path: ["APP_BASE_URL"], message: "An explicit HTTPS origin is required." });
  }
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: optionalString(originSchema),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalString(publicKeySchema),
}).superRefine((value, context) => {
  if (Boolean(value.NEXT_PUBLIC_SUPABASE_URL) !== Boolean(value.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)) {
    context.addIssue({ code: "custom", path: [value.NEXT_PUBLIC_SUPABASE_URL ? "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" : "NEXT_PUBLIC_SUPABASE_URL"], message: "Both public Supabase values are required together." });
  }
});

const supabaseSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: originSchema,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicKeySchema,
});

const signingSecret = z.string().refine((value) => new TextEncoder().encode(value).byteLength >= 32);
const mutationSchema = z.object({ CSRF_SECRET: signingSecret });
const maintenanceSchema = mutationSchema.extend({
  SUPABASE_SECRET_KEY: z.string().startsWith("sb_secret_").min(16),
  JOBS_SIGNING_SECRET: signingSecret,
}).superRefine((value, context) => {
  if (value.CSRF_SECRET === value.JOBS_SIGNING_SECRET) {
    context.addIssue({ code: "custom", path: ["JOBS_SIGNING_SECRET"], message: "Signing secrets must be distinct." });
  }
});

export function parseServerEnv(source: EnvSource) {
  const config = validate(serverSchema, { ...source, COOKLY_ENV: source.COOKLY_ENV ?? (source.NODE_ENV === "production" ? "production" : "development") });
  return { ...config, APP_BASE_URL: config.APP_BASE_URL ?? "http://localhost:3000" };
}

export function parseClientEnv(source: EnvSource): { NEXT_PUBLIC_SUPABASE_URL?: string; NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string } {
  const config = validate(clientSchema, source);
  if (config.NEXT_PUBLIC_SUPABASE_URL && config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return { NEXT_PUBLIC_SUPABASE_URL: config.NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY };
  }
  return {};
}

export function parseSupabaseEnv(source: EnvSource) {
  return validate(supabaseSchema, source);
}

export function parseMaintenanceEnv(source: EnvSource) {
  return validate(maintenanceSchema, source);
}

export function parseMutationEnv(source: EnvSource) {
  return validate(mutationSchema, source);
}
