# Database Migration Paths

This repository has two supported database initialization paths. Choose one
path for a database; do not mix the fresh-schema path with the legacy
incremental path.

## Fresh database

Use this path when `pet_planet` does not contain application tables:

```powershell
mysql -u root -p < server/full_schema.sql
node server/seed.js
```

`full_schema.sql` is the complete current schema. Do not run migrations
`002` through `010` after it, because those scripts are for an existing legacy
database and may repeat objects already present in the full schema.

## Existing legacy database

Take a backup or clone first, then execute the incremental migrations in this
order:

```text
002_auth_tables.sql
003_community_tables.sql
004_posts_stats_schema.sql
005_email_reset_and_rate_limit.sql
006_user_pets.sql
007_email_identity.sql
008_backfill_post_circle_ids.sql
009_email_verification.sql
010_email_login_codes.sql
```

`001_initial_schema.sql` is a historical tracking marker. It documents the
original base schema and is not an executable replacement for
`full_schema.sql`; do not replay it on a database initialized by
`full_schema.sql`.

Every incremental migration is intended to be replayable. Run one migration
at a time, record the migration name and output, and stop at the first error.
The application does not run migrations implicitly at startup.

## Object ownership

| Object | Final fields or indexes | Source |
| --- | --- | --- |
| `users` | auth/profile fields, email verification timestamp, phone/email indexes, `uk_users_email` | `full_schema.sql`, `002`, `007`, `009` |
| `refresh_tokens` | token, expiry, user and token indexes | `full_schema.sql` or `002` |
| `posts` | `stats`, `circle_id`, stats/circle indexes | `full_schema.sql`, `004`, `008` |
| `comments` | `reply_to_user_id`, `parent_id` index | `full_schema.sql` or `003` |
| `bookmarks`, `follows` | relationship uniqueness and user indexes | `full_schema.sql` or `003` |
| `user_pets` | one primary pet per user and breed index | `full_schema.sql` or `006` |
| `email_reset_tokens`, `rate_limit_buckets` | reset and rate-limit state | `full_schema.sql` or `005` |
| `email_verification_tokens`, `email_login_codes` | activation links and one-time email login codes | `full_schema.sql` or `009`, `010` |
| `circles`, `circle_members` | circle membership and counts | `full_schema.sql` |
| `notifications`, `check_ins`, `points_history` | notification, check-in and points records | `full_schema.sql` |

## Failure and recovery

If a migration fails:

1. Record the migration filename, SQL error, database name and timestamp.
2. Do not continue with later migrations.
3. Restore the clone from its backup, or fix the failed script and resume from
   that migration after reviewing the partial DDL.
4. Re-run the complete sequence on a fresh clone before touching a deployment
   database.

DDL is not treated as an application transaction. Recovery is therefore
backup/clone based; there is no automatic rollback script.
