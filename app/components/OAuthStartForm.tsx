import type { ReactNode } from "react";

export interface OAuthStartFormProps {
  provider: "google" | "outlook";
  /** Link a sign-in identity, or connect the provider's calendar. */
  intent: "link-identity" | "connect-calendar";
  /** Accessible name of the button. */
  label: string;
  /** Class of the submit button. */
  className: string;
  children: ReactNode;
  onSubmit?: () => void;
}

/** A button that starts the server-side OAuth flow for a provider. */
export function OAuthStartForm({
  provider,
  intent,
  label,
  className,
  children,
  onSubmit,
}: OAuthStartFormProps) {
  return (
    <form method="post" action={`/auth/${provider}/start`} onSubmit={onSubmit}>
      <input type="hidden" name="intent" value={intent} />
      <button type="submit" className={className} aria-label={label}>
        {children}
      </button>
    </form>
  );
}
