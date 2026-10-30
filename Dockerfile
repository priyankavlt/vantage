# syntax=docker/dockerfile:1
# Multi-stage build for both apps. Targets: `server`, `web`.

FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS build
ARG API_URL=http://server:4000
ENV API_URL=$API_URL NEXT_TELEMETRY_DISABLED=1 TURBO_TELEMETRY_DISABLED=1
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@vantage/server --filter=@vantage/web
# Self-contained server folder: built bundle plus production node_modules only.
RUN pnpm --filter @vantage/server deploy --prod /out/server

FROM node:24-alpine AS server
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out/server/dist ./dist
COPY --from=build /out/server/node_modules ./node_modules
COPY --from=build /out/server/package.json ./package.json
COPY --from=build /repo/packages/db/drizzle ./drizzle
ENV MIGRATIONS_DIR=/app/drizzle
USER node
EXPOSE 4000
CMD ["node", "dist/index.mjs"]

FROM node:24-alpine AS web
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
