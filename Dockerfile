# syntax=docker/dockerfile:1

FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
# Vite embeds these public map settings during the build. Leave them unset to
# use OpenStreetMap; configure them as build-time variables in Coolify.
ARG VITE_TILE_URL_DAY
ARG VITE_TILE_URL_NIGHT
ARG VITE_TILE_ATTRIBUTION
RUN npm run build

FROM nginx:1.27-alpine AS runtime

# SPA-friendly nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
