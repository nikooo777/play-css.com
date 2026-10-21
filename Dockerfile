FROM oven/bun:1.4.3-alpine AS dependencies

RUN apk upgrade --no-cache

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM node:24.22.1-alpine3.24 AS build

RUN apk upgrade --no-cache

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

RUN ./node_modules/.bin/next build

FROM node:24.22.1-alpine3.24 AS runtime

RUN apk upgrade --no-cache \
    && rm -rf /usr/local/lib/node_modules/npm \
        /usr/local/lib/node_modules/corepack /opt/yarn-v1.22.22 \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx \
        /usr/local/bin/corepack /usr/local/bin/yarn \
        /usr/local/bin/yarnpkg

WORKDIR /app

ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static

USER node

EXPOSE 3000

CMD ["node", "server.js"]
