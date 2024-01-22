FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat git

# Clone and build cartesi-client
WORKDIR /opt/cartesi-client
RUN \
  git clone -b feature/types-and-standardizations --depth 1 https://github.com/prototyp3-dev/cartesi-client.git && \
  cd cartesi-client && \
  npm clean-install && \
  npm run build && \
  npm pack .

# Install dependencies
WORKDIR /app
COPY package.json package-lock.json* ./
RUN \
  npm clean-install && \
  npm install /opt/cartesi-client/cartesi-client/cartesi-client*.tgz


# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .


ENV NEXT_TELEMETRY_DISABLED 1

# FIXME: uncomment this for production
# RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner

LABEL org.opencontainers.image.source https://github.com/prototyp3-dev/world-arcade-app

WORKDIR /app

# FIXME: uncomment this for production
# ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# FIXME: uncomment this for production
# COPY --from=builder /app/public ./public
RUN chown -R nextjs:nodejs /app
COPY --from=builder --chown=nextjs:nodejs /app/ ./

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
# FIXME: uncomment this for production
# COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
# set hostname to localhost
ENV HOSTNAME "0.0.0.0"

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
# FIXME: uncomment this for production
# CMD ["node", "server.js"]
CMD ["npm", "run", "dev"]
