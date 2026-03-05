FROM node:22-alpine

# Set pnpm home and path
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Enable corepack and activate the specific pnpm version
ARG PNPM_VERSION=9.15.4
RUN corepack enable && corepack prepare pnpm@$PNPM_VERSION --activate

# Create app directory
WORKDIR /app

# Copy root workspace and lockfiles first to leverage Docker layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/core/package.json ./packages/core/
COPY packages/rpc/package.json ./packages/rpc/
COPY packages/server/package.json ./packages/server/
COPY packages/client/package.json ./packages/client/
COPY site/package.json ./site/
COPY examples/client/package.json ./examples/client/
COPY examples/faremeter-server/package.json ./examples/faremeter-server/

# Install dependencies (only production deps where possible)
RUN pnpm install --frozen-lockfile

# Copy the rest of the application code
COPY . .

# Build the required internal packages (core, rpc, server)
RUN pnpm --filter '@nanosession/core' --filter '@nanosession/rpc' --filter '@nanosession/facilitator' build

# Expose the API port
EXPOSE 3001

# The Fly.toml will inject an environment variable to decide which script to run (mainnet/testnet)
# Default CMD falls back to tsx execution in the site dir
WORKDIR /app/site
CMD ["pnpm", "exec", "tsx", "protected-resource-demo-server/index.ts"]
