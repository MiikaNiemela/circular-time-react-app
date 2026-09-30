import type { Route } from "./+types/auth.identity-link";
import { getUserId } from "../lib/session.server";
import { fetchGoogleUserId, fetchOutlookUserId } from "../lib/userInfo.server";
import { userRepository } from "../lib/userRepository.server";

/**
 * Authenticated resource route that links a verified provider identity to the
 * signed-in application account, so that identity can also sign in to it.
 * It never creates an account, changes the session, or merges accounts: an
 * identity owned by another account is refused.
 */
export async function action({ request }: Route.ActionArgs) {
  const userId = await getUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { provider?: string; accessToken?: string };
  try {
    body = (await request.json()) as { provider?: string; accessToken?: string };
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { provider, accessToken } = body;
  if (!provider || !accessToken) {
    return Response.json({ error: "Missing provider or accessToken" }, { status: 400 });
  }

  let providerUserId: string;
  try {
    if (provider === "google") {
      providerUserId = await fetchGoogleUserId(accessToken);
    } else if (provider === "outlook") {
      providerUserId = await fetchOutlookUserId(accessToken);
    } else {
      return Response.json({ error: "Unknown provider" }, { status: 400 });
    }
  } catch {
    return Response.json({ error: "Failed to verify identity with provider" }, { status: 401 });
  }

  let result: Awaited<ReturnType<typeof userRepository.linkProviderAccount>>;
  try {
    result = await userRepository.linkProviderAccount(userId, provider, providerUserId);
  } catch {
    return Response.json({ error: "Failed to store the linked identity" }, { status: 503 });
  }

  if (result === "conflict") {
    return Response.json(
      {
        error:
          "This account already belongs to another Circular Time account. Accounts are never merged.",
      },
      { status: 409 }
    );
  }
  if (result === "provider-already-linked") {
    return Response.json(
      { error: "A different account from this provider is already linked." },
      { status: 409 }
    );
  }

  return Response.json({ ok: true });
}
