# syntax=docker/dockerfile:1

##############################
# Stage 1: install & test deps
##############################
FROM node:20-alpine AS build
WORKDIR /app

# Install ALL dependencies (incl. dev) for a reproducible install using the lockfile.
COPY package.json package-lock.json ./
RUN npm ci

# Copy source.
COPY src ./src

# Prune dev dependencies so only production deps ship in the runtime image.
RUN npm prune --omit=dev

##############################
# Stage 2: minimal runtime
##############################
FROM node:20-alpine AS runtime

# Build-time version, injected by Jenkins (e.g. the build number / git tag).
ARG APP_VERSION=0.0.0-dev
ENV APP_VERSION=${APP_VERSION}
ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

# Run as the built-in non-root user for a smaller attack surface.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src

USER node
EXPOSE 3000

# Container-level healthcheck hitting the /health endpoint.
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "src/index.js"]
