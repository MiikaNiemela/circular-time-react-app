/**
 * Application-scoped CalendarCredentialStore wired to Prisma and the
 * TOKEN_ENCRYPTION_KEY cipher. Server-only.
 */
import { prisma } from "../data/db/prismaClient.server";
import { PrismaCalendarCredentialRepository } from "../data/db/prismaCalendarCredentialRepository.server";
import { refreshProviderTokens, type OAuthProviderId } from "../data/providers/oauthClient.server";
import {
  getGoogleClientSecret,
  getOutlookClientSecret,
} from "../data/providers/clientSecrets.server";
import { GOOGLE_CLIENT_ID } from "../data/providers/google/config";
import { OUTLOOK_CLIENT_ID } from "../data/providers/outlook/config";
import {
  CalendarCredentialStore,
  type CalendarCredentialRepository,
  type CredentialRefresher,
} from "./calendarCredentials";
import { tokenCipher } from "./tokenCipher.server";

const repository: CalendarCredentialRepository = new PrismaCalendarCredentialRepository(prisma);

/** The application's credential store; the cipher key is read on first use. */
export const calendarCredentialStore = {
  save: (...args: Parameters<CalendarCredentialStore["save"]>) =>
    new CalendarCredentialStore(repository, tokenCipher()).save(...args),
  accessToken: (...args: Parameters<CalendarCredentialStore["accessToken"]>) =>
    new CalendarCredentialStore(repository, tokenCipher()).accessToken(...args),
};

/** Refreshes a provider's access token with the server-held client secret. */
export function providerRefresher(provider: OAuthProviderId): CredentialRefresher {
  return async (refreshToken) => {
    const clientSecret =
      provider === "google" ? await getGoogleClientSecret() : await getOutlookClientSecret();
    const clientId = provider === "google" ? GOOGLE_CLIENT_ID : OUTLOOK_CLIENT_ID;
    return refreshProviderTokens(provider, refreshToken, { clientId, clientSecret });
  };
}
