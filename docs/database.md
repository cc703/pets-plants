# 萌宠星球 - 数据库设计文档

数据库：MySQL 8.0+ | 字符集：utf8mb4 | 排序规则：utf8mb4_unicode_ci

---

## 目录

1. [ER 关系概览](#1-er-关系概览)
2. [用户与认证](#2-用户与认证)
3. [品种数据](#3-品种数据)
4. [虚拟宠物](#4-虚拟宠物)
5. [社区互动](#5-社区互动)
6. [私信系统](#6-私信系统)
7. [积分与签到](#7-积分与签到)
8. [答题系统](#8-答题系统)
9. [通知与举报](#9-通知与举报)
10. [部署指南](#10-部署指南)

---

## 1. ER 关系概览

```
users ─┬─< virtual_pets >── breeds
       ├─< posts >──┬─< comments
       │            ├─< likes
       │            └─< bookmarks
       ├─< follows (follower / following)
       ├─< conversations >──< messages
       ├─< notifications
       ├─< check_ins
       ├─< points_history
       ├─< quiz_records
       ├─< reports
       └─< circle_members >── circles
```

---

## 2. 用户与认证

### 2.1 users - 用户表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | VARCHAR(36) | PK | UUID 主键 |
| username | VARCHAR(50) | UNIQUE, NOT NULL | 登录用户名 |
| password_hash | VARCHAR(255) | NOT NULL | bcrypt 密码哈希 |
| phone | VARCHAR(20) | | 手机号 |
| email | VARCHAR(100) | | 邮箱 |
| avatar_url | VARCHAR(500) | | 头像地址 |
| nickname | VARCHAR(50) | | 显示昵称 |
| bio | VARCHAR(200) | | 个人简介 |
| gender | ENUM | DEFAULT 'unknown' | male/female/unknown |
| birthday | DATE | | 生日 |
| city | VARCHAR(50) | | 城市 |
| preferences | JSON | | 用户偏好设置 |
| level | INT | DEFAULT 1 | 等级 |
| points | INT | DEFAULT 0 | 积分余额 |
| followers_count | INT | DEFAULT 0 | 粉丝数 |
| following_count | INT | DEFAULT 0 | 关注数 |
| posts_count | INT | DEFAULT 0 | 帖子数 |
| status | ENUM | DEFAULT 'active' | active/banned/inactive |
| created_at | TIMESTAMP | DEFAULT NOW() | 注册时间 |
| last_login_at | TIMESTAMP | | 最后登录 |

**索引：** username(UNIQUE), phone, email

### 2.2 refresh_tokens - 刷新令牌表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | VARCHAR(36) | PK | UUID |
| user_id | VARCHAR(36) | FK → users.id, CASCADE | 用户ID |
| token | VARCHAR(500) | NOT NULL | JWT Refresh Token |
| expires_at | TIMESTAMP | NOT NULL | 过期时间 |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |

**索引：** user_id, token(前缀100), expires_at

### 2.3 sms_codes - 短信验证码表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | VARCHAR(36) | PK | UUID |
| phone | VARCHAR(20) | NOT NULL | 手机号 |
| code | VARCHAR(6) | NOT NULL | 6位验证码 |
| type | ENUM | NOT NULL | register/login/reset_password |
| is_used | BOOLEAN | DEFAULT FALSE | 是否已使用 |
| expires_at | TIMESTAMP | NOT NULL | 过期时间 |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |

**索引：** (phone, type), expires_at

---

## 3. 品种数据

### 3.1 breeds - 品种表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | VARCHAR(50) | PK | 品种标识（如 ragdoll） |
| name | VARCHAR(100) | NOT NULL | 中文名 |
| name_en | VARCHAR(100) | | 英文名 |
| species | ENUM | NOT NULL | cat/dog |
| origin_country | VARCHAR(50) | | 起源国家 |
| history | TEXT | | 品种历史 |
| appearance | JSON | | 外观特征 |
| temperament | JSON | | 性格特征 |
| care_info | JSON | | 养护信息 |
| suitable_for | JSON | | 适合人群标签 |
| fun_facts | JSON | | 趣味冷知识 |
| image_url | VARCHAR(500) | | 主图URL |
| gallery | JSON | | 图片集 |
| popularity_rank | INT | DEFAULT 0 | 受欢迎排名 |
| created_at | TIMESTAMP | DEFAULT NOW() | |
| updated_at | TIMESTAMP | ON UPDATE NOW() | |

**索引：** species, popularity_rank

---

## 4. 虚拟宠物

### 4.1 virtual_pets - 虚拟宠物表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | VARCHAR(36) | PK | UUID |
| user_id | VARCHAR(36) | FK → users.id | 主人ID |
| breed_id | VARCHAR(50) | FK → breeds.id | 品种ID |
| name | VARCHAR(50) | | 宠物昵称 |
| avatar | VARCHAR(500) | | 宠物头像 |
| stats | JSON | | {health, happiness, hunger, energy, cleanliness} |
| growth | JSON | | {stage, level, experience} |
| last_interaction_at | TIMESTAMP | | 最后互动时间 |
| created_at | TIMESTAMP | DEFAULT NOW() | 领养时间 |

**索引：** user_id

---

## 5. 社区互动

### 5.1 posts - 帖子表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | VARCHAR(36) | PK | UUID |
| user_id | VARCHAR(36) | FK → users.id | 作者ID |
| breed_id | VARCHAR(50) | FK → breeds.id | 关联品种 |
| circle_id | VARCHAR(36) | | 所属圈子 |
| title | VARCHAR(200) | | 标题 |
| content | TEXT | NOT NULL | 正文 |
| images | JSON | | 图片数组 |
| tags | JSON | | 标签数组 |
| likes_count | INT | DEFAULT 0 | 点赞数 |
| comments_count | INT | DEFAULT 0 | 评论数 |
| views_count | INT | DEFAULT 0 | 浏览数 |
| is_pinned | BOOLEAN | DEFAULT FALSE | 是否置顶 |
| status | ENUM | DEFAULT 'published' | published/hidden/deleted |
| created_at | TIMESTAMP | DEFAULT NOW() | |
| updated_at | TIMESTAMP | ON UPDATE NOW() | |

**索引：** user_id, created_at, breed_id, circle_id

### 5.2 comments - 评论表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | VARCHAR(36) | PK | UUID |
| post_id | VARCHAR(36) | FK → posts.id | 帖子ID |
| user_id | VARCHAR(36) | FK → users.id | 评论者ID |
| parent_id | VARCHAR(36) | | 父评论ID（二级回复） |
| reply_to_user_id | VARCHAR(36) | | 回复目标用户 |
| content | TEXT | NOT NULL | 评论内容 |
| likes_count | INT | DEFAULT 0 | 点赞数 |
| status | ENUM | DEFAULT 'visible' | visible/hidden/deleted |
| created_at | TIMESTAMP | DEFAULT NOW() | |

**索引：** post_id, parent_id

### 5.3 likes - 点赞表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | VARCHAR(36) | PK | UUID |
| user_id | VARCHAR(36) | FK → users.id | 点赞者 |
| target_type | ENUM | NOT NULL | post/comment |
| target_id | VARCHAR(36) | NOT NULL | 目标ID |
| created_at | TIMESTAMP | DEFAULT NOW() | |

**唯一约束：** (user_id, target_type, target_id)

### 5.4 bookmarks - 收藏表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | VARCHAR(36) | PK | UUID |
| user_id | VARCHAR(36) | FK → users.id, CASCADE | 收藏者 |
| post_id | VARCHAR(36) | FK → posts.id, CASCADE | 帖子ID |
| created_at | TIMESTAMP | DEFAULT NOW() | |

**唯一约束：** (user_id, post_id)

### 5.5 follows - 关注关系表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | VARCHAR(36) | PK | UUID |
| follower_id | VARCHAR(36) | FK → users.id, CASCADE | 关注者 |
| following_id | VARCHAR(36) | FK → users.id, CASCADE | 被关注者 |
| created_at | TIMESTAMP | DEFAULT NOW() | |

**唯一约束：** (follower_id, following_id)

### 5.6 circles - 圈子表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | VARCHAR(36) | PK | UUID |
| name | VARCHAR(100) | NOT NULL | 圈子名称 |
| description | TEXT | | 圈子简介 |
| emoji | VARCHAR(10) | | 图标 emoji |
| color | VARCHAR(20) | | 主题色 |
| creator_id | VARCHAR(36) | | 创建者ID |
| member_count | INT | DEFAULT 0 | 成员数 |
| post_count | INT | DEFAULT 0 | 帖子数 |
| status | ENUM | DEFAULT 'active' | active/hidden/deleted |
| created_at | TIMESTAMP | DEFAULT NOW() | |
| updated_at | TIMESTAMP | ON UPDATE NOW() | |

### 5.7 circle_members - 圈子成员表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | VARCHAR(36) | PK | UUID |
| circle_id | VARCHAR(36) | FK → circles.id, CASCADE | 圈子ID |
| user_id | VARCHAR(36) | FK → users.id, CASCADE | 成员ID |
| role | ENUM | DEFAULT 'member' | member/admin/owner |
| created_at | TIMESTAMP | DEFAULT NOW() | |

**唯一约束：** (circle_id, user_id)

---

## 6. 私信系统

### 6.1 conversations - 会话表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | VARCHAR(36) | PK | UUID |
| user1_id | VARCHAR(36) | FK → users.id, CASCADE | 用户1 |
| user2_id | VARCHAR(36) | FK → users.id, CASCADE | 用户2 |
| last_message | TEXT | | 最新消息预览 |
| last_message_type | ENUM | DEFAULT 'text' | text/image |
| last_message_at | TIMESTAMP | | 最新消息时间 |
| created_at | TIMESTAMP | DEFAULT NOW() | |

**唯一约束：** (user1_id, user2_id)

### 6.2 messages - 消息表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | VARCHAR(36) | PK | UUID |
| conversation_id | VARCHAR(36) | FK → conversations.id, CASCADE | 会话ID |
| sender_id | VARCHAR(36) | FK → users.id | 发送者 |
| content | TEXT | NOT NULL | 消息内容 |
| type | ENUM | DEFAULT 'text' | text/image |
| is_read | BOOLEAN | DEFAULT FALSE | 是否已读 |
| created_at | TIMESTAMP | DEFAULT NOW() | |

**索引：** conversation_id, sender_id

---

## 7. 积分与签到

### 7.1 check_ins - 签到表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | VARCHAR(36) | PK | UUID |
| user_id | VARCHAR(36) | FK → users.id, CASCADE | 用户ID |
| check_in_date | DATE | NOT NULL | 签到日期 |
| streak | INT | DEFAULT 1 | 连续签到天数 |
| points_earned | INT | DEFAULT 10 | 获得积分 |
| created_at | TIMESTAMP | DEFAULT NOW() | |

**唯一约束：** (user_id, check_in_date)

### 7.2 points_history - 积分流水表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | VARCHAR(36) | PK | UUID |
| user_id | VARCHAR(36) | FK → users.id, CASCADE | 用户ID |
| amount | INT | NOT NULL | 变动金额（正=获得，负=消费） |
| type | ENUM | NOT NULL | check_in/quiz/post/comment/like_received/reward/purchase |
| description | VARCHAR(200) | | 变动描述 |
| related_id | VARCHAR(36) | | 关联业务ID |
| created_at | TIMESTAMP | DEFAULT NOW() | |

**索引：** user_id, type, created_at

---

## 8. 答题系统

### 8.1 quizzes - 题目表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | VARCHAR(36) | PK | UUID |
| breed_id | VARCHAR(50) | | 关联品种 |
| category | ENUM | NOT NULL | 品种识别/健康护理/行为训练/趣味冷知识 |
| difficulty | ENUM | DEFAULT '中等' | 简单/中等/困难 |
| question_type | ENUM | DEFAULT '单选' | 单选/多选/判断 |
| question | JSON | NOT NULL | 题目内容 |
| answer | JSON | NOT NULL | 答案和解析 |
| points_reward | INT | DEFAULT 10 | 答对奖励积分 |
| status | ENUM | DEFAULT 'active' | active/disabled |
| created_at | TIMESTAMP | DEFAULT NOW() | |

**索引：** category, breed_id

### 8.2 quiz_records - 答题记录表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | VARCHAR(36) | PK | UUID |
| user_id | VARCHAR(36) | FK → users.id, CASCADE | 用户ID |
| quiz_id | VARCHAR(36) | FK → quizzes.id | 题目ID |
| is_correct | BOOLEAN | NOT NULL | 是否答对 |
| time_spent | INT | | 答题耗时(秒) |
| created_at | TIMESTAMP | DEFAULT NOW() | |

**索引：** user_id

---

## 9. 通知与举报

### 9.1 notifications - 通知表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | VARCHAR(36) | PK | UUID |
| user_id | VARCHAR(36) | FK → users.id, CASCADE | 接收者 |
| from_user_id | VARCHAR(36) | FK → users.id, SET NULL | 发送者 |
| type | ENUM | NOT NULL | like/comment/follow/reply/system |
| target_type | VARCHAR(20) | | post/comment/user |
| target_id | VARCHAR(36) | | 目标ID |
| content | TEXT | | 通知内容 |
| is_read | BOOLEAN | DEFAULT FALSE | 是否已读 |
| created_at | TIMESTAMP | DEFAULT NOW() | |

**索引：** (user_id, is_read), created_at

### 9.2 reports - 举报表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | VARCHAR(36) | PK | UUID |
| reporter_id | VARCHAR(36) | FK → users.id | 举报者 |
| target_type | ENUM | NOT NULL | post/comment/user |
| target_id | VARCHAR(36) | NOT NULL | 被举报目标 |
| reason | VARCHAR(50) | NOT NULL | 举报原因 |
| detail | TEXT | | 详细描述 |
| status | ENUM | DEFAULT 'pending' | pending/resolved/dismissed |
| created_at | TIMESTAMP | DEFAULT NOW() | |
| resolved_at | TIMESTAMP | | 处理时间 |

**索引：** (target_type, target_id), status

---

## 10. 部署指南

### 建库建表

```bash
mysql -u root -p < server/full_schema.sql
```

### 写入种子数据

```bash
cd server && node seed.js
```

### 环境变量 (server/.env)

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=你的密码
DB_NAME=pet_planet
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret
PORT=3000
```

### 表清单速查

| # | 表名 | 记录数(初始) | 用途 |
|---|------|-------------|------|
| 1 | breeds | 39 | 品种数据(种子写入) |
| 2 | users | 0 | 用户注册写入 |
| 3 | refresh_tokens | 0 | 登录时写入 |
| 4 | sms_codes | 0 | 发送验证码时写入 |
| 5 | virtual_pets | 0 | 领养宠物时写入 |
| 6 | posts | 0 | 用户发帖写入 |
| 7 | comments | 0 | 用户评论写入 |
| 8 | likes | 0 | 用户点赞写入 |
| 9 | bookmarks | 0 | 用户收藏写入 |
| 10 | follows | 0 | 用户关注写入 |
| 11 | circles | 0 | 创建圈子时写入 |
| 12 | circle_members | 0 | 加入圈子时写入 |
| 13 | conversations | 0 | 发起私信时写入 |
| 14 | messages | 0 | 发送消息时写入 |
| 15 | notifications | 0 | 系统自动生成 |
| 16 | reports | 0 | 用户举报写入 |
| 17 | quizzes | 0 | 后台管理写入 |
| 18 | quiz_records | 0 | 答题时写入 |
| 19 | check_ins | 0 | 用户签到写入 |
| 20 | points_history | 0 | 积分变动写入 |
