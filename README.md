# Sword & Sorcery over Yonder

A compendium and character toolset for the 2014 ruleset of fifth-edition D&D.
You paid for the content; you should be able to use it without being pushed onto
a new edition.

Next.js (App Router) · React 19 · Chakra UI v3 · Drizzle · Postgres 16

## Getting started

You need Node, pnpm, and Docker.

```bash
pnpm install
cp .env.example .env       # defaults match docker-compose.yml
pnpm db:up                 # Postgres on :5433
pnpm db:migrate            # apply schema
pnpm db:seed               # load content
pnpm dev                   # http://localhost:3000
```

Content comes from a seed — a data-only dump restored by `pnpm db:seed`. Schema
always comes from the Drizzle migrations, never from the seed, so the two cannot
drift. The SRD seed is not committed yet; until it is, you need a seed file from
someone who has one. See `seed/README.md`.

Illustrations are optional and never committed. Without `CONTENT_IMAGE_DIR` set
the app runs fine and images 404.

### Environment

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection |
| `CONTENT_IMAGE_DIR` | no | Local image directory, served in dev by `/api/media` |
| `NEXT_PUBLIC_IMAGE_BASE_URL` | prod | Image origin; unset falls back to `/api/media` |

## Commands

| | |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | run, build, serve |
| `pnpm lint` | ESLint |
| `pnpm test` / `pnpm test:watch` | Vitest |
| `pnpm db:up` / `pnpm db:down` | Postgres container |
| `pnpm db:generate` / `pnpm db:migrate` / `pnpm db:studio` | Drizzle |
| `pnpm db:seed` | restore a content seed |

Run one test file with `pnpm vitest run path/to/file.test.ts`, or one case
with `-t "substring"`.

## Layout

```
src/app/          routes; browse views, entity pages, /api/media
src/components/   entry/ is the recursive renderer for body text and {@tag} markup
src/lib/content/  pure formatters and the tag tokenizer — no React, no database
src/lib/routes.ts the URL scheme
src/server/db/    Drizzle schema and queries
src/theme/        Chakra tokens
```

Every entity, whatever its type, gets a row in `entities`; the detail tables
(`spells`, `monsters`, …) add typed columns for filtering and keep the complete
original object in a `data` JSON column, which is what the renderer reads.
