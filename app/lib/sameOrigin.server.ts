/**
 * Same-origin gate for state-changing requests. The session cookie is
 * SameSite=Lax, which stops ordinary cross-site posts but not a credentialed
 * request from a same-site sibling origin; checking where the request comes
 * from closes that gap.
 */

/** The request's own host; the scheme is ignored behind Cloud Run's TLS proxy. */
const requestHost = (request: Request) => new URL(request.url).host;

/**
 * True when `value` is exactly an HTTP(S) origin (scheme, host and optional
 * port; no credentials, path, query or fragment) for the request's host.
 */
function isOwnOrigin(value: string, request: Request): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    (url.protocol === "https:" || url.protocol === "http:") &&
    url.origin === value &&
    url.host === requestHost(request)
  );
}

/** True when a Referer URL (which normally has a path) points at the request's host over HTTP(S). */
function isOwnReferer(value: string, request: Request): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      url.username === "" &&
      url.password === "" &&
      url.host === requestHost(request)
    );
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
  if (origin !== null) return isOwnOrigin(origin, request);
  const referer = request.headers.get("Referer");
  return referer !== null && isOwnReferer(referer, request);
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
