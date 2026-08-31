-- Add the first-class circle relation before backfilling legacy posts. Older
-- databases initialized from schema.sql do not have this column yet.
USE pet_planet;

SET @posts_circle_column_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'posts'
    AND COLUMN_NAME = 'circle_id'
);
SET @add_posts_circle_sql := IF(
  @posts_circle_column_exists = 0,
  "ALTER TABLE posts ADD COLUMN circle_id VARCHAR(36) COMMENT '所属圈子' AFTER breed_id",
  'SELECT 1'
);
PREPARE add_posts_circle FROM @add_posts_circle_sql;
EXECUTE add_posts_circle;
DEALLOCATE PREPARE add_posts_circle;

SET @posts_circle_index_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'posts'
    AND COLUMN_NAME = 'circle_id'
    AND SEQ_IN_INDEX = 1
);
SET @add_posts_circle_index_sql := IF(
  @posts_circle_index_exists = 0,
  'ALTER TABLE posts ADD INDEX idx_circle (circle_id)',
  'SELECT 1'
);
PREPARE add_posts_circle_index FROM @add_posts_circle_index_sql;
EXECUTE add_posts_circle_index;
DEALLOCATE PREPARE add_posts_circle_index;

-- Backfill only when the legacy database already has circles. The historical
-- schema.sql snapshot predates circles, so its migration must remain valid.
SET @circles_table_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'circles'
    AND TABLE_TYPE = 'BASE TABLE'
);
SET @backfill_posts_circle_sql := IF(
  @circles_table_exists = 1,
  'UPDATE posts p JOIN circles c ON c.status = ''active'' AND JSON_SEARCH(p.tags, ''one'', c.name) IS NOT NULL SET p.circle_id = c.id WHERE p.status = ''published'' AND p.circle_id IS NULL',
  'SELECT 1'
);
PREPARE backfill_posts_circle FROM @backfill_posts_circle_sql;
EXECUTE backfill_posts_circle;
DEALLOCATE PREPARE backfill_posts_circle;
