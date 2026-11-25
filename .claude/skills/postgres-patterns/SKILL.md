---
name: postgres-patterns
description: Postgres schema and query rules for tender-chat-v1 on Neon with Drizzle 1.0 RC - column types (uuid ids, text, timestamptz, numeric money), indexes (composite order, partial, foreign keys, GIN), unique constraints, onConflictDoUpdate upserts, cursor pagination, the drizzle-kit generate/migrate workflow and Neon branch safety. Use when adding a table or column, writing a migration, choosing an index, paginating a list, or a query is slow.
---

# Postgres patterns (tender-chat-v1)

Status: **planned, not built yet.** `db/schema.ts` is empty, and there is no `drizzle.config.ts`, no migrations folder and no `db:*` scripts. Plan 01 step 2 adds `drizzle.config.ts` (root) plus the `db:generate`/`db:migrate` scripts, and step 5 adds the `users` and `refresh_tokens` schema in `src/backend/database/` (`.claude/plans/01-auth.md:27-30,78,81`). Once they exist, cite `path:line` here.

This skill covers **schema, indexes and migrations**. Repository classes, owner filters, `inArray` batching and `db.transaction` belong in `backend-patterns`; don't repeat them here.

## Types (Drizzle `pg-core` → Postgres)

| Use | Drizzle | Postgres | Avoid |
| --- | --- | --- | --- |
| Primary keys | `uuid("id").primaryKey().defaultRandom()` | `uuid default gen_random_uuid()` | `serial`, `int` ids (guessable, and the plan uses uuid) |
| Id the app makes first (refresh `jti`) | `uuid("id").primaryKey()`, value from `crypto.randomUUID()` | `uuid` | |
| Foreign keys | `uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" })` | `uuid` + FK | `text` ids |
| Strings | `text("full_name")` | `text` | `varchar(255)` |
| Times | `timestamp("created_at", { withTimezone: true }).notNull().defaultNow()` | `timestamptz` | `timestamp` without zone |
| `updated_at` | add `.$onUpdate(() => new Date())` | set by Drizzle on update | DB triggers |
| Money / prices / quantities | `numeric("amount", { precision: 14, scale: 2 })` (default mode `string`) | `numeric(14,2)` | `real`/`double`, `mode: "number"` for money |
| Flags | `boolean("is_x").notNull().default(false)` | `boolean` | `int`/`text` flags |
| Fixed choices (`password`/`google`/`github`) | `pgEnum` or `text` + check | | magic numbers |
| Free-form structured data | `jsonb("data")` | `jsonb` | `json`, stringified text |

- Write explicit snake_case column names (`uuid("user_id")`); there's no global `casing` config.
- Money stays a decimal **string** end to end. Don't do float math on it in JS.
- Nullable means "really unknown". Default to `.notNull()`.

## Tables, constraints and indexes

Drizzle RC: the third `pgTable` argument returns an **array**.

```ts
export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey(),                       // = JWT jti
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  familyId: uuid("family_id").notNull(),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  replacedBy: uuid("replaced_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("refresh_tokens_user_id_idx").on(t.userId),          // FKs are NOT auto-indexed in Postgres
  index("refresh_tokens_family_id_idx").on(t.familyId),
]);

// users: unique email, and one account per (method, provider id)
(t) => [
  uniqueIndex("users_email_key").on(t.email),               // email is lowercased in the zod contract
  uniqueIndex("users_provider_key").on(t.signInMethod, t.providerAccountId),
]
```

- **Index every foreign key** you filter or join on (`user_id`, `tender_id`, …). Postgres indexes only primary keys and unique constraints automatically.
- **Composite order: equality first, then range or sort.** `index().on(t.userId, t.createdAt.desc())` serves `WHERE user_id = ? ORDER BY created_at DESC`, but not a query on `created_at` alone.
- **Partial index** when queries only touch a subset: `index("refresh_tokens_family_active_idx").on(t.familyId).where(sql\`${t.revokedAt} is null\`)`. That's smaller and faster, but only used when the query repeats the same `WHERE`.
- **Unique + nullable:** Postgres treats NULLs as distinct, so many password users with a null `provider_account_id` don't clash in `users_provider_key`.
- **GIN** only when a later spec queries inside `jsonb` (`@>`) or uses full-text search: `index("x_data_gin").using("gin", t.data)`.
- **Covering index (`INCLUDE`)**: the Drizzle builder has no `include()`. If `EXPLAIN` proves you need one, write it in a custom migration (`drizzle-kit generate --custom --name <name>`).
- Name every index and constraint yourself (`<table>_<cols>_idx`, `<table>_<cols>_key`) so migrations and errors are readable.
- Don't add an index "just in case". Each one slows writes; add it for a real query.

## Upsert

```ts
await db.insert(tenderValues)
  .values({ tenderId, key, value })
  .onConflictDoUpdate({
    target: [tenderValues.tenderId, tenderValues.key],      // needs a unique index on exactly these columns
    set: { value: sql`excluded.value`, updatedAt: new Date() },
  });
```

`excluded` is the row that failed to insert. `targetWhere` matches a partial unique index, and `setWhere` updates only when a condition holds. Use `onConflictDoNothing()` to ignore duplicates. Signup must **not** upsert users: an existing email is a `ConflictError`, and OAuth never links accounts.

## Cursor pagination (tender lists, later)

```ts
// index("tenders_user_created_idx").on(t.userId, t.createdAt.desc(), t.id.desc())
const rows = await db.select({ id: tenders.id, title: tenders.title, createdAt: tenders.createdAt })
  .from(tenders)
  .where(and(
    eq(tenders.userId, userId),
    cursor ? sql`(${tenders.createdAt}, ${tenders.id}) < (${cursor.createdAt}, ${cursor.id})` : undefined,
  ))
  .orderBy(desc(tenders.createdAt), desc(tenders.id))
  .limit(pageSize + 1);                                     // the extra row tells you whether there's a next page
```

- `id` breaks ties so rows with the same timestamp aren't skipped. The cursor is the last row's `{ createdAt, id }`.
- Don't use `OFFSET` on growing lists: it reads and throws away every skipped row.

## Migration workflow (Neon)

1. Edit the schema in `src/backend/database/`.
2. Preview: `pnpm drizzle-kit generate --explain` (dry run, prints the SQL).
3. Generate: `pnpm drizzle-kit generate --name <what-changed>` (or `pnpm db:generate` once the script exists). Read the SQL it wrote.
4. Migrate the **Neon `dev` branch only**: `pnpm drizzle-kit migrate` (`db:migrate`), and ask the owner first (it's in the `ask` list).
5. Prod (`main` branch) is migrated from the owner's machine, **only after an explicit yes for that migration**, never in the Vercel build. Before a risky change, create a Neon branch from `main` as a backup.

- **Never hand-edit a generated migration.** If it's wrong, fix the schema and generate again; custom SQL gets its own `--custom` file.
- Never run `drizzle-kit push`, `DROP`, `TRUNCATE` or `DELETE` without a `WHERE`, on any branch, without the owner's yes.
- Renames: drizzle-kit may ask "rename or drop and create?". Pick rename, or you lose the data.
- Adding a `.notNull()` column to a table that has rows needs a `.default(...)`, or a two-step migration.
- If `migrate` fails over the pooled (`-pooler`) URL, run it with Neon's direct host for that branch. Don't change the app's pooled URL.

## Read-only diagnostics (Neon SQL editor, `dev` branch)

```sql
-- Plan + timing. ANALYZE really runs the query, so only use it on SELECTs.
EXPLAIN (ANALYZE, BUFFERS) SELECT ... ;      -- look for "Seq Scan" on big tables and rows-estimate gaps

-- Foreign keys with no index whose first column is the FK column
SELECT c.conrelid::regclass AS table_name, a.attname AS column_name
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
WHERE c.contype = 'f'
  AND NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = c.conrelid AND i.indkey[0] = c.conkey[1]);

-- Index usage (idx_scan = 0 after real traffic means it's probably unused)
SELECT relname, indexrelname, idx_scan FROM pg_stat_user_indexes ORDER BY idx_scan;
```

To see the SQL Drizzle sends, call `.toSQL()` on a query builder.

## Not in this project

- No Supabase (RLS policies, `auth.uid()`): ownership is enforced in repositories with `eq(t.userId, userId)`.
- No server tuning (`ALTER SYSTEM`, `pg_reload_conf()`, `max_connections`): Neon manages the compute, and the app uses a small `pg` pool (max 3).
- No job queues (`FOR UPDATE SKIP LOCKED`).
- No Prisma, raw `pg` queries outside the `Database` class, or `drizzle-kit push`.
- No hand-edited migrations.
