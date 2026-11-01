import path from "node:path";

const dependencies = {
  auth: [],
  ingredients: [],
  recipes: ["ingredients"],
  pantry: ["ingredients"],
  "meal-planner": ["recipes", "ingredients"],
  nutrition: ["ingredients", "recipes"],
  shopping: ["auth", "ingredients", "recipes", "pantry", "meal-planner", "nutrition"],
  matching: ["auth", "ingredients", "recipes", "pantry", "meal-planner", "nutrition"],
  ai: ["auth", "ingredients", "recipes", "pantry", "meal-planner", "nutrition", "matching"],
  community: ["auth", "recipes"],
  billing: ["auth"],
  admin: ["auth", "ingredients", "recipes", "pantry", "meal-planner", "nutrition", "shopping", "matching", "ai", "community", "billing"],
};

function sourcePath(filename, root) {
  return path.relative(root, filename).split(path.sep).join("/");
}

export function checkImportBoundary(filename, imported, root, clientDirective = false) {
  const from = sourcePath(filename, root);
  if (!from.startsWith("src/")) return null;

  const target = imported.startsWith("@/")
    ? sourcePath(path.resolve(root, "src", imported.slice(2)), root)
    : imported.startsWith(".")
      ? sourcePath(path.resolve(path.dirname(filename), imported), root)
      : null;
  const originFeature = /^src\/features\/([^/]+)\/(.+)$/.exec(from);
  const targetFeature = target && /^src\/features\/([^/]+)\/(.+)$/.exec(target);
  const isClient = clientDirective || from.startsWith("src/components/") || from.startsWith("src/shared/presentation/") || from.includes("/presentation/");

  const externalFramework = /^(react(?:\/|$)|next(?:\/|$)|@supabase\/|server-only$)/.test(imported);
  if (from.startsWith("src/shared/domain/") && ((target && !target.startsWith("src/shared/domain/")) || (!target && (externalFramework || imported === "zod")))) {
    return "Shared domain must remain independent of application infrastructure.";
  }
  if (from.startsWith("src/shared/contracts/") && ((target && !target.startsWith("src/shared/contracts/")) || (!target && imported !== "zod"))) {
    return "Shared contracts only depend on browser-safe contract primitives and Zod.";
  }
  if (from.startsWith("src/shared/application/") && ((target && !/^src\/shared\/(domain|contracts|application)\//.test(target)) || (!target && externalFramework))) {
    return "Shared application ports cannot depend on adapters or feature implementations.";
  }
  if (from.startsWith("src/workflows/application/") && ((target && !(target.startsWith("src/shared/") || target.startsWith("src/workflows/application/") || target.startsWith("src/workflows/contracts/") || (targetFeature && /^contracts(\/index)?(\.ts)?$/.test(targetFeature[2])))) || (!target && externalFramework))) {
    return "Workflow services depend on contracts and ports, not concrete adapters.";
  }

  if (isClient && target && (target.startsWith("src/server/") || /^src\/config\/env\/(server|maintenance)(\.|$)/.test(target) || (targetFeature && /^(infrastructure|application|domain|server)(\/|\.|$)/.test(targetFeature[2])))) {
    return "Client presentation cannot import server or domain implementation.";
  }
  if (isClient && /^(server-only|@supabase\/)/.test(imported)) {
    return "Client presentation cannot access database SDKs or server-only modules.";
  }
  if (from.startsWith("src/components/ui/") && targetFeature) {
    return "Shared UI primitives cannot depend on features.";
  }
  if (from.startsWith("src/app/") && targetFeature && !/^(contracts(\/index)?(\.ts)?$|presentation\/)/.test(targetFeature[2])) {
    return "Routes use composition and public contracts, not feature internals.";
  }
  if (from.startsWith("src/app/") && target?.startsWith("src/server/supabase/")) {
    return "Route adapters cannot access the database client directly.";
  }
  if (originFeature) {
    const [, feature, internal] = originFeature;
    if (internal.startsWith("infrastructure/") && target?.startsWith(`src/features/${feature}/presentation/`)) {
      return "Infrastructure cannot depend on presentation components.";
    }
    if (internal.startsWith("infrastructure/") && target?.startsWith("src/server/") && !/^src\/server\/(supabase|cache|observability|http)\//.test(target)) {
      return "Infrastructure cannot import the composition root or unrelated server services.";
    }
    if (internal.startsWith("domain/")) {
      if ((!target && /^(react|next|zod|@supabase\/|server-only)/.test(imported)) || (target && !target.startsWith(`src/features/${feature}/domain/`) && !target.startsWith("src/shared/domain/"))) {
        return "Domain code only depends on its own domain and shared domain primitives.";
      }
    }
    if (targetFeature && targetFeature[1] !== feature) {
      if (!/^contracts(\/index)?(\.ts)?$/.test(targetFeature[2])) {
        return "Cross-feature imports must use the public contracts entrypoint.";
      }
      if (!dependencies[feature]?.includes(targetFeature[1])) {
        return "This contract import violates the documented dependency direction.";
      }
    }
    if (internal.startsWith("application/") && (target?.startsWith(`src/features/${feature}/infrastructure/`) || target?.startsWith(`src/features/${feature}/presentation/`) || target?.startsWith("src/server/") || /^(react|next|@supabase\/)/.test(imported))) {
      return "Application services depend on ports, not framework or infrastructure adapters.";
    }
    if (internal.startsWith("contracts/") && ((target && !target.startsWith("src/shared/contracts/") && !targetFeature?.[2].startsWith("contracts")) || (!target && imported !== "zod"))) {
      return "Contracts must remain browser-safe schemas and types.";
    }
  }
  return null;
}

export const importBoundaryRule = {
  meta: {
    type: "problem",
    schema: [],
    messages: { boundary: "{{reason}}" },
  },
  create(context) {
    let clientDirective = false;
    const inspect = (node) => {
      if (typeof node.source?.value !== "string") return;
      const reason = checkImportBoundary(context.filename, node.source.value, context.cwd, clientDirective);
      if (reason) context.report({ node, messageId: "boundary", data: { reason } });
    };
    return {
      Program(node) {
        clientDirective = node.body.some((item) => item.type === "ExpressionStatement" && item.directive === "use client");
      },
      ImportDeclaration: inspect,
      ExportNamedDeclaration: inspect,
      ExportAllDeclaration: inspect,
      ImportExpression: inspect,
    };
  },
};
