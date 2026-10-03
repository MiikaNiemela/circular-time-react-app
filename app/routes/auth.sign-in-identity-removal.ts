import type { Route } from "./+types/auth.sign-in-identity-removal";
import { getUserId } from "../lib/session.server";
import { userRepository } from "../lib/userRepository.server";

/**
 * Authenticated resource route that unlinks one provider's sign-in identity
 * from the current application account. The account's last sign-in identity
 * is kept, so the account can always be signed in to. Calendar connections,
 * sessions and cached events are unchanged.
 */
export async function action({ request }: Route.ActionArgs) {
  const userId = await getUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { provider?: string };
  try {
    body = (await request.json()) as { provider?: string };
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { provider } = body;
  if (provider !== "google" && provider !== "outlook") {
    return Response.json({ error: "Unknown provider" }, { status: 400 });
  }

  let result;
  try {
    result = await userRepository.removeSignInIdentity(userId, provider);
  } catch {
    return Response.json({ error: "Failed to remove the sign-in account" }, { status: 503 });
  }

  switch (result) {
    case "removed":
      return Response.json({ ok: true });
    case "last-identity":
      return Response.json(
        { error: "The last sign-in account cannot be removed" },
        { status: 409 }
      );
    case "not-linked":
      return Response.json({ error: "Sign-in account not linked" }, { status: 404 });
  }
}
