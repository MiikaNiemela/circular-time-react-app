# Stage 1 — install all deps (needed to build)
FROM node:24.16.0-slim AS deps
WORKDIR /app
COPY package*.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

# Stage 2 — build the app
FROM node:24.16.0-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Public OAuth client ID (PKCE, no secret). Vite inlines VITE_* at build time,
# so it must be present here — supplied as a build-arg from a GitHub secret.
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ARG VITE_OUTLOOK_CLIENT_ID
ENV VITE_OUTLOOK_CLIENT_ID=$VITE_OUTLOOK_CLIENT_ID
RUN npm run build

# Stage 3 — production image
FROM node:24.16.0-slim AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --ingroup nodejs reactrouter

COPY package*.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci --omit=dev

COPY --from=builder --chown=reactrouter:nodejs /app/build ./build

USER reactrouter

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node_modules/.bin/react-router-serve", "./build/server/index.js"]
