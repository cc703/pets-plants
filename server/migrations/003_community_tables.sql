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
ALTER TABLE comments ADD COLUMN reply_to_user_id VARCHAR(36) AFTER parent_id;
ALTER TABLE comments ADD INDEX idx_parent (parent_id);
