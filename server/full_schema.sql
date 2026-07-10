-- =============================================
-- 萌宠星球 - 完整数据库初始化脚本
-- 执行方式: mysql -u root -p < full_schema.sql
-- =============================================

CREATE DATABASE IF NOT EXISTS pet_planet DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pet_planet;

-- =============================================
-- 1. 品种表
-- =============================================
CREATE TABLE IF NOT EXISTS breeds (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL COMMENT '品种名称',
  name_en VARCHAR(100) COMMENT '英文名',
  species ENUM('cat', 'dog') NOT NULL COMMENT '物种',
  origin_country VARCHAR(50) COMMENT '起源地',
  history TEXT COMMENT '品种历史',
  appearance JSON COMMENT '外观特征',
  temperament JSON COMMENT '性格特征',
  care_info JSON COMMENT '养护信息',
  suitable_for JSON COMMENT '适合人群标签',
  fun_facts JSON COMMENT '趣味冷知识数组',
  image_url VARCHAR(500),
  gallery JSON COMMENT '图片集',
  popularity_rank INT DEFAULT 0 COMMENT '受欢迎程度排名',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_species (species),
  INDEX idx_popularity (popularity_rank)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='宠物品种表';

-- =============================================
-- 2. 用户表（含认证字段）
-- =============================================
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(100),
  avatar_url VARCHAR(500),
  nickname VARCHAR(50),
  bio VARCHAR(200),
  gender ENUM('male', 'female', 'unknown') DEFAULT 'unknown',
  birthday DATE,
  city VARCHAR(50),
  preferences JSON COMMENT '用户偏好设置',
  level INT DEFAULT 1,
  points INT DEFAULT 0,
  followers_count INT DEFAULT 0,
  following_count INT DEFAULT 0,
  posts_count INT DEFAULT 0,
  status ENUM('active', 'banned', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP,
  INDEX idx_username (username),
  INDEX idx_phone (phone),
  INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- =============================================
-- 3. 刷新Token表
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
-- 4. 短信验证码表
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

CREATE TABLE IF NOT EXISTS email_reset_tokens (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  email VARCHAR(100) NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_email (email),
  INDEX idx_user_used (user_id, is_used),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='邮箱密码重置Token表';

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  bucket_key VARCHAR(191) PRIMARY KEY,
  request_count INT NOT NULL DEFAULT 0,
  reset_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_reset_at (reset_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='接口限流桶表';

-- =============================================
-- 5. 虚拟宠物表
-- =============================================
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

-- =============================================
-- 6. 社区帖子表
-- =============================================
CREATE TABLE IF NOT EXISTS posts (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  breed_id VARCHAR(50),
  circle_id VARCHAR(36) COMMENT '所属圈子',
  title VARCHAR(200),
  content TEXT NOT NULL,
  images JSON,
  tags JSON,
  stats JSON COMMENT 'likesCount, commentsCount, viewsCount',
  likes_count INT DEFAULT 0,
  comments_count INT DEFAULT 0,
  views_count INT DEFAULT 0,
  is_pinned BOOLEAN DEFAULT FALSE,
  status ENUM('published', 'hidden', 'deleted') DEFAULT 'published',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_user (user_id),
  INDEX idx_created (created_at),
  INDEX idx_breed (breed_id),
  INDEX idx_circle (circle_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='社区帖子表';

-- =============================================
-- 7. 评论表
-- =============================================
CREATE TABLE IF NOT EXISTS comments (
  id VARCHAR(36) PRIMARY KEY,
  post_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  parent_id VARCHAR(36) COMMENT '父评论ID',
  reply_to_user_id VARCHAR(36) COMMENT '回复目标用户',
  content TEXT NOT NULL,
  likes_count INT DEFAULT 0,
  status ENUM('visible', 'hidden', 'deleted') DEFAULT 'visible',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_post (post_id),
  INDEX idx_parent (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='评论表';

-- =============================================
-- 8. 点赞表
-- =============================================
CREATE TABLE IF NOT EXISTS likes (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  target_type ENUM('post', 'comment') NOT NULL,
  target_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_target (user_id, target_type, target_id),
  INDEX idx_target (target_type, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='点赞表';

-- =============================================
-- 9. 收藏表
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
-- 10. 关注关系表
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
-- 11. 圈子表
-- =============================================
CREATE TABLE IF NOT EXISTS circles (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  emoji VARCHAR(10),
  color VARCHAR(20),
  creator_id VARCHAR(36),
  member_count INT DEFAULT 0,
  post_count INT DEFAULT 0,
  status ENUM('active', 'hidden', 'deleted') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='圈子表';

-- =============================================
-- 12. 圈子成员表
-- =============================================
CREATE TABLE IF NOT EXISTS circle_members (
  id VARCHAR(36) PRIMARY KEY,
  circle_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  role ENUM('member', 'admin', 'owner') DEFAULT 'member',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_circle_user (circle_id, user_id),
  FOREIGN KEY (circle_id) REFERENCES circles(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='圈子成员表';

-- =============================================
-- 13. 私信会话表
-- =============================================
CREATE TABLE IF NOT EXISTS conversations (
  id VARCHAR(36) PRIMARY KEY,
  user1_id VARCHAR(36) NOT NULL,
  user2_id VARCHAR(36) NOT NULL,
  last_message TEXT,
  last_message_type ENUM('text', 'image') DEFAULT 'text',
  last_message_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_users (user1_id, user2_id),
  FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user1 (user1_id),
  INDEX idx_user2 (user2_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='私信会话表';

-- =============================================
-- 14. 私信消息表
-- =============================================
CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR(36) PRIMARY KEY,
  conversation_id VARCHAR(36) NOT NULL,
  sender_id VARCHAR(36) NOT NULL,
  content TEXT NOT NULL,
  type ENUM('text', 'image') DEFAULT 'text',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id),
  INDEX idx_conversation (conversation_id),
  INDEX idx_sender (sender_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='私信消息表';

-- =============================================
-- 15. 通知表
-- =============================================
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL COMMENT '接收者',
  from_user_id VARCHAR(36) COMMENT '发送者',
  type ENUM('like', 'comment', 'follow', 'reply', 'system') NOT NULL,
  target_type VARCHAR(20) COMMENT 'post/comment/user',
  target_id VARCHAR(36) COMMENT '目标ID',
  content TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user_read (user_id, is_read),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='通知表';

-- =============================================
-- 16. 举报表
-- =============================================
CREATE TABLE IF NOT EXISTS reports (
  id VARCHAR(36) PRIMARY KEY,
  reporter_id VARCHAR(36) NOT NULL,
  target_type ENUM('post', 'comment', 'user') NOT NULL,
  target_id VARCHAR(36) NOT NULL,
  reason VARCHAR(50) NOT NULL,
  detail TEXT,
  status ENUM('pending', 'resolved', 'dismissed') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP,
  FOREIGN KEY (reporter_id) REFERENCES users(id),
  INDEX idx_target (target_type, target_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='举报表';

-- =============================================
-- 17. 知识答题表
-- =============================================
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

-- =============================================
-- 18. 答题记录表
-- =============================================
CREATE TABLE IF NOT EXISTS quiz_records (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  quiz_id VARCHAR(36) NOT NULL,
  is_correct BOOLEAN NOT NULL,
  time_spent INT COMMENT '答题耗时(秒)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id),
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='答题记录表';

-- =============================================
-- 19. 每日签到表
-- =============================================
CREATE TABLE IF NOT EXISTS check_ins (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  check_in_date DATE NOT NULL COMMENT '签到日期',
  streak INT DEFAULT 1 COMMENT '连续签到天数',
  points_earned INT DEFAULT 10 COMMENT '获得积分',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_date (user_id, check_in_date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_date (user_id, check_in_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='每日签到表';

-- =============================================
-- 20. 积分流水表
-- =============================================
CREATE TABLE IF NOT EXISTS points_history (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  amount INT NOT NULL COMMENT '积分变动(正数为获得，负数为消费)',
  type ENUM('check_in', 'quiz', 'post', 'comment', 'like_received', 'reward', 'purchase') NOT NULL COMMENT '积分来源',
  description VARCHAR(200) COMMENT '变动描述',
  related_id VARCHAR(36) COMMENT '关联ID(帖子/评论/答题等)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id),
  INDEX idx_type (type),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='积分流水表';
