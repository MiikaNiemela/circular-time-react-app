/**
 * Route-wiring cases for the same-origin gate: every mutation route must
 * refuse each of these on its own, without side effects.
 */
export const SAME_ORIGIN = "http://localhost";

export interface GateCase {
  name: string;
  /** Headers replacing the route's valid defaults; `null` removes a header. */
  headers: Record<string, string | null>;
  status: 403 | 415;
}

/** Cases for every mutation route. */
export const ORIGIN_CASES: GateCase[] = [
  { name: "a cross-origin request", headers: { Origin: "https://evil.example.com" }, status: 403 },
  { name: "a request with no Origin or Referer", headers: { Origin: null }, status: 403 },
  { name: "Origin: null", headers: { Origin: "null" }, status: 403 },
];

/** Extra case for JSON routes: same origin, but not sent as JSON. */
export const JSON_CASE: GateCase = {
  name: "a same-origin text/plain body",
  headers: { "Content-Type": "text/plain" },
  status: 415,
};

/** Builds a POST from valid default headers with a case's overrides applied. */
export function gateRequest(
  url: string,
  defaults: Record<string, string>,
  overrides: Record<string, string | null>,
  body?: BodyInit
): Request {
  const headers: Record<string, string> = { ...defaults };
  for (const [name, value] of Object.entries(overrides)) {
    if (value === null) delete headers[name];
    else headers[name] = value;
  }
  return new Request(url, { method: "POST", headers, body });
}
