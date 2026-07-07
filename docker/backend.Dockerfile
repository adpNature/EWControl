ARG NODE_VERSION=20.19.6
ARG PNPM_VERSION=10.34.3

# ---- base: manifest + full deps (dev deps included) ----
FROM node:${NODE_VERSION}-alpine AS base
ARG PNPM_VERSION
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
COPY backend/package.json backend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---- development: hot reload target used by docker-compose.yml ----
FROM base AS development
ENV NODE_ENV=development
COPY backend/ .
EXPOSE 3000
CMD ["pnpm", "run", "start:dev"]

# ---- build: compiles TS -> dist using the dev-dependency toolchain ----
FROM base AS build
ENV NODE_ENV=production
COPY backend/ .
RUN pnpm run build

# ---- production: minimal final image (docs/05-despliegue-infraestructura.md 5.2) ----
FROM node:${NODE_VERSION}-alpine AS production
ARG PNPM_VERSION
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
COPY backend/package.json backend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main"]
