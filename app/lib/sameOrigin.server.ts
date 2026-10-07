/**
 * Same-origin gate for state-changing requests. The session cookie is
 * SameSite=Lax, which stops ordinary cross-site posts but not a credentialed
 * request from a same-site sibling origin; checking where the request comes
 * from closes that gap.
 */

/** The request's own origin by host; the scheme is ignored behind Cloud Run's TLS proxy. */
function sameHost(value: string, request: Request): boolean {
  try {
    return new URL(value).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

/**
 * True when the request comes from the app's own pages: `Origin` matches the
 * request's host, or, when a browser sends no `Origin`, `Referer` does. A
 * request with neither, or with `Origin: null`, is refused.
 */
export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("Origin");
  if (origin !== null) return origin !== "null" && sameHost(origin, request);
  const referer = request.headers.get("Referer");
  return referer !== null && sameHost(referer, request);
}

/**
 * Returns a 403 response for a cross-origin request, or a 415 for a JSON
 * route that was not sent as JSON; null when the request may proceed.
 */
export function rejectUnsafeRequest(
  request: Request,
  { json }: { json: boolean }
): Response | null {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Cross-origin request refused" }, { status: 403 });
  }
  const type = request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase();
  if (json && type !== "application/json") {
    return Response.json({ error: "Expected application/json" }, { status: 415 });
  }
  return null;
}
