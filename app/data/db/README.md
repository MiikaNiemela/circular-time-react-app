# app/data/db

Server-side database infrastructure. **Never import these files from client-side code.**

## What lives here

| File                                   | Purpose                                                                                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `prismaClient.server.ts`               | Singleton `PrismaClient` instance wired with `@prisma/adapter-pg`. Reused across HMR reloads in dev to avoid exhausting connection limits. |
| `prismaUserRepository.server.ts`       | Concrete `PrismaUserRepository` implementing the `UserRepository` interface from `app/lib/`.                                               |
| `prismaEventCacheRepository.server.ts` | Concrete `PrismaEventCacheRepository` implementing the `ServerEventCache` interface from `app/lib/`.                                       |

## Constraints

- All files in this folder are server-only (`.server.ts` suffix enforces this via React Router's convention).
- Business-logic callers import the `UserRepository` interface from `app/lib/userRepository.ts`, not this folder directly. The concrete Prisma driver is wired via `app/lib/userRepository.server.ts`.
- Prisma 7 requires a driver adapter (`PrismaPg`) and `prisma.config.ts` at the repo root instead of `url` in `schema.prisma`.
