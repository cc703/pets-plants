-- 002: Auth-related table extensions
-- Run after 001_initial_schema.sql

USE pet_planet;

-- =============================================
-- 1. Extend users table with auth & social fields
-- =============================================

-- MySQL has no portable ALTER TABLE ADD COLUMN IF NOT EXISTS syntax across
-- the versions supported by this project. Keep each conditional DDL explicit
-- so the migration can be safely replayed on a partially upgraded database.

SET @users_password_hash_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'password_hash'
);
SET @add_users_password_hash_sql := IF(
  @users_password_hash_exists = 0,
  "ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NULL AFTER username",
  'SELECT 1'
);
PREPARE add_users_password_hash FROM @add_users_password_hash_sql;
EXECUTE add_users_password_hash;
DEALLOCATE PREPARE add_users_password_hash;

SET @users_password_hash_nullable := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'password_hash'
    AND IS_NULLABLE = 'YES'
);
SET @make_users_password_hash_nullable_sql := IF(
  @users_password_hash_exists = 1 AND @users_password_hash_nullable = 0,
  'ALTER TABLE users MODIFY COLUMN password_hash VARCHAR(255) NULL',
  'SELECT 1'
);
PREPARE make_users_password_hash_nullable FROM @make_users_password_hash_nullable_sql;
EXECUTE make_users_password_hash_nullable;
DEALLOCATE PREPARE make_users_password_hash_nullable;

SET @users_gender_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'gender'
);
SET @add_users_gender_sql := IF(
  @users_gender_exists = 0,
  "ALTER TABLE users ADD COLUMN gender ENUM('male', 'female', 'unknown') DEFAULT 'unknown'",
  'SELECT 1'
);
PREPARE add_users_gender FROM @add_users_gender_sql;
EXECUTE add_users_gender;
DEALLOCATE PREPARE add_users_gender;

SET @users_birthday_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'birthday'
);
SET @add_users_birthday_sql := IF(
  @users_birthday_exists = 0,
  'ALTER TABLE users ADD COLUMN birthday DATE',
  'SELECT 1'
);
PREPARE add_users_birthday FROM @add_users_birthday_sql;
EXECUTE add_users_birthday;
DEALLOCATE PREPARE add_users_birthday;

SET @users_city_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'city'
);
SET @add_users_city_sql := IF(
  @users_city_exists = 0,
  'ALTER TABLE users ADD COLUMN city VARCHAR(50)',
  'SELECT 1'
);
PREPARE add_users_city FROM @add_users_city_sql;
EXECUTE add_users_city;
DEALLOCATE PREPARE add_users_city;

SET @users_followers_count_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'followers_count'
);
SET @add_users_followers_count_sql := IF(
  @users_followers_count_exists = 0,
  'ALTER TABLE users ADD COLUMN followers_count INT DEFAULT 0',
  'SELECT 1'
);
PREPARE add_users_followers_count FROM @add_users_followers_count_sql;
EXECUTE add_users_followers_count;
DEALLOCATE PREPARE add_users_followers_count;

SET @users_following_count_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'following_count'
);
SET @add_users_following_count_sql := IF(
  @users_following_count_exists = 0,
  'ALTER TABLE users ADD COLUMN following_count INT DEFAULT 0',
  'SELECT 1'
);
PREPARE add_users_following_count FROM @add_users_following_count_sql;
EXECUTE add_users_following_count;
DEALLOCATE PREPARE add_users_following_count;

SET @users_posts_count_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'posts_count'
);
SET @add_users_posts_count_sql := IF(
  @users_posts_count_exists = 0,
  'ALTER TABLE users ADD COLUMN posts_count INT DEFAULT 0',
  'SELECT 1'
);
PREPARE add_users_posts_count FROM @add_users_posts_count_sql;
EXECUTE add_users_posts_count;
DEALLOCATE PREPARE add_users_posts_count;

-- =============================================
-- 2. Refresh token table (for JWT refresh flow)
-- =============================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  token VARCHAR(500) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id),
  INDEX idx_token (token(100)),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='刷新Token表';

-- =============================================
-- 3. SMS verification code table
-- =============================================
CREATE TABLE IF NOT EXISTS sms_codes (
  id VARCHAR(36) PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  code VARCHAR(6) NOT NULL,
  type ENUM('register', 'login', 'reset_password') NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_phone_type (phone, type),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='短信验证码表';
