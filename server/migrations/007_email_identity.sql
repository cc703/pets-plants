-- Enforce one account per email so email can be a stable login identity.

USE pet_planet;

-- A single-column unique email index may already exist from full_schema.sql
-- or a previous partial run. Do not mistake a composite unique index such as
-- (email, status) for an email identity constraint.
SET @users_email_unique_exists := (
  SELECT COUNT(*) FROM (
    SELECT INDEX_NAME
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND NON_UNIQUE = 0
    GROUP BY INDEX_NAME
    HAVING COUNT(*) = 1 AND MAX(COLUMN_NAME = 'email') = 1
  ) AS single_column_email_indexes
);
SET @add_users_email_unique_sql := IF(
  @users_email_unique_exists = 0,
  'ALTER TABLE users ADD CONSTRAINT uk_users_email UNIQUE (email)',
  'SELECT 1'
);
PREPARE add_users_email_unique FROM @add_users_email_unique_sql;
EXECUTE add_users_email_unique;
DEALLOCATE PREPARE add_users_email_unique;
