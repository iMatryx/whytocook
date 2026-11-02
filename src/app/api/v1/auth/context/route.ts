import { requestContext } from "@/server/auth/session.server";
import { accessErrorResponse, privateJson } from "@/server/http/access-response.server";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    const context = await requestContext(request);
    return privateJson({ actor: context.actor }, requestId);
  } catch (error) {
    return accessErrorResponse(error, requestId);
  }
}
