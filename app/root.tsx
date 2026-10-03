import { useEffect } from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import { ThemeProvider } from "./components/ThemeProvider";
import { removeLegacyBrowserCalendarData } from "./lib/legacyBrowserData";
import { fontFaceCss, fontPreloadLinks } from "./styles/fonts";

export function links() {
  return fontPreloadLinks;
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <Meta />
        <Links />
        <style dangerouslySetInnerHTML={{ __html: fontFaceCss }} />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  useEffect(() => removeLegacyBrowserCalendarData(), []);
  return (
    <ThemeProvider>
      <Outlet />
    </ThemeProvider>
  );
}
