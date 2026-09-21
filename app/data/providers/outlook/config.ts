export const OUTLOOK_CLIENT_ID: string =
  (import.meta.env.VITE_OUTLOOK_CLIENT_ID as string | undefined) ?? "";

export function outlookRedirectUri(origin: string): string {
  return `${origin}/auth/outlook/callback`;
}

export function isOutlookConfigured(): boolean {
  return OUTLOOK_CLIENT_ID.length > 0;
}
