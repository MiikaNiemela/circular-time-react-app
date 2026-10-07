import type { Route } from "./+types/streams";
import { getUserId } from "../lib/session.server";
import { streamRepository } from "../lib/streamRepository.server";
import { rejectUnsafeRequest } from "../lib/sameOrigin.server";
import { parseStreamChange } from "../data/streams";

/**
 * Applies one change to the signed-in account's streams: rename, move,
 * set-visible, assign a calendar, or delete an empty stream. Same-origin JSON
 * only; every id is checked against the account.
 */
export async function action({ request }: Route.ActionArgs) {
  const userId = await getUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const unsafe = rejectUnsafeRequest(request, { json: true });
  if (unsafe) return unsafe;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  const change = parseStreamChange(body);
  if (!change) return Response.json({ error: "Invalid stream change" }, { status: 400 });

  let result;
  try {
    result = await streamRepository.applyStreamChange(userId, change);
  } catch {
    return Response.json({ error: "Failed to change streams" }, { status: 503 });
  }
  switch (result) {
    case "ok":
      return Response.json({ ok: true });
    case "not-found":
      return Response.json({ error: "Stream or calendar not found" }, { status: 404 });
    case "not-empty":
      return Response.json({ error: "Only an empty stream can be deleted" }, { status: 409 });
  }
}
