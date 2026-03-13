# Stage 1: Dependencies
FROM node:22-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ARG PNPM_VERSION=10.30.3
RUN corepack enable && corepack prepare pnpm@$PNPM_VERSION --activate

WORKDIR /app

# Copy all package manifests and workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/core/package.json ./packages/core/
COPY packages/rpc/package.json ./packages/rpc/
COPY packages/client/package.json ./packages/client/
COPY packages/facilitator/package.json ./packages/facilitator/
COPY packages/faremeter-plugin/package.json ./packages/faremeter-plugin/
COPY packages/x402-adapter/package.json ./packages/x402-adapter/
COPY packages/facilitator-service/package.json ./packages/facilitator-service/

# Install dependencies (frozen-lockfile for consistency)
RUN pnpm install --frozen-lockfile

# Stage 2: Build
FROM base AS builder

# Copy all source code
COPY packages ./packages
COPY tsconfig.json ./

# Build all packages in the workspace
RUN pnpm build

# Use pnpm deploy to isolate the facilitator-service and its dependencies for production
# This creates a lean directory with only what's needed to run the service
RUN pnpm --filter "@nanosession/facilitator-service" deploy --prod --legacy /prod/facilitator-service

# Stage 3: Runner
FROM node:22-alpine AS runner

WORKDIR /app

# Copy the deployed production artifacts
COPY --from=builder /prod/facilitator-service .

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

# Start the service using the entrypoint in the deployed directory
CMD ["node", "dist/index.js"]
