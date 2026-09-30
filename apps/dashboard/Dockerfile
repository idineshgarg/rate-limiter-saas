# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json nx.json tsconfig.base.json tsconfig.json ./
COPY apps ./apps
COPY packages ./packages

RUN npm ci
# Defaults to relative /v1/... paths (same-origin). Override at build time
# (--build-arg VITE_API_URL=https://api.example.com) when the API is served
# from a different origin than the dashboard.
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL
RUN npx nx build dashboard

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/apps/dashboard/dist /usr/share/nginx/html
COPY apps/dashboard/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
