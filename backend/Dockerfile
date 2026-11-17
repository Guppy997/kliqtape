# better-sqlite3 ist eine native Abhaengigkeit und muss kompiliert werden.
# Darum ein Builder-Stage mit Toolchain, damit das Runtime-Image schlank bleibt.
FROM node:22-bookworm-slim@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee AS build
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Dev-Abhaengigkeiten rauswerfen, native Module bleiben erhalten.
RUN npm prune --omit=dev

# ---------------------------------------------------------------------------

FROM node:22-bookworm-slim@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
# Schriften fuer die PDFs (scripts/fonts.sh); fonts.ts sucht sie zwei Ebenen
# ueber dist/print, also unter /app/assets.
COPY assets ./assets

RUN mkdir -p /data /media && chown -R node:node /data /media
USER node

EXPOSE 3000
CMD ["node", "dist/server.js"]
