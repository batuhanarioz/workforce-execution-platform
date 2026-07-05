FROM node:22-slim

ENV PNPM_HOME="/usr/local/share/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV EXPO_NO_TELEMETRY=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@9.15.4 --activate \
  && npm install -g serve@14.2.4

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

COPY . .

ARG EXPO_PUBLIC_API_URL=http://localhost:3001/api
ENV EXPO_PUBLIC_API_URL=${EXPO_PUBLIC_API_URL}

RUN pnpm --filter @wfp/shared build \
  && pnpm --filter @wfp/mobile exec expo export --platform web --output-dir dist --dev

WORKDIR /app/apps/mobile
EXPOSE 19006

CMD ["serve", "-s", "dist", "-l", "19006"]
