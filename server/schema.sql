-- 萌宠星球数据库初始化脚本
CREATE DATABASE IF NOT EXISTS pet_planet DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pet_planet;

-- 品种表
CREATE TABLE IF NOT EXISTS breeds (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL COMMENT '品种名称',
  name_en VARCHAR(100) COMMENT '英文名',
  species ENUM('cat', 'dog') NOT NULL COMMENT '物种',
  origin_country VARCHAR(50) COMMENT '起源地',
  history TEXT COMMENT '品种历史',

  -- 外观特征 (JSON)
  appearance JSON COMMENT '外观特征',

  -- 性格特征 (JSON)
  temperament JSON COMMENT '性格特征',

  -- 养护信息 (JSON)
  care_info JSON COMMENT '养护信息',

  -- 适合人群
  suitable_for JSON COMMENT '适合人群标签',

  -- 趣味冷知识
  fun_facts JSON COMMENT '趣味冷知识数组',

  -- 图片
  image_url VARCHAR(500),
  gallery JSON COMMENT '图片集',

  -- 排名
  popularity_rank INT DEFAULT 0 COMMENT '受欢迎程度排名',

  -- 时间戳
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_species (species),
  INDEX idx_popularity (popularity_rank)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='宠物品种表';

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(100),
  avatar_url VARCHAR(500),
  nickname VARCHAR(50),
  bio VARCHAR(200),
  preferences JSON COMMENT '用户偏好设置',
  level INT DEFAULT 1,
  points INT DEFAULT 0,
  status ENUM('active', 'banned', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP,

  INDEX idx_username (username),
  INDEX idx_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- 虚拟宠物表
CREATE TABLE IF NOT EXISTS virtual_pets (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  breed_id VARCHAR(50) NOT NULL,
  name VARCHAR(50) COMMENT '宠物昵称',
  avatar VARCHAR(500),
  stats JSON COMMENT '状态值: health, happiness, hunger, energy, cleanliness',
  growth JSON COMMENT '成长信息: stage, level, experience',
  last_interaction_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (breed_id) REFERENCES breeds(id),
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='虚拟宠物表';

-- 社区帖子表
CREATE TABLE IF NOT EXISTS posts (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  breed_id VARCHAR(50),
  title VARCHAR(200),
  content TEXT NOT NULL,
  images JSON,
  tags JSON,
  stats JSON COMMENT 'likes_count, comments_count, views_count',
  is_pinned BOOLEAN DEFAULT FALSE,
  status ENUM('published', 'hidden', 'deleted') DEFAULT 'published',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_user (user_id),
  INDEX idx_created (created_at),
  INDEX idx_breed (breed_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='社区帖子表';

-- 评论表
CREATE TABLE IF NOT EXISTS comments (
  id VARCHAR(36) PRIMARY KEY,
  post_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  parent_id VARCHAR(36) COMMENT '父评论ID',
  content TEXT NOT NULL,
  likes_count INT DEFAULT 0,
  status ENUM('visible', 'hidden', 'deleted') DEFAULT 'visible',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_post (post_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='评论表';

-- 点赞表
CREATE TABLE IF NOT EXISTS likes (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  target_type ENUM('post', 'comment') NOT NULL,
  target_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uk_user_target (user_id, target_type, target_id),
  INDEX idx_target (target_type, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='点赞表';

-- 知识答题表
CREATE TABLE IF NOT EXISTS quizzes (
  id VARCHAR(36) PRIMARY KEY,
  breed_id VARCHAR(50),
  category ENUM('品种识别', '健康护理', '行为训练', '趣味冷知识') NOT NULL,
  difficulty ENUM('简单', '中等', '困难') DEFAULT '中等',
  question_type ENUM('单选', '多选', '判断') DEFAULT '单选',
  question JSON NOT NULL COMMENT '题目内容',
  answer JSON NOT NULL COMMENT '答案和解析',
  points_reward INT DEFAULT 10,
  status ENUM('active', 'disabled') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_category (category),
  INDEX idx_breed (breed_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='知识答题表';
