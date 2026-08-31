-- Add real user-owned primary pet profiles, separate from virtual_pets.

USE pet_planet;

CREATE TABLE IF NOT EXISTS user_pets (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  breed_id VARCHAR(50) NOT NULL,
  name VARCHAR(50) NOT NULL,
  birthday DATE NULL,
  sex ENUM('male', 'female', 'unknown') NOT NULL DEFAULT 'unknown',
  avatar_url VARCHAR(500) NULL,
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_pets_user (user_id),
  INDEX idx_user_pets_breed (breed_id),
  CONSTRAINT fk_user_pets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_pets_breed FOREIGN KEY (breed_id) REFERENCES breeds(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='真实主宠档案表';
