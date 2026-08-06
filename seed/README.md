# Seeds

A seed is a `pg_dump` of the content tables. It is how an instance gets its
content — and after the one-time ingest, the only way.

## Files

| File | Committed | Contents |
|---|---|---|
| `content.sql` | **No** | Full corpus. The entire licensed dataset. |
| `content-srd.sql` | Yes, eventually | SRD-only subset, for the public demo. |

`.gitignore` excludes everything in this directory by default and allowlists
individual files. That is deliberate: a rule that let seeds through by default
would leak the full corpus on the first careless `git add`.

## Usage

```bash
pnpm db:migrate            # schema comes from migrations, never from the seed
pnpm db:seed               # restore seed/content.sql
pnpm db:seed seed/x.sql    # restore a specific seed
```

## Producing a seed

Ingest runs once, ever. Once its output is verified:

```bash
pnpm ingest
pnpm db:dump               # -> seed/content.sql
```

The dump is data-only. Schema always comes from Drizzle migrations, so a seed
can never drift from the table definitions in `src/server/db/schema/`.

User tables (`users`, `user_entitlements`, `entitlement_syncs`,
`provider_source_map`) are excluded from dumps. A seed carries content; shipping
accounts or entitlements inside one would be very hard to notice after the fact.

## Producing the SRD seed

Not yet implemented. The plan is to strip the loaded database rather than
re-ingest, so the public seed is structurally identical to the full one:

```sql
DELETE FROM entities WHERE NOT is_srd;   -- cascades to every detail table
-- rebuild entity_links and search_index, then dump
```
