ARG NODE_VERSION=20.19.6
ARG PNPM_VERSION=10.34.3

# ---- base: manifest + full deps (dev deps included) ----
FROM node:${NODE_VERSION}-alpine AS base
ARG PNPM_VERSION
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/.npmrc ./
RUN pnpm install --frozen-lockfile

# ---- development: hot reload target used by docker-compose.yml ----
FROM base AS development
ENV NODE_ENV=development
COPY frontend/ .
EXPOSE 4200
CMD ["pnpm", "run", "start", "--host", "0.0.0.0", "--port", "4200"]

# ---- build: compiles the Angular app ----
FROM base AS build
COPY frontend/ .
RUN pnpm run build

# ---- production: static build served by nginx (docs/05-despliegue-infraestructura.md 5.2) ----
FROM nginx:1.27-alpine AS production
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
