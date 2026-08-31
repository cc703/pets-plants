-- Align posts schema with the current API contract.
-- Safe to run on databases initialized from older full_schema.sql versions.
USE pet_planet;

SET @posts_stats_column_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'posts'
    AND COLUMN_NAME = 'stats'
);
SET @add_posts_stats_sql := IF(
  @posts_stats_column_exists = 0,
  "ALTER TABLE posts ADD COLUMN stats JSON COMMENT 'likesCount, commentsCount, viewsCount' AFTER tags",
  'SELECT 1'
);
PREPARE add_posts_stats FROM @add_posts_stats_sql;
EXECUTE add_posts_stats;
DEALLOCATE PREPARE add_posts_stats;

-- Older snapshots may not have the denormalized counter columns yet. Build
-- the backfill statement from the columns that actually exist.
SET @posts_likes_count_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'posts'
    AND COLUMN_NAME = 'likes_count'
);
SET @posts_comments_count_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'posts'
    AND COLUMN_NAME = 'comments_count'
);
SET @posts_views_count_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'posts'
    AND COLUMN_NAME = 'views_count'
);
SET @posts_likes_expr := IF(@posts_likes_count_exists = 1, 'COALESCE(likes_count, 0)', '0');
SET @posts_comments_expr := IF(@posts_comments_count_exists = 1, 'COALESCE(comments_count, 0)', '0');
SET @posts_views_expr := IF(@posts_views_count_exists = 1, 'COALESCE(views_count, 0)', '0');
SET @backfill_posts_stats_sql := CONCAT(
  'UPDATE posts SET stats = JSON_OBJECT(',
  QUOTE('likesCount'), ', ', @posts_likes_expr, ', ',
  QUOTE('commentsCount'), ', ', @posts_comments_expr, ', ',
  QUOTE('viewsCount'), ', ', @posts_views_expr,
  ') WHERE stats IS NULL'
);
PREPARE backfill_posts_stats FROM @backfill_posts_stats_sql;
EXECUTE backfill_posts_stats;
DEALLOCATE PREPARE backfill_posts_stats;
