FROM node:24-bookworm-slim@sha256:c86ecead9e55a5210ac1727de38a4ca840bf03dcaf34dc9749addbf383b1920c AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY tsconfig.json vite.config.ts ./
COPY src ./src
COPY static ./static
RUN npm run build

FROM build AS dependencies
RUN npm prune --omit=dev --ignore-scripts

FROM node:24-bookworm-slim@sha256:c86ecead9e55a5210ac1727de38a4ca840bf03dcaf34dc9749addbf383b1920c AS runtime
ARG VERSION=development
ARG REVISION=unknown
LABEL org.opencontainers.image.source="https://github.com/torstenwerner/PageCourier" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${REVISION}"
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build /app/build ./build
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json LICENSE ./
COPY scripts/start.mjs ./scripts/start.mjs
USER node
EXPOSE 3000
CMD ["node", "scripts/start.mjs"]
