import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Prisma 7 no longer accepts `url` in schema.prisma — it must be declared here.
    // Undefined during `prisma generate` (not needed for client generation).
    url: process.env.DATABASE_URL,
  },
});
