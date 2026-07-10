# 萌宠星球 API 设计文档

> 项目名称：萌宠星球 (Pet Planet)
> 技术栈：Expo React Native (前端) + Express + MySQL (后端)
> 基础 URL：`http://localhost:3000/api`

---

## 一、数据模型设计

### 1. 用户模型 (User)

对应数据库表 `users`，已有基础字段，新增社交相关字段。

```sql
-- 扩展用户表
ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NOT NULL AFTER username;
ALTER TABLE users ADD COLUMN gender ENUM('male', 'female', 'unknown') DEFAULT 'unknown';
ALTER TABLE users ADD COLUMN birthday DATE;
ALTER TABLE users ADD COLUMN city VARCHAR(50);
ALTER TABLE users ADD COLUMN followers_count INT DEFAULT 0;
ALTER TABLE users ADD COLUMN following_count INT DEFAULT 0;
ALTER TABLE users ADD COLUMN posts_count INT DEFAULT 0;
```

完整字段定义：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | VARCHAR(36) | PK | UUID 主键 |
| username | VARCHAR(50) | Y | 登录用户名，唯一 |
| password_hash | VARCHAR(255) | Y | bcrypt 加密密码 |
| phone | VARCHAR(20) | N | 手机号 |
| email | VARCHAR(100) | N | 邮箱 |
| avatar_url | VARCHAR(500) | N | 头像地址 |
| nickname | VARCHAR(50) | N | 显示昵称 |
| bio | VARCHAR(200) | N | 个人简介 |
| gender | ENUM | N | 性别 |
| birthday | DATE | N | 生日 |
| city | VARCHAR(50) | N | 所在城市 |
| preferences | JSON | N | 用户偏好设置 |
| level | INT | N | 等级，默认 1 |
| points | INT | N | 积分，默认 0 |
| followers_count | INT | N | 粉丝数 |
| following_count | INT | N | 关注数 |
| posts_count | INT | N | 发帖数 |
| status | ENUM | N | active / banned / inactive |
| created_at | TIMESTAMP | auto | 注册时间 |
| last_login_at | TIMESTAMP | N | 最后登录时间 |

TypeScript 类型：

```typescript
export interface User {
  id: string;
  username: string;
  phone?: string;
  email?: string;
  avatarUrl?: string;
  nickname?: string;
  bio?: string;
  gender: 'male' | 'female' | 'unknown';
  birthday?: string;
  city?: string;
  preferences?: UserPreferences;
  level: number;
  points: number;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  status: 'active' | 'banned' | 'inactive';
  createdAt: string;
  lastLoginAt?: string;
}

export interface UserPreferences {
  notifications: boolean;
  darkMode: boolean;
  autoPlayVideo: boolean;
  language: string;
}

/** 公开用户信息（不含敏感字段） */
export type UserProfile = Omit<User, 'phone' | 'email' | 'preferences' | 'status' | 'lastLoginAt'>;
```

---

### 2. 帖子模型 (Post)

对应数据库表 `posts`，已有基础结构，补充收藏功能。

```sql
-- 新增收藏表
CREATE TABLE IF NOT EXISTS bookmarks (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  post_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uk_user_post (user_id, post_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (post_id) REFERENCES posts(id),
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='收藏表';
```

完整字段定义：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | VARCHAR(36) | PK | UUID 主键 |
| user_id | VARCHAR(36) | Y | 发帖用户 ID |
| breed_id | VARCHAR(50) | N | 关联品种（可选） |
| title | VARCHAR(200) | N | 帖子标题 |
| content | TEXT | Y | 帖子正文 |
| images | JSON | N | 图片 URL 数组 |
| tags | JSON | N | 标签数组 |
| stats | JSON | Y | { likesCount, commentsCount, viewsCount } |
| is_pinned | BOOLEAN | N | 是否置顶 |
| status | ENUM | N | published / hidden / deleted |
| created_at | TIMESTAMP | auto | 创建时间 |
| updated_at | TIMESTAMP | auto | 更新时间 |

TypeScript 类型：

```typescript
export interface Post {
  id: string;
  userId: string;
  breedId?: string;
  title?: string;
  content: string;
  images: string[];
  tags: string[];
  stats: PostStats;
  isPinned: boolean;
  status: 'published' | 'hidden' | 'deleted';
  createdAt: string;
  updatedAt: string;
  // 关联字段（查询时填充）
  user?: Pick<User, 'id' | 'nickname' | 'avatarUrl' | 'level'>;
  isLiked?: boolean;
  isBookmarked?: boolean;
}

export interface PostStats {
  likesCount: number;
  commentsCount: number;
  viewsCount: number;
}

export interface CreatePostInput {
  title?: string;
  content: string;
  images?: string[];
  tags?: string[];
  breedId?: string;
}
```

---

### 3. 评论模型 (Comment)

对应数据库表 `comments`，已有基础结构，支持楼中楼。

完整字段定义：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | VARCHAR(36) | PK | UUID 主键 |
| post_id | VARCHAR(36) | Y | 所属帖子 ID |
| user_id | VARCHAR(36) | Y | 评论用户 ID |
| parent_id | VARCHAR(36) | N | 父评论 ID（楼中楼） |
| reply_to_user_id | VARCHAR(36) | N | 回复目标用户 ID |
| content | TEXT | Y | 评论内容 |
| likes_count | INT | N | 点赞数，默认 0 |
| status | ENUM | N | visible / hidden / deleted |
| created_at | TIMESTAMP | auto | 创建时间 |

TypeScript 类型：

```typescript
export interface Comment {
  id: string;
  postId: string;
  userId: string;
  parentId?: string;
  replyToUserId?: string;
  content: string;
  likesCount: number;
  status: 'visible' | 'hidden' | 'deleted';
  createdAt: string;
  // 关联字段
  user?: Pick<User, 'id' | 'nickname' | 'avatarUrl' | 'level'>;
  replyToUser?: Pick<User, 'id' | 'nickname'>;
  isLiked?: boolean;
  children?: Comment[];
}

export interface CreateCommentInput {
  postId: string;
  content: string;
  parentId?: string;
  replyToUserId?: string;
}
```

---

### 4. 点赞模型 (Like)

对应数据库表 `likes`，已有基础结构，支持帖子和评论点赞。

完整字段定义：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | VARCHAR(36) | PK | UUID 主键 |
| user_id | VARCHAR(36) | Y | 点赞用户 ID |
| target_type | ENUM | Y | post / comment |
| target_id | VARCHAR(36) | Y | 目标 ID |
| created_at | TIMESTAMP | auto | 点赞时间 |

TypeScript 类型：

```typescript
export interface Like {
  id: string;
  userId: string;
  targetType: 'post' | 'comment';
  targetId: string;
  createdAt: string;
}

export interface LikeToggleResult {
  liked: boolean;
  likesCount: number;
}
```

---

### 5. 关注模型 (Follow)

新建表，支持用户间关注关系。

```sql
CREATE TABLE IF NOT EXISTS follows (
  id VARCHAR(36) PRIMARY KEY,
  follower_id VARCHAR(36) NOT NULL COMMENT '关注者',
  following_id VARCHAR(36) NOT NULL COMMENT '被关注者',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uk_follow (follower_id, following_id),
  FOREIGN KEY (follower_id) REFERENCES users(id),
  FOREIGN KEY (following_id) REFERENCES users(id),
  INDEX idx_follower (follower_id),
  INDEX idx_following (following_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='关注关系表';
```

完整字段定义：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | VARCHAR(36) | PK | UUID 主键 |
| follower_id | VARCHAR(36) | Y | 关注者用户 ID |
| following_id | VARCHAR(36) | Y | 被关注者用户 ID |
| created_at | TIMESTAMP | auto | 关注时间 |

TypeScript 类型：

```typescript
export interface Follow {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: string;
}

export interface FollowStatus {
  isFollowing: boolean;
  isFollowedBy: boolean;
  isMutual: boolean;
}
```

---

### 6. 消息模型 (Message)

新建表，支持用户间私信。

```sql
CREATE TABLE IF NOT EXISTS conversations (
  id VARCHAR(36) PRIMARY KEY,
  user1_id VARCHAR(36) NOT NULL,
  user2_id VARCHAR(36) NOT NULL,
  last_message_id VARCHAR(36),
  last_message_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uk_conversation (user1_id, user2_id),
  FOREIGN KEY (user1_id) REFERENCES users(id),
  FOREIGN KEY (user2_id) REFERENCES users(id),
  INDEX idx_user1 (user1_id),
  INDEX idx_user2 (user2_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='会话表';

CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR(36) PRIMARY KEY,
  conversation_id VARCHAR(36) NOT NULL,
  sender_id VARCHAR(36) NOT NULL,
  content TEXT NOT NULL,
  message_type ENUM('text', 'image', 'system') DEFAULT 'text',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (conversation_id) REFERENCES conversations(id),
  FOREIGN KEY (sender_id) REFERENCES users(id),
  INDEX idx_conversation (conversation_id, created_at),
  INDEX idx_sender (sender_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='消息表';

-- 未读消息计数表（优化查询性能）
CREATE TABLE IF NOT EXISTS unread_counts (
  user_id VARCHAR(36) NOT NULL,
  conversation_id VARCHAR(36) NOT NULL,
  count INT DEFAULT 0,

  PRIMARY KEY (user_id, conversation_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='未读消息计数表';
```

TypeScript 类型：

```typescript
export interface Conversation {
  id: string;
  user1Id: string;
  user2Id: string;
  lastMessageId?: string;
  lastMessageAt?: string;
  createdAt: string;
  // 关联字段
  otherUser?: Pick<User, 'id' | 'nickname' | 'avatarUrl'>;
  lastMessage?: Pick<Message, 'content' | 'messageType'>;
  unreadCount?: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  messageType: 'text' | 'image' | 'system';
  isRead: boolean;
  createdAt: string;
  // 关联字段
  sender?: Pick<User, 'id' | 'nickname' | 'avatarUrl'>;
}

export interface SendMessageInput {
  receiverId: string;
  content: string;
  messageType?: 'text' | 'image';
}
```

---

## 二、API 接口设计

所有接口统一返回格式：

```typescript
// 成功响应
interface ApiResponse<T> {
  code: 0;
  data: T;
  message?: string;
}

// 分页响应
interface ApiPaginatedResponse<T> {
  code: 0;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// 错误响应
interface ApiError {
  code: number;    // 业务错误码
  message: string; // 错误描述
  details?: any;   // 详细信息（仅开发环境）
}
```

通用错误码：

| 错误码 | 说明 |
|--------|------|
| 0 | 成功 |
| 1001 | 参数校验失败 |
| 1002 | 未授权（未登录） |
| 1003 | 无权限 |
| 1004 | 资源不存在 |
| 1005 | 请求频率过高 |
| 2001 | 用户名已存在 |
| 2002 | 手机号已注册 |
| 2003 | 账号或密码错误 |
| 2004 | Token 已过期 |
| 2005 | 账号已被封禁 |

---

### 1. 认证相关接口

#### 1.1 用户注册

```
POST /api/auth/register
```

请求体：

```json
{
  "username": "petlover",
  "password": "Abc123456",
  "nickname": "萌宠爱好者",
  "phone": "13800138000"
}
```

参数校验：
- username: 3-20 位字母数字下划线
- password: 6-32 位，至少包含字母和数字
- nickname: 1-20 位
- phone: 可选，11 位手机号格式

成功响应 (201)：

```json
{
  "code": 0,
  "data": {
    "user": {
      "id": "uuid-xxx",
      "username": "petlover",
      "nickname": "萌宠爱好者",
      "level": 1,
      "points": 0
    },
    "accessToken": "eyJhbG...",
    "refreshToken": "eyJhbG...",
    "expiresIn": 7200
  }
}
```

错误响应：

```json
{ "code": 2001, "message": "用户名已存在" }
{ "code": 2002, "message": "手机号已注册" }
```

---

#### 1.2 用户登录

```
POST /api/auth/login
```

请求体：

```json
{
  "username": "petlover",
  "password": "Abc123456"
}
```

成功响应 (200)：

```json
{
  "code": 0,
  "data": {
    "user": {
      "id": "uuid-xxx",
      "username": "petlover",
      "nickname": "萌宠爱好者",
      "avatarUrl": null,
      "level": 5,
      "points": 1280
    },
    "accessToken": "eyJhbG...",
    "refreshToken": "eyJhbG...",
    "expiresIn": 7200
  }
}
```

错误响应：

```json
{ "code": 2003, "message": "账号或密码错误" }
{ "code": 2005, "message": "账号已被封禁" }
```

---

#### 1.3 刷新 Token

```
POST /api/auth/refresh
```

请求体：

```json
{
  "refreshToken": "eyJhbG..."
}
```

成功响应 (200)：

```json
{
  "code": 0,
  "data": {
    "accessToken": "eyJhbG...",
    "refreshToken": "eyJhbG...",
    "expiresIn": 7200
  }
}
```

错误响应：

```json
{ "code": 2004, "message": "Token 已过期，请重新登录" }
```

---

#### 1.4 退出登录

```
POST /api/auth/logout
Authorization: Bearer <accessToken>
```

成功响应 (200)：

```json
{ "code": 0, "message": "已退出登录" }
```

---

### 2. 用户相关接口

#### 2.1 获取当前用户信息

```
GET /api/users/me
Authorization: Bearer <accessToken>
```

成功响应 (200)：

```json
{
  "code": 0,
  "data": {
    "id": "uuid-xxx",
    "username": "petlover",
    "nickname": "萌宠爱好者",
    "avatarUrl": "https://...",
    "bio": "热爱所有毛茸茸的小动物",
    "gender": "unknown",
    "birthday": null,
    "city": "北京",
    "level": 5,
    "points": 1280,
    "followersCount": 128,
    "followingCount": 56,
    "postsCount": 12,
    "preferences": {
      "notifications": true,
      "darkMode": false,
      "autoPlayVideo": true,
      "language": "zh-CN"
    },
    "createdAt": "2025-01-15T08:00:00Z"
  }
}
```

---

#### 2.2 获取指定用户公开资料

```
GET /api/users/:id
```

成功响应 (200)：

```json
{
  "code": 0,
  "data": {
    "id": "uuid-xxx",
    "nickname": "萌宠爱好者",
    "avatarUrl": "https://...",
    "bio": "热爱所有毛茸茸的小动物",
    "level": 5,
    "followersCount": 128,
    "followingCount": 56,
    "postsCount": 12,
    "createdAt": "2025-01-15T08:00:00Z",
    "isFollowing": false,
    "isFollowedBy": false
  }
}
```

---

#### 2.3 更新用户资料

```
PUT /api/users/me
Authorization: Bearer <accessToken>
```

请求体（均可选，只传需要修改的字段）：

```json
{
  "nickname": "新昵称",
  "avatarUrl": "https://...",
  "bio": "新的个人简介",
  "gender": "female",
  "birthday": "2000-01-01",
  "city": "上海"
}
```

成功响应 (200)：

```json
{ "code": 0, "data": { /* 更新后的用户信息 */ } }
```

---

#### 2.4 更新用户偏好设置

```
PATCH /api/users/me/preferences
Authorization: Bearer <accessToken>
```

请求体：

```json
{
  "notifications": false,
  "darkMode": true
}
```

成功响应 (200)：

```json
{ "code": 0, "data": { "notifications": false, "darkMode": true, "autoPlayVideo": true, "language": "zh-CN" } }
```

---

#### 2.5 上传头像

```
POST /api/users/me/avatar
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data
```

请求参数：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file | File | Y | 图片文件（jpg/png/webp，最大 5MB） |

成功响应 (200)：

```json
{ "code": 0, "data": { "avatarUrl": "https://cdn.petplanet.app/avatars/xxx.jpg" } }
```

---

#### 2.6 修改密码

```
PUT /api/users/me/password
Authorization: Bearer <accessToken>
```

请求体：

```json
{
  "oldPassword": "Abc123456",
  "newPassword": "NewPass789"
}
```

成功响应 (200)：

```json
{ "code": 0, "message": "密码修改成功" }
```

---

### 3. 帖子相关接口

#### 3.1 获取帖子列表

```
GET /api/posts
```

查询参数：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | N | 页码，默认 1 |
| limit | number | N | 每页条数，默认 20，最大 50 |
| sort | string | N | 排序：hot（热门）/ latest（最新），默认 hot |
| breedId | string | N | 按品种筛选 |
| tag | string | N | 按标签筛选 |
| userId | string | N | 按用户筛选（获取某用户的帖子） |

成功响应 (200)：

```json
{
  "code": 0,
  "data": [
    {
      "id": "uuid-xxx",
      "userId": "uuid-user",
      "title": null,
      "content": "今天带小咪去体检啦...",
      "images": [],
      "tags": ["布偶猫", "体检", "日常"],
      "stats": { "likesCount": 128, "commentsCount": 2, "viewsCount": 1024 },
      "isPinned": false,
      "status": "published",
      "createdAt": "2025-05-27T08:00:00Z",
      "updatedAt": "2025-05-27T08:00:00Z",
      "user": {
        "id": "uuid-user",
        "nickname": "猫奴小王",
        "avatarUrl": null,
        "level": 8
      },
      "isLiked": false,
      "isBookmarked": false
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 156,
    "totalPages": 8
  }
}
```

---

#### 3.2 获取帖子详情

```
GET /api/posts/:id
```

成功响应 (200)：

```json
{
  "code": 0,
  "data": {
    "id": "uuid-xxx",
    "userId": "uuid-user",
    "content": "完整帖子内容...",
    "images": ["https://cdn.../1.jpg", "https://cdn.../2.jpg"],
    "tags": ["布偶猫", "体检"],
    "stats": { "likesCount": 128, "commentsCount": 2, "viewsCount": 1025 },
    "isPinned": false,
    "status": "published",
    "createdAt": "2025-05-27T08:00:00Z",
    "updatedAt": "2025-05-27T08:00:00Z",
    "user": {
      "id": "uuid-user",
      "nickname": "猫奴小王",
      "avatarUrl": null,
      "level": 8
    },
    "isLiked": false,
    "isBookmarked": false,
    "breed": {
      "id": "ragdoll",
      "name": "布偶猫"
    }
  }
}
```

---

#### 3.3 创建帖子

```
POST /api/posts
Authorization: Bearer <accessToken>
```

请求体：

```json
{
  "content": "今天带小咪去体检啦，一切正常！",
  "title": null,
  "images": ["https://cdn.../1.jpg"],
  "tags": ["布偶猫", "体检"],
  "breedId": "ragdoll"
}
```

参数校验：
- content: 1-5000 字符，必填
- title: 可选，最长 200 字符
- images: 可选，最多 9 张
- tags: 可选，最多 10 个标签，每个最长 20 字符

成功响应 (201)：

```json
{ "code": 0, "data": { /* 新创建的帖子完整信息 */ } }
```

---

#### 3.4 更新帖子

```
PUT /api/posts/:id
Authorization: Bearer <accessToken>
```

请求体（只传需要修改的字段）：

```json
{
  "content": "更新后的帖子内容",
  "tags": ["新标签"]
}
```

权限：仅帖子作者可操作。

成功响应 (200)：

```json
{ "code": 0, "data": { /* 更新后的帖子信息 */ } }
```

错误响应：

```json
{ "code": 1003, "message": "无权限修改此帖子" }
{ "code": 1004, "message": "帖子不存在" }
```

---

#### 3.5 删除帖子

```
DELETE /api/posts/:id
Authorization: Bearer <accessToken>
```

权限：仅帖子作者可操作。执行软删除（status 设为 deleted）。

成功响应 (200)：

```json
{ "code": 0, "message": "帖子已删除" }
```

---

#### 3.6 点赞/取消点赞帖子

```
POST /api/posts/:id/like
Authorization: Bearer <accessToken>
```

功能：点赞操作为 toggle 模式，已点赞则取消。

成功响应 (200)：

```json
{ "code": 0, "data": { "liked": true, "likesCount": 129 } }
```

取消点赞响应：

```json
{ "code": 0, "data": { "liked": false, "likesCount": 128 } }
```

---

#### 3.7 收藏/取消收藏帖子

```
POST /api/posts/:id/bookmark
Authorization: Bearer <accessToken>
```

功能：收藏操作为 toggle 模式，已收藏则取消。

成功响应 (200)：

```json
{ "code": 0, "data": { "bookmarked": true } }
```

取消收藏响应：

```json
{ "code": 0, "data": { "bookmarked": false } }
```

---

#### 3.8 获取用户收藏列表

```
GET /api/bookmarks
Authorization: Bearer <accessToken>
```

查询参数：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | N | 页码，默认 1 |
| limit | number | N | 每页条数，默认 20 |

成功响应 (200)：

```json
{
  "code": 0,
  "data": [
    {
      "id": "bookmark-uuid",
      "postId": "post-uuid",
      "createdAt": "2025-05-27T10:00:00Z",
      "post": { /* 帖子完整信息 */ }
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 28, "totalPages": 2 }
}
```

---

### 4. 评论相关接口

#### 4.1 获取帖子评论列表

```
GET /api/posts/:postId/comments
```

查询参数：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | N | 页码，默认 1 |
| limit | number | N | 每页条数，默认 20 |
| sort | string | N | 排序：latest（最新）/ oldest（最早），默认 latest |

成功响应 (200)：

```json
{
  "code": 0,
  "data": [
    {
      "id": "comment-uuid-1",
      "postId": "post-uuid",
      "userId": "user-uuid-1",
      "content": "建议定时定量喂食，一天两顿就好",
      "likesCount": 5,
      "createdAt": "2025-05-27T08:02:00Z",
      "user": {
        "id": "user-uuid-1",
        "nickname": "养猫达人",
        "avatarUrl": null,
        "level": 10
      },
      "isLiked": false,
      "children": [
        {
          "id": "comment-uuid-2",
          "postId": "post-uuid",
          "userId": "user-uuid-2",
          "parentId": "comment-uuid-1",
          "replyToUserId": "user-uuid-1",
          "content": "谢谢建议！",
          "likesCount": 1,
          "createdAt": "2025-05-27T08:05:00Z",
          "user": {
            "id": "user-uuid-2",
            "nickname": "猫奴小王",
            "avatarUrl": null,
            "level": 8
          },
          "replyToUser": {
            "id": "user-uuid-1",
            "nickname": "养猫达人"
          },
          "isLiked": false,
          "children": []
        }
      ]
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 2, "totalPages": 1 }
}
```

---

#### 4.2 创建评论

```
POST /api/posts/:postId/comments
Authorization: Bearer <accessToken>
```

请求体：

```json
{
  "content": "建议定时定量喂食，一天两顿就好"
}
```

楼中楼回复：

```json
{
  "content": "谢谢建议！",
  "parentId": "comment-uuid-1",
  "replyToUserId": "user-uuid-1"
}
```

参数校验：
- content: 1-500 字符，必填
- parentId: 可选，回复的父评论 ID
- replyToUserId: 可选，回复目标用户 ID

成功响应 (201)：

```json
{ "code": 0, "data": { /* 新创建的评论完整信息 */ } }
```

---

#### 4.3 删除评论

```
DELETE /api/comments/:id
Authorization: Bearer <accessToken>
```

权限：评论作者或帖子作者可操作。执行软删除。

成功响应 (200)：

```json
{ "code": 0, "message": "评论已删除" }
```

---

#### 4.4 点赞/取消点赞评论

```
POST /api/comments/:id/like
Authorization: Bearer <accessToken>
```

功能：toggle 模式。

成功响应 (200)：

```json
{ "code": 0, "data": { "liked": true, "likesCount": 6 } }
```

---

### 5. 关注相关接口

#### 5.1 关注用户

```
POST /api/users/:id/follow
Authorization: Bearer <accessToken>
```

功能：关注指定用户。不可关注自己。

成功响应 (200)：

```json
{ "code": 0, "data": { "isFollowing": true, "followersCount": 129 } }
```

错误响应：

```json
{ "code": 1001, "message": "不能关注自己" }
```

---

#### 5.2 取消关注

```
DELETE /api/users/:id/follow
Authorization: Bearer <accessToken>
```

成功响应 (200)：

```json
{ "code": 0, "data": { "isFollowing": false, "followersCount": 128 } }
```

---

#### 5.3 获取关注状态

```
GET /api/users/:id/follow-status
Authorization: Bearer <accessToken>
```

成功响应 (200)：

```json
{
  "code": 0,
  "data": {
    "isFollowing": true,
    "isFollowedBy": false,
    "isMutual": false
  }
}
```

---

#### 5.4 获取粉丝列表

```
GET /api/users/:id/followers
```

查询参数：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | N | 页码，默认 1 |
| limit | number | N | 每页条数，默认 20 |

成功响应 (200)：

```json
{
  "code": 0,
  "data": [
    {
      "id": "user-uuid",
      "nickname": "粉丝昵称",
      "avatarUrl": null,
      "bio": "个人简介",
      "level": 5,
      "isFollowing": true
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 128, "totalPages": 7 }
}
```

---

#### 5.5 获取关注列表

```
GET /api/users/:id/following
```

查询参数同粉丝列表。

成功响应 (200)：格式同粉丝列表。

---

### 6. 消息相关接口

#### 6.1 获取会话列表

```
GET /api/conversations
Authorization: Bearer <accessToken>
```

查询参数：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | N | 页码，默认 1 |
| limit | number | N | 每页条数，默认 20 |

成功响应 (200)：

```json
{
  "code": 0,
  "data": [
    {
      "id": "conversation-uuid",
      "otherUser": {
        "id": "user-uuid",
        "nickname": "养猫达人",
        "avatarUrl": null
      },
      "lastMessage": {
        "content": "好的，谢谢建议！",
        "messageType": "text"
      },
      "lastMessageAt": "2025-05-27T10:30:00Z",
      "unreadCount": 3
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 5, "totalPages": 1 }
}
```

---

#### 6.2 获取或创建会话

```
POST /api/conversations
Authorization: Bearer <accessToken>
```

请求体：

```json
{
  "userId": "target-user-uuid"
}
```

功能：如果已存在会话则返回已有会话，否则新建。

成功响应 (200/201)：

```json
{ "code": 0, "data": { "id": "conversation-uuid" } }
```

---

#### 6.3 获取会话消息历史

```
GET /api/conversations/:id/messages
Authorization: Bearer <accessToken>
```

查询参数：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | N | 页码，默认 1 |
| limit | number | N | 每页条数，默认 50 |
| before | string | N | 游标分页：获取此时间戳之前的消息 |

成功响应 (200)：

```json
{
  "code": 0,
  "data": [
    {
      "id": "message-uuid",
      "conversationId": "conversation-uuid",
      "senderId": "user-uuid",
      "content": "你好！",
      "messageType": "text",
      "isRead": true,
      "createdAt": "2025-05-27T10:00:00Z",
      "sender": {
        "id": "user-uuid",
        "nickname": "养猫达人",
        "avatarUrl": null
      }
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 42, "totalPages": 1 }
}
```

---

#### 6.4 发送消息

```
POST /api/conversations/:id/messages
Authorization: Bearer <accessToken>
```

请求体：

```json
{
  "content": "你好，请问布偶猫好养吗？",
  "messageType": "text"
}
```

参数校验：
- content: 1-2000 字符，必填
- messageType: text / image，默认 text

成功响应 (201)：

```json
{ "code": 0, "data": { /* 新消息完整信息 */ } }
```

---

#### 6.5 标记消息已读

```
POST /api/conversations/:id/read
Authorization: Bearer <accessToken>
```

功能：将指定会话中所有未读消息标记为已读。

成功响应 (200)：

```json
{ "code": 0, "data": { "readCount": 3 } }
```

---

#### 6.6 获取未读消息总数

```
GET /api/messages/unread-count
Authorization: Bearer <accessToken>
```

成功响应 (200)：

```json
{
  "code": 0,
  "data": {
    "totalUnread": 7,
    "conversations": [
      { "conversationId": "conv-uuid-1", "unreadCount": 3 },
      { "conversationId": "conv-uuid-2", "unreadCount": 4 }
    ]
  }
}
```

---

## 三、状态管理设计

基于 React Native 项目特点，推荐使用轻量级状态管理方案。以下设计可配合 Zustand 或 React Context + useReducer 实现。

### 1. 用户状态 (AuthStore)

```typescript
interface AuthState {
  // 状态
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;

  // 操作
  login: (username: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  updateProfile: (input: UpdateProfileInput) => Promise<void>;
  updatePreferences: (input: Partial<UserPreferences>) => Promise<void>;

  // 内部方法
  setTokens: (access: string, refresh: string) => void;
  clearAuth: () => void;
  loadFromStorage: () => Promise<void>;
}

interface RegisterInput {
  username: string;
  password: string;
  nickname?: string;
  phone?: string;
}

interface UpdateProfileInput {
  nickname?: string;
  avatarUrl?: string;
  bio?: string;
  gender?: 'male' | 'female' | 'unknown';
  birthday?: string;
  city?: string;
}
```

Token 存储策略：
- accessToken 和 refreshToken 使用 `expo-secure-store` 加密存储
- 应用启动时自动从存储加载并校验 Token 有效性
- accessToken 过期前 5 分钟自动触发静默刷新
- refreshToken 过期则跳转登录页

---

### 2. 帖子状态 (PostStore)

```typescript
interface PostState {
  // 列表状态
  posts: Post[];
  isLoading: boolean;
  isRefreshing: boolean;
  hasMore: boolean;
  currentPage: number;
  activeSort: 'hot' | 'latest';
  activeBreedFilter: string | null;

  // 详情缓存
  postDetailCache: Record<string, Post>;

  // 操作
  fetchPosts: (options?: { refresh?: boolean; sort?: string; breedId?: string }) => Promise<void>;
  loadMore: () => Promise<void>;
  fetchPostDetail: (id: string) => Promise<Post>;
  createPost: (input: CreatePostInput) => Promise<Post>;
  deletePost: (id: string) => Promise<void>;
  toggleLike: (postId: string) => Promise<void>;
  toggleBookmark: (postId: string) => Promise<void>;

  // 乐观更新辅助
  optimisticLike: (postId: string) => void;
  optimisticBookmark: (postId: string) => void;
  revertOptimistic: (postId: string, original: Partial<Post>) => void;
}
```

缓存策略：
- 帖子列表使用 LRU 缓存，最多缓存 5 个不同筛选条件的列表
- 帖子详情缓存 10 分钟，超过则在下次访问时静默刷新
- 点赞/收藏操作采用乐观更新（先更新 UI，后发请求），失败时回滚

---

### 3. 消息状态 (MessageStore)

```typescript
interface MessageState {
  // 会话列表
  conversations: Conversation[];
  conversationsLoading: boolean;

  // 未读计数
  totalUnreadCount: number;
  unreadByConversation: Record<string, number>;

  // 当前会话消息
  currentMessages: Message[];
  currentConversationId: string | null;
  messagesLoading: boolean;
  hasMoreMessages: boolean;

  // 操作
  fetchConversations: () => Promise<void>;
  openConversation: (conversationId: string) => Promise<void>;
  sendMessage: (conversationId: string, content: string, type?: string) => Promise<void>;
  markAsRead: (conversationId: string) => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  loadMoreMessages: () => Promise<void>;

  // WebSocket 事件处理
  onNewMessage: (message: Message) => void;
  onMessageRead: (conversationId: string) => void;
}
```

实时通信方案：
- 使用 WebSocket（Socket.IO）实现消息实时推送
- 连接建立时发送认证 Token
- 监听事件：`new_message`、`message_read`、`typing`
- 应用进入后台时断开连接，回到前台时重连并同步未读数
- 消息列表支持游标分页，向下滚动加载更早的消息

---

### 4. 关注状态 (FollowStore)

```typescript
interface FollowState {
  // 缓存关注状态（userId -> FollowStatus）
  followStatusCache: Record<string, FollowStatus>;

  // 操作
  toggleFollow: (userId: string) => Promise<void>;
  fetchFollowStatus: (userId: string) => Promise<FollowStatus>;
  fetchFollowers: (userId: string, page?: number) => Promise<PaginatedResult<UserProfile>>;
  fetchFollowing: (userId: string, page?: number) => Promise<PaginatedResult<UserProfile>>;

  // 缓存管理
  clearCache: () => void;
}
```

---

### 5. 全局状态结构总览

```
App State
├── authStore          // 认证与用户信息
│   ├── user
│   ├── tokens
│   └── isAuthenticated
├── postStore          // 帖子数据
│   ├── posts[]        // 列表
│   ├── detailCache{}  // 详情缓存
│   └── filters        // 当前筛选条件
├── messageStore       // 消息数据
│   ├── conversations[]
│   ├── unreadCounts{}
│   └── currentMessages[]
├── followStore        // 关注关系
│   └── statusCache{}
└── uiStore            // UI 状态（可选）
    ├── theme          // 主题模式
    ├── networkStatus  // 网络状态
    └── toastQueue     // 提示队列
```

---

## 四、错误处理与拦截器

### API 拦截器设计

```typescript
// 请求拦截器
api.interceptors.request.use((config) => {
  const token = authStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const { config, response } = error;

    // Token 过期，尝试刷新
    if (response?.status === 401 && !config._retry) {
      config._retry = true;
      const refreshed = await authStore.getState().refreshAuth();
      if (refreshed) {
        config.headers.Authorization = `Bearer ${authStore.getState().accessToken}`;
        return api(config);
      }
      // 刷新失败，跳转登录
      authStore.getState().clearAuth();
      return Promise.reject(error);
    }

    // 429 频率限制
    if (response?.status === 429) {
      // 显示提示，稍后重试
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);
```

---

## 五、SQL 迁移脚本汇总

以下是需要新增的完整建表脚本（可直接追加到 `schema.sql`）：

```sql
-- 收藏表
CREATE TABLE IF NOT EXISTS bookmarks (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  post_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_post (user_id, post_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (post_id) REFERENCES posts(id),
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='收藏表';

-- 关注关系表
CREATE TABLE IF NOT EXISTS follows (
  id VARCHAR(36) PRIMARY KEY,
  follower_id VARCHAR(36) NOT NULL,
  following_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_follow (follower_id, following_id),
  FOREIGN KEY (follower_id) REFERENCES users(id),
  FOREIGN KEY (following_id) REFERENCES users(id),
  INDEX idx_follower (follower_id),
  INDEX idx_following (following_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='关注关系表';

-- 会话表
CREATE TABLE IF NOT EXISTS conversations (
  id VARCHAR(36) PRIMARY KEY,
  user1_id VARCHAR(36) NOT NULL,
  user2_id VARCHAR(36) NOT NULL,
  last_message_id VARCHAR(36),
  last_message_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_conversation (user1_id, user2_id),
  FOREIGN KEY (user1_id) REFERENCES users(id),
  FOREIGN KEY (user2_id) REFERENCES users(id),
  INDEX idx_user1 (user1_id),
  INDEX idx_user2 (user2_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='会话表';

-- 消息表
CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR(36) PRIMARY KEY,
  conversation_id VARCHAR(36) NOT NULL,
  sender_id VARCHAR(36) NOT NULL,
  content TEXT NOT NULL,
  message_type ENUM('text', 'image', 'system') DEFAULT 'text',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id),
  FOREIGN KEY (sender_id) REFERENCES users(id),
  INDEX idx_conversation (conversation_id, created_at),
  INDEX idx_sender (sender_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='消息表';

-- 未读消息计数表
CREATE TABLE IF NOT EXISTS unread_counts (
  user_id VARCHAR(36) NOT NULL,
  conversation_id VARCHAR(36) NOT NULL,
  count INT DEFAULT 0,
  PRIMARY KEY (user_id, conversation_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='未读消息计数表';

-- 用户表扩展字段
ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NOT NULL AFTER username;
ALTER TABLE users ADD COLUMN gender ENUM('male', 'female', 'unknown') DEFAULT 'unknown';
ALTER TABLE users ADD COLUMN birthday DATE;
ALTER TABLE users ADD COLUMN city VARCHAR(50);
ALTER TABLE users ADD COLUMN followers_count INT DEFAULT 0;
ALTER TABLE users ADD COLUMN following_count INT DEFAULT 0;
ALTER TABLE users ADD COLUMN posts_count INT DEFAULT 0;
```
