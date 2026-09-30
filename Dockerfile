# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# Optional one-off database/maintenance commands; never run migrations on app boot.
FROM dependencies AS tooling
COPY tsconfig.json ./
COPY scripts ./scripts
COPY migrations ./migrations
COPY src/lib ./src/lib
ENV NODE_ENV=production
USER node
CMD ["node", "--import", "tsx", "scripts/db.ts", "migrate"]

FROM dependencies AS builder
COPY . .
# Public browser configuration only. All secrets are supplied at runtime.
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY=""
ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY=${NEXT_PUBLIC_TURNSTILE_SITE_KEY} \
    NODE_ENV=production \
    DOCKER_BUILD=true
RUN npm run build

FROM base AS runtime
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3010 \
    UPLOAD_DIR=/app/data/uploads
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
RUN mkdir -p /app/data/uploads /app/.next/cache && chown -R node:node /app/data /app/.next/cache
USER node
EXPOSE 3010
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3010/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
