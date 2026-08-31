-- 003: Community feature tables
-- Run after 002_auth_tables.sql

USE pet_planet;

-- =============================================
-- 1. Bookmarks (favorites) table
-- =============================================
CREATE TABLE IF NOT EXISTS bookmarks (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  post_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uk_user_post (user_id, post_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='收藏表';

-- =============================================
-- 2. Follows table (user relationships)
-- =============================================
CREATE TABLE IF NOT EXISTS follows (
  id VARCHAR(36) PRIMARY KEY,
  follower_id VARCHAR(36) NOT NULL COMMENT '关注者',
  following_id VARCHAR(36) NOT NULL COMMENT '被关注者',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uk_follow (follower_id, following_id),
  FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_follower (follower_id),
  INDEX idx_following (following_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='关注关系表';

-- =============================================
-- 3. Add reply_to_user_id to comments table
-- =============================================
SET @comments_reply_to_user_id_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'comments'
    AND COLUMN_NAME = 'reply_to_user_id'
);
SET @add_comments_reply_to_user_id_sql := IF(
  @comments_reply_to_user_id_exists = 0,
  'ALTER TABLE comments ADD COLUMN reply_to_user_id VARCHAR(36) AFTER parent_id',
  'SELECT 1'
);
PREPARE add_comments_reply_to_user_id FROM @add_comments_reply_to_user_id_sql;
EXECUTE add_comments_reply_to_user_id;
DEALLOCATE PREPARE add_comments_reply_to_user_id;

-- Older full schemas used idx_parent. Reuse any existing parent_id index and
-- only create the named index when no usable parent index exists.
SET @comments_parent_index_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'comments'
    AND COLUMN_NAME = 'parent_id'
    AND SEQ_IN_INDEX = 1
    AND NON_UNIQUE = 1
);
SET @add_comments_parent_index_sql := IF(
  @comments_parent_index_exists = 0,
  'ALTER TABLE comments ADD INDEX idx_comments_parent (parent_id)',
  'SELECT 1'
);
PREPARE add_comments_parent_index FROM @add_comments_parent_index_sql;
EXECUTE add_comments_parent_index;
DEALLOCATE PREPARE add_comments_parent_index;
