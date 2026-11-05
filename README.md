# BlogCMS API

[![CI](https://github.com/Filippo0311603/blog-cms-api/actions/workflows/ci.yml/badge.svg)](https://github.com/Filippo0311603/blog-cms-api/actions/workflows/ci.yml)

REST API for a blog with a small content management system (CMS), built with
**Node.js, Express 5, TypeScript (strict), MongoDB/Mongoose and zod**.
Readers browse and filter published posts; the CMS creates, edits, publishes and deletes them.

## Quick start (zero setup)

```bash
npm install
npm run dev
```

With no `MONGODB_URI`, the dev server starts an **in-memory MongoDB** automatically
(`mongodb-memory-server`) and logs a warning: **data is not persisted** across restarts.
The first run downloads a `mongod` binary, so it needs internet access once.

- API: <http://localhost:3000/api/v1>
- Swagger UI: <http://localhost:3000/docs> (raw spec: `/docs/openapi.json`, source: `openapi.yaml`)
- Health: <http://localhost:3000/health>

### Using a real MongoDB

```bash
docker compose up -d mongo                 # starts only MongoDB 8.2 on localhost:27017
cp .env.example .env                      # then set MONGODB_URI=mongodb://localhost:27017/blogcms
npm run dev
```

Optional sample data, from a **second terminal** (the dev server keeps the first one busy). The seed
**replaces all posts** in the target database, so running it twice gives the same result:

```bash
npm run seed
```

As a safety net, the seed refuses to run when `NODE_ENV=production` unless `SEED_FORCE=1` is set.

### Production build

```bash
npm run build && MONGODB_URI=... CMS_API_TOKEN=... NODE_ENV=production npm start
```

In any environment other than `development`, `MONGODB_URI` is required.

### Docker (API + MongoDB)

```bash
docker compose up --build
```

Starts MongoDB and the API on <http://localhost:3000> (docs at `/docs`). The API container waits until
MongoDB passes its healthcheck (`depends_on: condition: service_healthy`) and runs with `NODE_ENV=production`,
`MONGODB_URI=mongodb://mongo:27017/blogcms`, `PORT=3000` and `CMS_API_TOKEN` (default `brianfox-cms-token`;
override it from the shell or a `.env` file next to `docker-compose.yml`). Data lives in the `mongo-data` volume.

The `Dockerfile` is multi-stage (build with dev dependencies, then a `node:22-alpine` runtime with production
dependencies only), runs as the non-root `node` user as `node dist/server.js`, and has a `HEALTHCHECK` on `/health`.
The image does not contain `tsx`, so to load sample data run `npm run seed` from the host with
`MONGODB_URI=mongodb://localhost:27017/blogcms` (the compose file publishes MongoDB on port 27017).

The image is built and smoke-tested by CI on every push (the `docker` job in `.github/workflows/ci.yml`): `docker compose up --build --wait`, then `scripts/smoke.sh` (health, create, publish, list).

## Authentication (CMS)

All `/api/v1/cms/*` endpoints need the header:

```
Authorization: Bearer brianfox-cms-token
```

**The token is hardcoded by design (per the brief): `brianfox-cms-token`.** It can be overridden with the
`CMS_API_TOKEN` environment variable. Missing/invalid token gives `401` with a
`WWW-Authenticate: Bearer realm="BlogCMS"` header. The comparison is constant-time (SHA-256 digests
compared with `timingSafeEqual`). Reader endpoints are public.

## Brief requirements mapped to endpoints

| Brief item                                                                             | Endpoint                                        |
| -------------------------------------------------------------------------------------- | ----------------------------------------------- |
| List public posts (readers)                                                            | `GET /api/v1/posts`                             |
| Create post (title, body, hashtags, status default `draft`, author always "Brian Fox") | `POST /api/v1/cms/posts`                        |
| Publish a post                                                                         | `POST /api/v1/cms/posts/:id/publish`            |
| Delete a post                                                                          | `DELETE /api/v1/cms/posts/:id`                  |
| Readers filter by hashtag                                                              | `GET /api/v1/posts?hashtags=a,b&match=any\|all` |
| Hardcoded bearer token on CMS calls                                                    | `Authorization: Bearer brianfox-cms-token`      |

A ready-made request collection (every endpoint, happy path and error cases) is in
[`requests.http`](requests.http) for the VS Code REST Client extension (JetBrains HTTP Client can read it too, but
request chaining of the post id is REST Client only).

Additional endpoints (implicit requirements): `GET /api/v1/posts/:id`, `GET /api/v1/cms/posts`,
`GET /api/v1/cms/posts/:id`, `PATCH /api/v1/cms/posts/:id`, `POST /api/v1/cms/posts/:id/unpublish`, `GET /health`.

## API reference

Success responses wrap the payload: `{ "data": Post }` or `{ "data": Post[], "meta": { page, limit, total, totalPages } }`.
Errors always look like `{ "error": { "code", "message", "details?" } }`.

Post:

```json
{
  "id": "66f1c0a2b3c4d5e6f7a8b9c0",
  "title": "Hello",
  "body": "World",
  "hashtags": ["nodejs"],
  "status": "draft",
  "author": "Brian Fox",
  "publishedAt": null,
  "createdAt": "2026-11-04T10:00:00.000Z",
  "updatedAt": "2026-11-04T10:00:00.000Z"
}
```

### curl examples

```bash
TOKEN=brianfox-cms-token
BASE=http://localhost:3000

# Health
curl $BASE/health

# CMS: create a draft (201 + Location header)
curl -i -X POST $BASE/api/v1/cms/posts \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"Hello","body":"First post","hashtags":["#NodeJS","typescript"]}'

# CMS: create directly as published
curl -X POST $BASE/api/v1/cms/posts \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"Live","body":"Already public","status":"published"}'

# CMS: list everything (drafts included), optionally ?status=draft&hashtags=nodejs&page=1&limit=10
curl "$BASE/api/v1/cms/posts?status=draft" -H "Authorization: Bearer $TOKEN"

# CMS: get one / update / publish / unpublish / delete   (replace $ID)
curl $BASE/api/v1/cms/posts/$ID -H "Authorization: Bearer $TOKEN"
curl -X PATCH $BASE/api/v1/cms/posts/$ID \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"New title","hashtags":["updated"]}'
curl -X POST $BASE/api/v1/cms/posts/$ID/publish   -H "Authorization: Bearer $TOKEN"
curl -X POST $BASE/api/v1/cms/posts/$ID/unpublish -H "Authorization: Bearer $TOKEN"
curl -i -X DELETE $BASE/api/v1/cms/posts/$ID      -H "Authorization: Bearer $TOKEN"   # 204

# Readers: published posts only
curl "$BASE/api/v1/posts"
curl "$BASE/api/v1/posts?hashtags=nodejs,typescript&match=all&page=1&limit=5"
curl "$BASE/api/v1/posts?hashtags=%23NodeJS"   # a literal # must be sent as %23
curl $BASE/api/v1/posts/$ID
```

Query parameters of the list endpoints:

| Param      | Meaning                                                                                                                                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hashtags` | Comma-separated (or repeated). Normalized like stored tags, so `#NodeJS` equals `nodejs`. In a URL write the hash as `%23` (a raw `#` starts the URL fragment and is never sent to the server, so the filter would be silently lost). |
| `match`    | `any` (default): has at least one of the tags. `all`: has every tag.                                                                                                                                                                  |
| `page`     | 1-based, default 1.                                                                                                                                                                                                                   |
| `limit`    | Default 10, **capped at 100** (a larger value is reduced to 100; `meta.limit` shows the effective value).                                                                                                                             |
| `status`   | CMS list only: `draft` or `published`.                                                                                                                                                                                                |

## Design decisions and implicit requirements handled

- **Layered architecture**: routes -> controller (HTTP only) -> service (business rules) -> Mongoose model.
  Cross-cutting concerns are middlewares (`auth`, `validate`, `requireJson`, `notFound`, `errorHandler`).
  `app.ts` builds the app without listening (used by tests); `server.ts` wires DB, listening and graceful shutdown.
- **Validation with zod** on params, query and body; all problems are returned together as
  `400 VALIDATION_ERROR` with `details: [{ location, path, message }]`.
- **Drafts are never visible to readers**: list and get-by-id filter on `status: published`. A draft id
  returns `404` (not `403`) so its existence is not leaked.
- **Author is server-controlled**: always "Brian Fox", `immutable` in the model. On create, a client-supplied
  `author` is **ignored** (unknown keys are stripped). On `PATCH` the schema is **strict**, so `author` or `status`
  are rejected with `400` instead of being silently dropped.
- **Hashtag normalization** (Unicode NFC, trim, strip leading `#`, lowercase, de-duplicate), validation
  (letters/numbers/underscore, 1-50 chars, max 20 per post) and the _same_ normalization for reader filters.
- **Publishing**: `publishedAt` is set on publish (or on create with `status: "published"`).
  Publish is **idempotent** (200, `publishedAt` unchanged) and implemented as a conditional atomic update,
  so concurrent calls cannot overwrite the date. `unpublish` returns the post to draft with `publishedAt: null` and is idempotent in the same way
  (an existing draft is returned untouched, `updatedAt` included).
- **Status changes only through publish/unpublish**; `PATCH` edits title/body/hashtags only.
- **Malformed ids return 404** everywhere (a malformed id cannot match any post); this avoids a CastError/500
  and treats all "no such post" cases uniformly. This includes invalid percent-encoding in the path
  (e.g. `/posts/%zz`), which also returns 404 rather than 500.
- **Pagination** on both list endpoints with `meta`; deterministic ordering (`publishedAt desc, _id desc`).
- **Indexes**: `{ status, publishedAt, _id }` (reader list sort), `{ createdAt, _id }` (CMS list sort) and
  `{ hashtags }` (multikey, for filtering).
- **Consistent errors**: 400 (validation, malformed JSON), 401 (+`WWW-Authenticate`), 404 (also unknown routes),
  413 (body too large), 415 (body that is not JSON, or an unsupported `Content-Encoding`), 500. Any other 4xx
  raised by the framework keeps its status instead of becoming a 500. Stack traces are never returned outside `development`; unexpected errors are logged server-side.
- **Security basics**: `helmet`, configurable `CORS_ORIGIN`, JSON body size limit (`BODY_LIMIT`, default 100kb),
  constant-time token check, env validated at startup (fail fast), and **credentials are redacted from the logs**
  (`Authorization` and `Cookie` request headers are logged as `[REDACTED]`); `X-Powered-By` is disabled.
- **Ops**: `/health` (503 when the DB is down), structured logging with pino, graceful shutdown on SIGINT/SIGTERM,
  OpenAPI docs.
- **Express 5** forwards rejected promises from async handlers to the error middleware, so no `asyncHandler`
  wrapper is needed.
- **Response envelope**: `{ data }` / `{ data, meta }` rather than bare arrays, so metadata can grow without breaking clients.
- **Rate limiting** (`express-rate-limit`): per client IP, fixed window (default 120 requests/min on public reader
  routes, 300/min on CMS routes, counted separately; the CMS limiter runs before the auth check so token guessing is
  throttled too). `/health` and `/docs` are not limited. Responses carry the standard `RateLimit-Limit`,
  `RateLimit-Remaining` and `RateLimit-Reset` headers; past the limit the API answers `429` with `Retry-After` and the
  usual error JSON (`code: TOO_MANY_REQUESTS`). The counters are in memory, so with several API instances each one counts alone.
  **Behind a reverse proxy or load balancer set `TRUST_PROXY`** (e.g. `1` for one hop), otherwise every client shares
  the proxy's IP and one limit; never set it to `true` on a server that is directly reachable, because clients could then
  spoof `X-Forwarded-For` and dodge the limit. The value must match the real deployment (number of proxies in front of the API); express-rate-limit logs a validation error when it does not.
- **Request id**: an incoming `X-Request-Id` (up to 128 characters of `A-Za-z0-9_.:-`) is reused, otherwise a UUID is
  generated. It is returned in the `X-Request-Id` response header, attached to every log line (pino-http) and repeated as
  `error.requestId` in error responses, so a client report can be matched to the server logs.
- **HTTP caching**: public reads send `Cache-Control: public, no-cache` and a weak `ETag`: caches must revalidate, and a conditional request with
  `If-None-Match` gets `304 Not Modified` without a body, so changes are visible immediately. Setting `PUBLIC_CACHE_MAX_AGE=N` (seconds)
  switches to `public, max-age=N`; then a published, edited or deleted post can take up to N seconds to show up for clients that cache.
  CMS responses are `Cache-Control: no-store`, and so are all error responses.
- **Scope**: no real user accounts or full-text search (out of the brief).

## Configuration

| Variable                | Default              | Description                                                       |
| ----------------------- | -------------------- | ----------------------------------------------------------------- |
| `NODE_ENV`              | `development`        | `development`, `test` or `production` (empty = development)       |
| `PORT`                  | `3000`               | HTTP port, 1-65535                                                |
| `MONGODB_URI`           | _(empty)_            | Empty in development = in-memory MongoDB. Required otherwise.     |
| `CMS_API_TOKEN`         | `brianfox-cms-token` | Bearer token for CMS routes                                       |
| `BODY_LIMIT`            | `100kb`              | Max JSON body size                                                |
| `CORS_ORIGIN`           | `*`                  | `*` or comma-separated origins                                    |
| `LOG_LEVEL`             | `info`               | pino level (`silent` to mute)                                     |
| `TRUST_PROXY`           | `false`              | Express `trust proxy`: `true`/`false`, hop count, or address list |
| `RATE_LIMIT_WINDOW_MS`  | `60000`              | Rate limit window in ms                                           |
| `RATE_LIMIT_PUBLIC_MAX` | `120`                | Requests per window per IP on public reader routes                |
| `RATE_LIMIT_CMS_MAX`    | `300`                | Requests per window per IP on CMS routes                          |
| `PUBLIC_CACHE_MAX_AGE`  | `0`                  | `max-age` (seconds) of public GETs; `0` = `public, no-cache`      |

## Scripts

| Command                           | Description                                          |
| --------------------------------- | ---------------------------------------------------- |
| `npm run dev`                     | Dev server with reload (tsx)                         |
| `npm run build` / `npm start`     | Compile to `dist/` / run compiled server             |
| `npm test`                        | Vitest: unit + integration tests                     |
| `npm run lint` / `npm run format` | ESLint / Prettier (`npm run format:check` verifies)  |
| `npm run typecheck`               | `tsc --noEmit` (includes tests)                      |
| `npm run seed`                    | Replace all posts with samples (needs `MONGODB_URI`) |

## Testing

```bash
npm test
```

Integration tests (Supertest against the real Express app) run on an in-memory MongoDB started once by Vitest's
`globalSetup`; each test file uses its own database. They cover creation defaults and author enforcement,
hashtag normalization, validation errors, 401 on every CMS route, draft visibility, publish/unpublish and
idempotency, hashtag filtering (`any`/`all`), pagination, invalid/missing ids, delete, unknown routes, malformed
JSON, body limits and the 500 error shape. Unit tests (`test/unit`) cover hashtag normalization (including Unicode), environment parsing (`loadEnv`) and
the database bootstrap guard (`initDatabase`). `test/integration/http.test.ts` covers request ids, `Cache-Control`/ETag/304 and the 429 rate limit (tests run with a very high limit; the 429 test builds an app with a low one). Integration tests (`test/integration`) are split into `posts`
(main API behaviour), `logging` (credentials are redacted from logs) and `regressions` (framework-level 4xx errors,
415, idempotent unpublish, repeated hashtag filters).

## Project layout

```
src/
  config/env.ts            env parsing (zod)
  db/index.ts              connect/disconnect, in-memory fallback
  middlewares/             auth, validate, requireJson, requestId, rateLimit, cacheControl, notFound, errorHandler
  modules/posts/           model, zod schemas, service, controller, routes, hashtag helpers
  docs/swagger.ts          serves openapi.yaml at /docs
  utils/                   ApiError, logger
  scripts/seed.ts
  app.ts / server.ts
test/                      unit + integration
openapi.yaml
requests.http              REST Client / HTTP Client request collection
Dockerfile, docker-compose.yml, .dockerignore
```
