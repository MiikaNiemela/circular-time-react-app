import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("sign-in", "routes/sign-in.tsx"),
  route("settings", "routes/settings.tsx"),
  route("auth/google/callback", "routes/auth.google.callback.tsx"),
  route("auth/google/token", "routes/auth.google.token.tsx"),
  route("auth/outlook/callback", "routes/auth.outlook.callback.tsx"),
  route("auth/session", "routes/auth.session.ts"),
  route("auth/sign-out", "routes/auth.sign-out.ts"),
] satisfies RouteConfig;
