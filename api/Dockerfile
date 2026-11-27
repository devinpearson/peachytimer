# Peachy Timer API on the Bun runtime (same layout as tm-scrapper's image).
FROM oven/bun:1.3.5 AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY src ./src
COPY tsconfig.json ./
RUN bun run build

FROM oven/bun:1.3.5-slim
WORKDIR /app
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs --shell /bin/sh --create-home bunuser
COPY package.json bun.lock ./
RUN bun install --production --frozen-lockfile
COPY --from=builder /app/dist ./dist
RUN chown -R bunuser:nodejs /app
USER bunuser

ENV NODE_ENV=production \
    PORT=4000 \
    LOG_LEVEL=info \
    ROOM_TTL_HOURS=12
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun -e "fetch('http://localhost:4000/api/health/live').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["bun", "dist/index.js"]
