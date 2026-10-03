/** The calendar and sign-in providers the app supports. */
export type SupportedProvider = "google" | "outlook";

/**
 * Reads `{ "provider": "google" | "outlook" }` from a JSON request body.
 * Returns the provider, or a 400 response for a body that is not valid JSON,
 * not an object (including `null`), or names an unknown provider.
 */
export async function readProviderBody(request: Request): Promise<SupportedProvider | Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  const provider = (body as { provider?: unknown }).provider;
  if (provider !== "google" && provider !== "outlook") {
    return Response.json({ error: "Unknown provider" }, { status: 400 });
  }
  return provider;
}
