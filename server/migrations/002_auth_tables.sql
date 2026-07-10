-- 002: Auth-related table extensions
-- Run after 001_initial_schema.sql

USE pet_planet;

-- =============================================
-- 1. Extend users table with auth & social fields
-- =============================================

-- Add password hash for authentication
ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NOT NULL AFTER username;

-- Add gender field
ALTER TABLE users ADD COLUMN gender ENUM('male', 'female', 'unknown') DEFAULT 'unknown';

-- Add birthday field
ALTER TABLE users ADD COLUMN birthday DATE;

-- Add city field
ALTER TABLE users ADD COLUMN city VARCHAR(50);

-- Add social stats (denormalized for performance)
ALTER TABLE users ADD COLUMN followers_count INT DEFAULT 0;
ALTER TABLE users ADD COLUMN following_count INT DEFAULT 0;
ALTER TABLE users ADD COLUMN posts_count INT DEFAULT 0;

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
