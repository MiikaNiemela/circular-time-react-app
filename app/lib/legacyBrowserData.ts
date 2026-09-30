/**
 * Earlier builds kept provider OAuth tokens and fetched events in
 * localStorage. Credentials now live only on the server, so any copies left
 * in the browser are removed.
 */
const LEGACY_KEYS = [
  "circular-time-google-tokens",
  "circular-time-outlook-tokens",
  "circular-time-cache",
] as const;

/** Removes browser-held provider tokens and cached events written by earlier builds. */
export function removeLegacyBrowserCalendarData(
  storage: Pick<Storage, "removeItem"> = localStorage
) {
  for (const key of LEGACY_KEYS) storage.removeItem(key);
}
