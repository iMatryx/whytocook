import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";

import { catalogPositionSchema } from "../contracts/ingredient.schema.ts";
import { CatalogError } from "../domain/catalog-error.ts";
import type { CatalogBinding, CatalogCursorCodec } from "../application/catalog.port.ts";

const payload = z
  .object({
    v: z.literal(1),
    filter: z.string().regex(/^[a-f0-9]{64}$/),
    version: z.string().regex(/^[1-9]\d{0,19}$/),
    after: catalogPositionSchema,
  })
  .strict();
function fingerprint(binding: CatalogBinding) {
  return createHash("sha256")
    .update(JSON.stringify([binding.query, binding.locale, binding.categoryId, binding.limit]))
    .digest("hex");
}
export function createCatalogCursorCodec(): CatalogCursorCodec {
  return {
    encode(value, binding) {
      return Buffer.from(
        JSON.stringify(payload.parse({ v: 1, filter: fingerprint(binding), ...value })),
      ).toString("base64url");
    },
    decode(value, binding) {
      try {
        if (value.length > 1024 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error();
        const bytes = Buffer.from(value, "base64url");
        if (bytes.toString("base64url") !== value) throw new Error();
        const decoded = payload.parse(JSON.parse(bytes.toString("utf8")) as unknown);
        if (decoded.filter !== fingerprint(binding)) throw new Error();
        return { version: decoded.version, after: decoded.after };
      } catch {
        throw new CatalogError("INVALID_CURSOR");
      }
    },
  };
}
