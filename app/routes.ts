import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("sign-in", "routes/sign-in.tsx"),
  route("settings", "routes/settings.tsx"),
  route("auth/google/start", "routes/auth.google.start.ts"),
  route("auth/google/callback", "routes/auth.google.callback.tsx"),
  route("auth/outlook/start", "routes/auth.outlook.start.ts"),
  route("auth/outlook/callback", "routes/auth.outlook.callback.tsx"),
  route("auth/calendar-disconnection", "routes/auth.calendar-disconnection.ts"),
  route("auth/sign-out", "routes/auth.sign-out.ts"),
] satisfies RouteConfig;
