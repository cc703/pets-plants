USE pet_planet;

SET @email_verified_at_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'email_verified_at'
);
SET @add_email_verified_at_sql := IF(
  @email_verified_at_exists = 0,
  'ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMP NULL',
  'SELECT 1'
);
PREPARE add_email_verified_at FROM @add_email_verified_at_sql;
EXECUTE add_email_verified_at;
DEALLOCATE PREPARE add_email_verified_at;

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  email VARCHAR(100) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  purpose ENUM('activation', 'verification') NOT NULL DEFAULT 'activation',
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_email_verification_token_hash (token_hash),
  INDEX idx_email_verification_user (user_id, purpose, used_at),
  INDEX idx_email_verification_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='邮箱验证Token表';
