# Legacy Migration Rehearsal

- Date: 2026-08-25 11:21:05 +08:00
- Status: **PASS**
- Rehearsal database: pet_planet_migration_rehearsal
- Snapshot: D:\桌面\宠物星球\pet-planet\scripts\..\server\schema.sql
- Summary: Rehearsal completed successfully for pet_planet_migration_rehearsal. Snapshot imported once; migrations 002-010 executed twice.

## Step Log

| Step | Started | Exit code | Output |
| --- | --- | ---: | --- |
| reset rehearsal database | 2026-08-25T11:21:01.8294135+08:00 | 0 |  |
| create rehearsal database | 2026-08-25T11:21:01.9256551+08:00 | 0 |  |
| legacy snapshot import | 2026-08-25T11:21:02.0514364+08:00 | 0 |  |
| 002_auth_tables.sql pass 1 | 2026-08-25T11:21:02.4566926+08:00 | 0 |  |
| 003_community_tables.sql pass 1 | 2026-08-25T11:21:02.8993046+08:00 | 0 |  |
| 004_posts_stats_schema.sql pass 1 | 2026-08-25T11:21:03.1205025+08:00 | 0 | 1<br>1 |
| 005_email_reset_and_rate_limit.sql pass 1 | 2026-08-25T11:21:03.2749531+08:00 | 0 |  |
| 006_user_pets.sql pass 1 | 2026-08-25T11:21:03.5567918+08:00 | 0 |  |
| 007_email_identity.sql pass 1 | 2026-08-25T11:21:03.7318993+08:00 | 0 |  |
| 008_backfill_post_circle_ids.sql pass 1 | 2026-08-25T11:21:03.8941460+08:00 | 0 | 1<br>1 |
| 009_email_verification.sql pass 1 | 2026-08-25T11:21:04.1033792+08:00 | 0 |  |
| 010_email_login_codes.sql pass 1 | 2026-08-25T11:21:04.3279437+08:00 | 0 |  |
| 002_auth_tables.sql pass 2 | 2026-08-25T11:21:04.4962365+08:00 | 0 | 1<br>1<br>1<br>1<br>1<br>1<br>1<br>1<br>1<br>1<br>1<br>1<br>1<br>1 |
| 003_community_tables.sql pass 2 | 2026-08-25T11:21:04.6417837+08:00 | 0 | 1<br>1<br>1<br>1 |
| 004_posts_stats_schema.sql pass 2 | 2026-08-25T11:21:04.8230782+08:00 | 0 | 1<br>1 |
| 005_email_reset_and_rate_limit.sql pass 2 | 2026-08-25T11:21:04.9642562+08:00 | 0 |  |
| 006_user_pets.sql pass 2 | 2026-08-25T11:21:05.0960075+08:00 | 0 |  |
| 007_email_identity.sql pass 2 | 2026-08-25T11:21:05.2389433+08:00 | 0 | 1<br>1 |
| 008_backfill_post_circle_ids.sql pass 2 | 2026-08-25T11:21:05.3654604+08:00 | 0 | 1<br>1<br>1<br>1<br>1<br>1 |
| 009_email_verification.sql pass 2 | 2026-08-25T11:21:05.4949203+08:00 | 0 | 1<br>1 |
| 010_email_login_codes.sql pass 2 | 2026-08-25T11:21:05.6982943+08:00 | 0 |  |
| schema assertions | 2026-08-25T11:21:05.8209731+08:00 | 0 | CONCAT('posts.stats=', (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'posts' AND COLUMN_NAME = 'stats'))<br>posts.stats=1<br>CONCAT('posts.circle_id=', (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'posts' AND COLUMN_NAME = 'circle_id'))<br>posts.circle_id=1<br>CONCAT('posts.circle_id_index=', (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'posts' AND COLUMN_NAME = 'circle_id' AND SEQ_IN_INDEX = 1))<br>posts.circle_id_index=1<br>CONCAT('user_pets=', (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_pets'))<br>user_pets=1<br>CONCAT('users.email_unique=', (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'email' AND NON_UNIQUE = 0))<br>users.email_unique=1<br>CONCAT('users.email_verified_at=', (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'email_verified_at'))<br>users.email_verified_at=1<br>CONCAT('email_verification_tokens=', (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_verification_tokens'))<br>email_verification_tokens=1<br>CONCAT('email_login_codes=', (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_login_codes'))<br>email_login_codes=1<br>CONCAT('comments.parent_id_index=', (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'comments' AND COLUMN_NAME = 'parent_id' AND NON_UNIQUE = 1))<br>comments.parent_id_index=1 |

## Recovery

If a rehearsal step fails, do not continue against a deployment database. Preserve the error output, rebuild this explicitly scoped rehearsal database from the legacy snapshot, fix the failed migration, and rerun both passes.

The script only permits database names beginning with `pet_planet_migration_rehearsal`; it never drops an arbitrary database. `-Reset` is required to recreate an existing rehearsal database.
