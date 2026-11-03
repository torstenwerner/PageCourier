# PageCourier

PageCourier is a web application for sharing rendered Markdown through a
unique link. This repository currently contains the application foundation;
upload and document-storage features are not implemented yet.

## Requirements

- Node.js 24 LTS and npm
- Playwright's Chromium browser to run browser tests

Use `nvm use` to select the Node version from `.nvmrc`, then install the locked
dependencies:

```sh
npm ci
```

## Configuration

Development starts with safe local defaults. Copy `.env.example` to `.env` to
override them. SvelteKit loads `.env` for development; never put credentials in
the example file or client-side code.

| Variable              | Required   | Default                   | Description                                                                                                  |
| --------------------- | ---------- | ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `PUBLIC_ORIGIN`       | Production | `http://localhost:<PORT>` | Canonical HTTP(S) origin used for public links. It must not include a path, query, fragment, or credentials. |
| `HOST`                | No         | `0.0.0.0`                 | Address on which the Node server listens.                                                                    |
| `PORT`                | No         | `3000`                    | Listen port, from 1 through 65,535.                                                                          |
| `UPLOAD_MAX_BYTES`    | No         | `5242880`                 | Positive, safe-integer upload limit in bytes (5 MiB by default).                                             |
| `LOG_LEVEL`           | No         | `info`                    | One of `trace`, `debug`, `info`, `warn`, `error`, or `fatal`.                                                |
| `S3_BUCKET`           | Production | `pagecourier-development` | S3-compatible bucket name.                                                                                   |
| `AWS_REGION`          | Production | `us-east-1`               | AWS region for the bucket.                                                                                   |
| `S3_ENDPOINT`         | No         | unset                     | Optional custom HTTP(S) endpoint; production endpoints must use HTTPS.                                       |
| `S3_FORCE_PATH_STYLE` | No         | `false`                   | Whether to use path-style S3 addressing. Must be `true` or `false`.                                          |
| `S3_KEY_PREFIX`       | No         | empty                     | Optional key prefix, without a leading slash or `..` path segment.                                           |

Production configuration is validated before the server starts. Set
`PUBLIC_ORIGIN`, `S3_BUCKET`, and `AWS_REGION` in the deployment environment.
The AWS SDK uses its default credential-provider chain (for example workload
identity or an injected credentials source); credentials are not application
configuration and must never be committed.

## Development

```sh
npm run dev
```

## Production

Build and start the Node-adapter server with the required production settings:

```sh
npm run build
PUBLIC_ORIGIN=https://pages.example.com \
S3_BUCKET=pagecourier \
AWS_REGION=us-east-1 \
npm start
```

The start command sets production mode before loading the built server. Provide
storage credentials through the AWS default credential-provider chain.

## Checks and tests

```sh
npm run check             # Svelte and TypeScript checks
npm run lint              # Prettier and ESLint
npm run test:unit         # Vitest unit tests
npm run test:e2e:install  # Install Playwright Chromium once
npm run test:e2e          # Production Node-adapter smoke test
npm test                  # Unit and browser tests
npm run build             # Production build
```

The browser test builds and starts the production Node adapter locally. It
does not require a live S3 service because this foundation does not yet read
or write documents.
