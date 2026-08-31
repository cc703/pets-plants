USE pet_planet;

CREATE TABLE IF NOT EXISTS email_login_codes (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(100) NOT NULL,
  code_hash CHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  is_used BOOLEAN NOT NULL DEFAULT FALSE,
  used_at TIMESTAMP NULL,
  attempt_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_email_login_code_hash (code_hash),
  INDEX idx_email_login_code_lookup (email, is_used, expires_at),
  INDEX idx_email_login_code_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='邮箱验证码登录表';
