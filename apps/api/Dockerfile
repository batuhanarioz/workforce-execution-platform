FROM node:22-slim

ENV PNPM_HOME="/usr/local/share/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter @wfp/shared build \
  && pnpm --filter @wfp/api prisma:generate \
  && pnpm --filter @wfp/api build

EXPOSE 3001

CMD ["sh", "-c", "pnpm --filter @wfp/api prisma:push && pnpm --filter @wfp/api db:seed && pnpm --filter @wfp/api start"]
