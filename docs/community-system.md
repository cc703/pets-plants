# 萌宠星球 - 社区系统需求文档与实现方案

> 项目: pet-planet (Expo React Native v56 + Express + MySQL)
> 版本: 1.0
> 日期: 2026-05-27

---

## 一、现状分析

当前 `app/(tabs)/community.tsx` 已有基础社区框架，包含:

- 品种圈子横向滚动展示（硬编码 4 个圈子）
- 帖子列表（热门/最新切换，硬编码 3 条帖子）
- 点赞动画（Animated 序列）
- 收藏切换
- 发帖弹窗（文字 + 标签，无图片上传）
- 评论弹窗（一级评论，无二级回复）
- 全部数据为本地 state，无后端接口对接

后端 `server/index.js` 仅有品种相关 API（Express + mysql2），无社区相关接口。

---

## 二、功能需求分析

### 2.1 帖子发布

| 子功能 | 优先级 | 说明 |
|--------|--------|------|
| 纯文字发帖 | P0 | 支持 1-2000 字，自动过滤敏感词 |
| 图片上传 | P0 | 最多 9 张，支持拍照/相册，自动压缩至 1080px 宽 |
| 标签系统 | P0 | 用户自定义标签 + 系统推荐标签，最多 5 个 |
| 话题关联 | P1 | 关联品种圈子或官方话题 |
| @提及用户 | P2 | 发帖时可 @其他用户，触发通知 |
| 定位信息 | P2 | 可选附加地理位置 |
| 草稿箱 | P2 | 本地保存未完成的帖子 |

### 2.2 帖子浏览

| 子功能 | 优先级 | 说明 |
|--------|--------|------|
| 列表模式（当前已有） | P0 | 单列卡片流，展示文字摘要 |
| 瀑布流模式 | P1 | 双列瀑布流，图片帖子优先展示 |
| 热门排序 | P0 | 基于点赞+评论+时间的热度算法 |
| 最新排序 | P0 | 按发布时间倒序 |
| 关注排序 | P1 | 仅展示关注用户的帖子 |
| 圈子筛选 | P1 | 按品种圈子过滤帖子流 |
| 标签搜索 | P1 | 点击标签查看相关帖子 |
| 下拉刷新 + 上拉加载 | P0 | 复用 `useInfiniteScroll` hook |

### 2.3 评论系统

| 子功能 | 优先级 | 说明 |
|--------|--------|------|
| 一级评论 | P0 | 当前已有基础版本，需对接后端 |
| 二级评论（回复） | P0 | 对一级评论进行回复，展示 "回复 @用户名" |
| 评论点赞 | P1 | 独立于帖子点赞 |
| 评论排序 | P1 | 最新/最热两种排序 |
| 评论删除 | P0 | 仅限本人或帖子作者 |
| 评论举报 | P1 | 长按评论弹出举报选项 |

### 2.4 点赞 / 收藏

| 子功能 | 优先级 | 说明 |
|--------|--------|------|
| 帖子点赞 | P0 | 当前已有动画，需持久化到后端 |
| 帖子收藏 | P0 | 当前已有切换，需持久化到后端 |
| 点赞列表 | P1 | 查看谁点赞了帖子 |
| 收藏夹分组 | P2 | 用户自定义收藏夹分类 |

### 2.5 用户关注 / 粉丝

| 子功能 | 优先级 | 说明 |
|--------|--------|------|
| 关注用户 | P0 | 点击用户头像进入主页，点击关注 |
| 取消关注 | P0 | 关注状态下再次点击取消 |
| 粉丝列表 | P1 | 查看自己的粉丝 |
| 关注列表 | P1 | 查看自己关注的人 |
| 互相关注标识 | P1 | 列表中显示 "互关" 标签 |
| 关注动态流 | P1 | 仅展示关注用户的帖子 |

### 2.6 私信系统

| 子功能 | 优先级 | 说明 |
|--------|--------|------|
| 一对一聊天 | P1 | 文字消息，实时送达 |
| 图片消息 | P2 | 聊天中发送图片 |
| 消息已读状态 | P1 | 显示已读/未读 |
| 会话列表 | P1 | 按最后消息时间排序 |
| 未读消息角标 | P1 | Tab 栏显示未读数 |
| 消息通知 | P1 | 本地推送通知（expo-notifications） |

### 2.7 举报 / 审核

| 子功能 | 优先级 | 说明 |
|--------|--------|------|
| 帖子举报 | P0 | 选择举报原因，提交审核 |
| 评论举报 | P1 | 同上 |
| 用户举报 | P2 | 举报用户主页 |
| 自动内容审核 | P1 | 接入第三方文本/图片审核 API |
| 人工审核后台 | P2 | 管理员审核队列 |

---

## 三、技术方案设计

### 3.1 数据模型设计

#### 用户表 (users) - 已有基础，扩展社区字段

```sql
ALTER TABLE users ADD COLUMN bio VARCHAR(200) DEFAULT '' COMMENT '个人简介';
ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500) DEFAULT '' COMMENT '头像URL';
ALTER TABLE users ADD COLUMN post_count INT DEFAULT 0 COMMENT '帖子数';
ALTER TABLE users ADD COLUMN follower_count INT DEFAULT 0 COMMENT '粉丝数';
ALTER TABLE users ADD COLUMN following_count INT DEFAULT 0 COMMENT '关注数';
ALTER TABLE users ADD COLUMN like_count INT DEFAULT 0 COMMENT '获赞总数';
ALTER TABLE users ADD COLUMN is_banned TINYINT(1) DEFAULT 0 COMMENT '是否封禁';
ALTER TABLE users ADD COLUMN ban_reason VARCHAR(200) DEFAULT '' COMMENT '封禁原因';
```

#### 帖子表 (posts)

```sql
CREATE TABLE posts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL COMMENT '作者ID',
  content TEXT NOT NULL COMMENT '帖子内容（纯文字，最多2000字）',
  images JSON DEFAULT NULL COMMENT '图片URL数组，最多9张',
  tags JSON DEFAULT NULL COMMENT '标签数组，最多5个',
  circle_id BIGINT UNSIGNED DEFAULT NULL COMMENT '关联品种圈子ID',
  topic_id BIGINT UNSIGNED DEFAULT NULL COMMENT '关联话题ID',
  location VARCHAR(100) DEFAULT '' COMMENT '位置信息',
  like_count INT UNSIGNED DEFAULT 0,
  comment_count INT UNSIGNED DEFAULT 0,
  bookmark_count INT UNSIGNED DEFAULT 0,
  share_count INT UNSIGNED DEFAULT 0,
  is_pinned TINYINT(1) DEFAULT 0 COMMENT '是否置顶',
  is_hidden TINYINT(1) DEFAULT 0 COMMENT '是否隐藏（审核不通过）',
  status ENUM('published','pending','rejected','deleted') DEFAULT 'published',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_created (created_at),
  INDEX idx_hot (like_count, comment_count, created_at),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### 评论表 (comments) - 支持两级评论

```sql
CREATE TABLE comments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  post_id BIGINT UNSIGNED NOT NULL COMMENT '所属帖子ID',
  user_id BIGINT UNSIGNED NOT NULL COMMENT '评论者ID',
  parent_id BIGINT UNSIGNED DEFAULT NULL COMMENT '父评论ID（NULL为一级评论）',
  reply_to_user_id BIGINT UNSIGNED DEFAULT NULL COMMENT '被回复的用户ID（二级评论）',
  content VARCHAR(500) NOT NULL COMMENT '评论内容',
  like_count INT UNSIGNED DEFAULT 0,
  is_hidden TINYINT(1) DEFAULT 0,
  status ENUM('published','pending','rejected','deleted') DEFAULT 'published',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_post (post_id, created_at),
  INDEX idx_parent (parent_id),
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### 点赞表 (likes)

```sql
CREATE TABLE likes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  target_id BIGINT UNSIGNED NOT NULL COMMENT '帖子ID或评论ID',
  target_type ENUM('post','comment') NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_target (user_id, target_id, target_type),
  INDEX idx_target (target_id, target_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### 收藏表 (bookmarks)

```sql
CREATE TABLE bookmarks (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  post_id BIGINT UNSIGNED NOT NULL,
  folder_id BIGINT UNSIGNED DEFAULT NULL COMMENT '收藏夹ID',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_post (user_id, post_id),
  INDEX idx_user (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### 关注关系表 (follows)

```sql
CREATE TABLE follows (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  follower_id BIGINT UNSIGNED NOT NULL COMMENT '关注者ID',
  following_id BIGINT UNSIGNED NOT NULL COMMENT '被关注者ID',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_follow (follower_id, following_id),
  INDEX idx_following (following_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### 私信会话表 (conversations)

```sql
CREATE TABLE conversations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_a_id BIGINT UNSIGNED NOT NULL,
  user_b_id BIGINT UNSIGNED NOT NULL,
  last_message_id BIGINT UNSIGNED DEFAULT NULL,
  last_message_at DATETIME DEFAULT NULL,
  a_unread_count INT UNSIGNED DEFAULT 0,
  b_unread_count INT UNSIGNED DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_users (LEAST(user_a_id, user_b_id), GREATEST(user_a_id, user_b_id)),
  INDEX idx_user_a (user_a_id, last_message_at),
  INDEX idx_user_b (user_b_id, last_message_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### 私信消息表 (messages)

```sql
CREATE TABLE messages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  conversation_id BIGINT UNSIGNED NOT NULL,
  sender_id BIGINT UNSIGNED NOT NULL,
  content VARCHAR(2000) DEFAULT '' COMMENT '文字内容',
  image_url VARCHAR(500) DEFAULT '' COMMENT '图片消息',
  message_type ENUM('text','image','system') DEFAULT 'text',
  is_read TINYINT(1) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_conversation (conversation_id, created_at),
  INDEX idx_sender (sender_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### 品种圈子表 (circles)

```sql
CREATE TABLE circles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL COMMENT '圈子名称',
  emoji VARCHAR(10) NOT NULL,
  breed_id VARCHAR(50) DEFAULT NULL COMMENT '关联品种ID',
  member_count INT UNSIGNED DEFAULT 0,
  post_count INT UNSIGNED DEFAULT 0,
  description VARCHAR(200) DEFAULT '',
  cover_url VARCHAR(500) DEFAULT '',
  is_active TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_active (is_active, member_count)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### 举报表 (reports)

```sql
CREATE TABLE reports (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reporter_id BIGINT UNSIGNED NOT NULL COMMENT '举报者ID',
  target_id BIGINT UNSIGNED NOT NULL,
  target_type ENUM('post','comment','user') NOT NULL,
  reason ENUM('spam','abuse','false_info','violence','other') NOT NULL,
  description VARCHAR(500) DEFAULT '' COMMENT '补充说明',
  status ENUM('pending','resolved','dismissed') DEFAULT 'pending',
  admin_note VARCHAR(500) DEFAULT '' COMMENT '管理员备注',
  resolved_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_status (status, created_at),
  INDEX idx_target (target_id, target_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### 通知表 (notifications)

```sql
CREATE TABLE notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL COMMENT '接收者ID',
  actor_id BIGINT UNSIGNED DEFAULT NULL COMMENT '触发者ID',
  type ENUM('like','comment','follow','mention','system','reply') NOT NULL,
  target_id BIGINT UNSIGNED DEFAULT NULL,
  target_type ENUM('post','comment','user') DEFAULT NULL,
  content VARCHAR(200) DEFAULT '' COMMENT '系统通知内容',
  is_read TINYINT(1) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id, is_read, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 3.2 ER 关系图

```
users 1──N posts         (一个用户发多篇帖子)
users 1──N comments      (一个用户发多条评论)
posts 1──N comments      (一篇帖子有多条评论)
comments 1──N comments   (一级评论下有二级回复，parent_id 自引用)
users N──N users          (通过 follows 表实现多对多关注)
users N──N posts          (通过 likes 表实现多对多点赞)
users N──N posts          (通过 bookmarks 表实现多对多收藏)
users N──N users          (通过 conversations + messages 实现私信)
circles 1──N posts        (一个圈子有多篇帖子)
```

### 3.3 后端 API 设计

在 `server/index.js` 中新增以下路由，遵循现有 Express + mysql2 风格。

#### 帖子相关

```
GET    /api/posts                    # 获取帖子列表（分页、排序、圈子筛选）
GET    /api/posts/:id                # 获取帖子详情
POST   /api/posts                    # 发布帖子
PUT    /api/posts/:id                # 编辑帖子
DELETE /api/posts/:id                # 删除帖子（软删除）
POST   /api/posts/:id/like           # 点赞/取消点赞
POST   /api/posts/:id/bookmark       # 收藏/取消收藏
GET    /api/posts/:id/likes          # 获取点赞用户列表
GET    /api/users/:id/posts          # 获取某用户的帖子列表
```

#### 评论相关

```
GET    /api/posts/:id/comments       # 获取帖子评论列表（分页）
POST   /api/posts/:id/comments       # 发表评论
DELETE /api/comments/:id             # 删除评论
POST   /api/comments/:id/like        # 评论点赞/取消
```

#### 用户关系

```
POST   /api/users/:id/follow         # 关注/取消关注
GET    /api/users/:id/followers      # 粉丝列表
GET    /api/users/:id/following      # 关注列表
```

#### 私信相关

```
GET    /api/conversations            # 会话列表
POST   /api/conversations            # 创建/获取与某用户的会话
GET    /api/conversations/:id/messages  # 消息列表
POST   /api/conversations/:id/messages  # 发送消息
PUT    /api/conversations/:id/read    # 标记已读
```

#### 通知相关

```
GET    /api/notifications            # 通知列表
PUT    /api/notifications/:id/read   # 标记单条已读
PUT    /api/notifications/read-all   # 全部已读
GET    /api/notifications/unread-count # 未读数量
```

#### 举报相关

```
POST   /api/reports                  # 提交举报
```

#### 图片上传

```
POST   /api/upload/image             # 上传图片，返回URL
```

### 3.4 实时消息方案

**推荐方案: 长轮询 (Long Polling)**

理由:
- 项目当前无 WebSocket 依赖，引入 `socket.io` 增加包体积和复杂度
- 私信场景对实时性要求不极端（非游戏/交易），秒级延迟可接受
- Expo 环境下 WebSocket 连接管理较复杂（后台切换、网络切换）

实现策略:

```
1. 私信页面: 每 3 秒轮询 GET /api/conversations/:id/messages?since=<last_message_id>
2. 会话列表: 每 10 秒轮询 GET /api/conversations?since=<last_update_time>
3. 通知角标: 每 15 秒轮询 GET /api/notifications/unread-count
4. 页面不可见时暂停轮询（AppState 监听）
```

**后期可升级为 WebSocket:**

如用户量增长需更高实时性，可渐进式引入 `socket.io`:

```bash
npm install socket.io socket.io-client
```

服务端在现有 Express 上挂载:

```js
const { Server } = require('socket.io');
const http = require('http');
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

io.on('connection', (socket) => {
  socket.on('join', (userId) => socket.join(`user:${userId}`));
  socket.on('sendMessage', (data) => {
    io.to(`user:${data.toUserId}`).emit('newMessage', data);
  });
});
```

客户端使用 `socket.io-client`，在消息发送/接收时通过 socket 通信，降级方案为轮询。

### 3.5 图片上传方案

**技术选型:**

| 方案 | 优点 | 缺点 | 推荐 |
|------|------|------|------|
| 服务端直传 (Multer) | 简单，无第三方依赖 | 占用服务器带宽和存储 | MVP 阶段 |
| OSS 直传 (阿里云/腾讯云) | 不占服务端资源，CDN 加速 | 需配置 OSS，有成本 | 生产阶段 |
| expo-image-picker + 服务端 | 与现有 Expo 生态一致 | - | 推荐 |

**MVP 阶段实现:**

前端:
```typescript
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

// 选择图片
const pickImages = async () => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: 9,
    quality: 0.8,
  });

  if (!result.canceled) {
    // 压缩图片
    const compressed = await Promise.all(
      result.assets.map(asset =>
        ImageManipulator.manipulateAsync(asset.uri,
          [{ resize: { width: 1080 } }],
          { compress: 0.7, format: 'jpeg' }
        )
      )
    );
    // 上传
    const urls = await Promise.all(compressed.map(uploadImage));
    setImages(urls);
  }
};

const uploadImage = async (image: { uri: string }) => {
  const formData = new FormData();
  formData.append('image', {
    uri: image.uri,
    type: 'image/jpeg',
    name: `post_${Date.now()}.jpg`,
  } as any);
  const res = await fetch(`${API_BASE}/api/upload/image`, {
    method: 'POST',
    body: formData,
  });
  const data = await res.json();
  return data.url;
};
```

后端 (Multer):
```js
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: './uploads/images',
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}_${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('仅支持图片格式'));
  },
});

app.post('/api/upload/image', upload.single('image'), (req, res) => {
  res.json({ url: `/uploads/images/${req.file.filename}` });
});

// 静态文件服务
app.use('/uploads', express.static('uploads'));
```

**新增依赖:**

```bash
cd server && npm install multer
cd .. && npx expo install expo-image-picker expo-image-manipulator
```

### 3.6 内容审核方案

**文本审核:**

| 方案 | 适用阶段 | 说明 |
|------|----------|------|
| 本地敏感词库 | MVP | 维护一份敏感词列表，发帖/评论前前端+后端双重过滤 |
| 阿里云内容安全 | 生产 | 调用 `green` API，支持文本+图片审核 |
| 腾讯云天御 | 生产 | 备选方案，接口类似 |

MVP 本地审核实现:

```js
// server/utils/moderation.js
const sensitiveWords = require('./sensitive-words.json'); // 维护敏感词列表

function checkContent(text) {
  const lower = text.toLowerCase();
  const matched = sensitiveWords.filter(word => lower.includes(word));
  if (matched.length > 0) {
    return { pass: false, reason: `包含违规内容: ${matched[0]}` };
  }
  return { pass: true };
}

// 在发帖和评论接口中调用
app.post('/api/posts', async (req, res) => {
  const { content, images, tags } = req.body;
  const check = checkContent(content);
  if (!check.pass) {
    return res.status(400).json({ error: check.reason });
  }
  // ... 存储帖子，status 设为 'published'
});
```

**图片审核:**

MVP 阶段仅做文件类型和大小校验。生产阶段接入阿里云图片审核:

```js
const Green = require('@alicloud/green20220302');

async function checkImage(imageUrl) {
  const client = new Green({ /* credentials */ });
  const result = await client.imageModeration({ imageUrl, scenes: ['porn', 'ad'] });
  return result.suggestion === 'pass';
}
```

**审核流程:**

```
用户发布 -> 自动文本审核 -> 通过? -> status='published' -> 展示
                       -> 不通过? -> status='pending' -> 进入人工审核队列
                                                    -> 用户收到 "内容审核中" 提示
```

---

## 四、前端目录结构设计

在现有 `app/` 和 `src/` 结构基础上新增文件:

```
src/
  types/
    index.ts                    # 新增社区相关类型定义
  services/
    api.ts                      # API 请求封装（baseURL、token 拦截器）
    postService.ts              # 帖子相关接口
    commentService.ts           # 评论相关接口
    userService.ts              # 用户关系接口
    messageService.ts           # 私信接口
    uploadService.ts            # 图片上传接口
    notificationService.ts     # 通知接口
  hooks/
    useInfiniteScroll.ts        # 已有，社区页面复用
    usePolling.ts               # 新增：通用轮询 hook
    useMessages.ts              # 新增：私信数据管理
    useNotifications.ts         # 新增：通知数据管理
  components/
    community/
      PostCard.tsx              # 帖子卡片组件
      PostCardSkeleton.tsx      # 帖子骨架屏
      CommentSheet.tsx          # 评论底部弹窗（替代当前 Modal）
      CommentItem.tsx           # 单条评论组件
      ReplyInput.tsx            # 回复输入框
      ImageGrid.tsx             # 九宫格图片展示
      ImageViewer.tsx           # 图片全屏预览
      TagInput.tsx              # 标签输入组件
      UserAvatar.tsx            # 用户头像组件（含等级徽章）
      FollowButton.tsx          # 关注按钮组件
      ReportSheet.tsx           # 举报底部弹窗
      EmptyState.tsx            # 空状态占位组件
  screens/
    PostDetailScreen.tsx        # 帖子详情页
    CreatePostScreen.tsx        # 发帖页面（独立页面，非弹窗）
    UserProfileScreen.tsx       # 用户主页
    FollowersScreen.tsx         # 粉丝/关注列表
    ConversationListScreen.tsx  # 私信会话列表
    ChatScreen.tsx              # 聊天页面
    NotificationScreen.tsx      # 通知列表页面

app/
  (tabs)/
    community.tsx               # 重构为社区主页（圈子 + 帖子流）
  community/
    post/[id].tsx               # 帖子详情路由
    create.tsx                  # 发帖页面路由
    user/[id].tsx               # 用户主页路由
    user/[id]/followers.tsx     # 粉丝列表路由
    user/[id]/following.tsx     # 关注列表路由
  messages/
    index.tsx                   # 会话列表路由
    [id].tsx                    # 聊天页面路由
  notifications/
    index.tsx                   # 通知列表路由
```

---

## 五、TypeScript 类型扩展

在 `src/types/index.ts` 中新增以下类型:

```typescript
// ==================== 社区系统类型 ====================

/** 用户基础信息 */
export interface UserBasic {
  id: string;
  nickname: string;
  avatarUrl: string;
  level: number;
  bio: string;
  postCount: number;
  followerCount: number;
  followingCount: number;
  likeCount: number;
}

/** 社区帖子（完整版） */
export interface Post {
  id: string;
  user: UserBasic;
  content: string;
  images: string[];
  tags: string[];
  circleId?: string;
  location?: string;
  likeCount: number;
  commentCount: number;
  bookmarkCount: number;
  isLiked: boolean;
  isBookmarked: boolean;
  status: 'published' | 'pending' | 'rejected' | 'deleted';
  createdAt: string;
}

/** 评论（支持两级） */
export interface Comment {
  id: string;
  postId: string;
  user: UserBasic;
  parentId: string | null;
  replyToUser?: UserBasic;
  content: string;
  likeCount: number;
  isLiked: boolean;
  replies?: Comment[];
  replyCount: number;
  createdAt: string;
}

/** 点赞记录 */
export interface LikeRecord {
  id: string;
  user: UserBasic;
  createdAt: string;
}

/** 关注关系 */
export interface FollowRelation {
  id: string;
  user: UserBasic;
  isMutual: boolean;
  createdAt: string;
}

/** 私信会话 */
export interface Conversation {
  id: string;
  otherUser: UserBasic;
  lastMessage: Message;
  unreadCount: number;
  lastMessageAt: string;
}

/** 私信消息 */
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  imageUrl?: string;
  messageType: 'text' | 'image' | 'system';
  isRead: boolean;
  createdAt: string;
}

/** 通知 */
export interface Notification {
  id: string;
  actor?: UserBasic;
  type: 'like' | 'comment' | 'follow' | 'mention' | 'system' | 'reply';
  targetId?: string;
  targetType?: 'post' | 'comment' | 'user';
  content?: string;
  isRead: boolean;
  createdAt: string;
}

/** 举报请求 */
export interface ReportPayload {
  targetId: string;
  targetType: 'post' | 'comment' | 'user';
  reason: 'spam' | 'abuse' | 'false_info' | 'violence' | 'other';
  description?: string;
}

/** 通知数量 */
export interface UnreadCounts {
  notifications: number;
  messages: number;
}
```

---

## 六、UI/UX 设计方案

### 6.1 设计原则

- 复用现有 `theme.ts` 中的 Colors、Spacing、BorderRadius、FontSize、Shadows
- 沿用 `SafeAreaView` + `ScrollView` + `Modal` 的页面模式
- 图标统一使用 `@expo/vector-icons` 的 Ionicons
- 动画使用 `react-native-reanimated`（已安装）替代 `Animated`，性能更优

### 6.2 帖子卡片布局 (PostCard)

```
┌──────────────────────────────────────┐
│ [头像] 用户名 Lv.X     [更多按钮]   │
│         3分钟前                      │
│                                      │
│ 帖子内容文字（最多显示 3 行，       │
│ 超出显示 "展开" 按钮）...           │
│                                      │
│ ┌──────┐ ┌──────┐ ┌──────┐          │
│ │ 图片 │ │ 图片 │ │ 图片 │  九宫格  │
│ │  1   │ │  2   │ │  3   │          │
│ └──────┘ └──────┘ └──────┘          │
│                                      │
│ #标签1  #标签2  #标签3               │
│                                      │
│ ──────────────────────────────────── │
│ [❤ 128]  [💬 12]  [🔖 收藏]         │
└──────────────────────────────────────┘
```

关键实现要点:
- 卡片使用 `CardStyles.flat` 样式（白色背景 + 轻阴影）
- 图片 1 张时全宽圆角，2 张并排，3-9 张九宫格
- 点赞动画使用 `react-native-reanimated` 的 `withSpring`
- 标签行使用 `flexWrap: 'wrap'` 自动换行
- 长文本超过 3 行折叠，点击 "展开" 显示全文

### 6.3 帖子详情页

```
┌──────────────────────────────────────┐
│ [返回]  帖子详情         [分享][更多]│
├──────────────────────────────────────┤
│                                      │
│ [头像] 用户名 Lv.X     [关注按钮]   │
│         3分钟前                      │
│                                      │
│ 完整帖子内容...                      │
│                                      │
│ [图片全宽展示，可左右滑动]           │
│                                      │
│ #标签1  #标签2  #标签3               │
│                                      │
│ ──────────────────────────────────── │
│ [❤ 128]  [💬 12]  [🔖 收藏]         │
│                                      │
│ ──────────────────────────────────── │
│ 评论 (12)           [最新 ▼]         │
│                                      │
│ [头像] 用户A Lv.5    2分钟前         │
│ 评论内容文字...                      │
│  ❤ 5  回复                          │
│                                      │
│   [头像] 用户B 回复 用户A            │
│   回复内容...                        │
│                                      │
│ [头像] 用户C Lv.3    5分钟前         │
│ 评论内容文字...                      │
│                                      │
├──────────────────────────────────────┤
│ [评论输入框...            ] [发送]   │
└──────────────────────────────────────┘
```

实现要点:
- 使用 `app/community/post/[id].tsx` 作为独立页面路由
- 评论列表使用 `FlatList` 组件，支持分页加载
- 二级评论默认折叠，点击 "展开回复" 显示
- 底部输入框使用 `KeyboardAvoidingView` 适配键盘弹出
- 回复某条评论时，输入框 placeholder 变为 "回复 @用户名"

### 6.4 发帖页面

```
┌──────────────────────────────────────┐
│ [取消]  发布动态         [发布按钮]  │
├──────────────────────────────────────┤
│                                      │
│ 分享你和宠物的故事...               │
│ (多行输入框)                         │
│                                      │
│ [图片1] [图片2] [图片3] [+]         │
│ (横向滚动，最多9张)                  │
│                                      │
│ ──────────────────────────────────── │
│                                      │
│ 选择圈子 (可选):                     │
│ [布偶圈] [英短圈] [柯基圈] [金毛圈] │
│                                      │
│ 添加标签:                            │
│ [#布偶猫] [#体检] [+添加]           │
│                                      │
│ ──────────────────────────────────── │
│ [📷 图片] [📍 位置] [👤 @提及]      │
│                                      │
└──────────────────────────────────────┘
```

实现要点:
- 从弹窗 (Modal) 升级为独立页面，体验更好
- 图片选择使用 `expo-image-picker`，预览使用 `ImageGrid` 组件
- 圈子选择使用横向 `ScrollView`，选中高亮
- 标签输入支持自动补全（基于历史标签和热门标签）

### 6.5 用户主页

```
┌──────────────────────────────────────┐
│ [返回]  用户主页                     │
├──────────────────────────────────────┤
│                                      │
│       [大头像]                       │
│       用户名 Lv.X                    │
│       个人简介                       │
│                                      │
│   [关注]  [私信]                     │
│                                      │
│ ┌─────────┬─────────┬─────────┐     │
│ │  帖子   │  粉丝   │  关注   │     │
│ │   28    │  1.2k   │  356    │     │
│ └─────────┴─────────┴─────────┘     │
│                                      │
│ [帖子] [收藏] [关于]                │
│ ──────────────────────────────────── │
│                                      │
│ [帖子卡片1]                          │
│ [帖子卡片2]                          │
│ [帖子卡片3]                          │
│ ...                                  │
└──────────────────────────────────────┘
```

实现要点:
- 路由: `app/community/user/[id].tsx`
- 顶部大头像使用 `LinearGradient` 背景装饰（沿用 profile.tsx 风格）
- 关注/私信按钮：如果是自己则显示 "编辑资料"
- Tab 切换帖子/收藏/关于，使用自定义 Tab 组件
- 帖子列表复用 `PostCard` 组件

### 6.6 私信会话列表

```
┌──────────────────────────────────────┐
│ [返回]  私信                         │
├──────────────────────────────────────┤
│                                      │
│ [搜索框: 搜索联系人...]              │
│                                      │
│ [头像] 用户A Lv.8                    │
│         最后一条消息预览...    3分钟 │
│         🔴 3                         │
│ ──────────────────────────────────── │
│ [头像] 用户B Lv.5                    │
│         图片消息              1小时  │
│ ──────────────────────────────────── │
│ [头像] 用户C Lv.12                   │
│         好的，知道了！         昨天  │
│ ──────────────────────────────────── │
│ ...                                  │
└──────────────────────────────────────┘
```

### 6.7 聊天页面

```
┌──────────────────────────────────────┐
│ [返回]  用户名          [更多按钮]   │
├──────────────────────────────────────┤
│                                      │
│            [今天 14:30]              │
│                                      │
│ 你好呀！请问你家布偶多大了？         │
│ [头像]                    14:31  ✓✓ │
│                                      │
│                        3个月了～ [头像]│
│              ✓✓ 14:32                │
│                                      │
│ 好可爱！我家也有一只                 │
│ [头像]                    14:33  ✓   │
│                                      │
├──────────────────────────────────────┤
│ [表情] [输入框...        ] [+] [发送]│
└──────────────────────────────────────┘
```

实现要点:
- 消息气泡：自己发的靠右（主色调背景），对方发的靠左（白色背景）
- 已读状态: ✓ 发送成功，✓✓ 已读
- 使用 `FlatList` 的 `inverted` 属性实现消息从底部向上排列
- 键盘弹出时自动滚动到底部

### 6.8 通知列表

```
┌──────────────────────────────────────┐
│ [返回]  消息通知         [全部已读]  │
├──────────────────────────────────────┤
│                                      │
│ [头像] 猫奴小王 赞了你的帖子        │
│        3分钟前                       │
│        > 帖子内容预览...             │
│ ──────────────────────────────────── │
│ [头像] 养狗达人 关注了你            │
│        1小时前                       │
│ ──────────────────────────────────── │
│ [头像] 金毛妈妈 评论了你的帖子      │
│        2小时前                       │
│        > 评论内容: 好可爱的金毛！   │
│ ──────────────────────────────────── │
│ 🔔 系统通知                         │
│        你的帖子已通过审核            │
│        5小时前                       │
└──────────────────────────────────────┘
```

### 6.9 举报弹窗

```
┌──────────────────────────────────────┐
│              举报                    │
├──────────────────────────────────────┤
│                                      │
│ 请选择举报原因:                      │
│                                      │
│ ○ 垃圾广告/营销                      │
│ ○ 辱骂/骚扰/仇恨                     │
│ ○ 虚假信息                           │
│ ○ 暴力/血腥内容                      │
│ ○ 其他                               │
│                                      │
│ 补充说明 (选填):                     │
│ [输入框...]                          │
│                                      │
│         [取消]  [提交举报]           │
└──────────────────────────────────────┘
```

---

## 七、分阶段实施计划

### 第一阶段 - MVP (1-2 周)

目标: 基础社区功能可跑通

后端:
- [ ] 创建 posts、comments、likes、bookmarks 四张表
- [ ] 实现帖子 CRUD API
- [ ] 实现评论 CRUD API
- [ ] 实现点赞/收藏 API
- [ ] 实现图片上传 API (Multer 本地存储)

前端:
- [ ] 新增 `src/services/api.ts` 请求封装
- [ ] 新增 `src/services/postService.ts`、`commentService.ts`
- [ ] 新增 `PostCard.tsx`、`CommentSheet.tsx`、`ImageGrid.tsx` 组件
- [ ] 重构 `community.tsx` 对接后端 API
- [ ] 新增 `app/community/post/[id].tsx` 帖子详情页
- [ ] 新增 `app/community/create.tsx` 发帖页面
- [ ] 替换硬编码数据为 API 调用
- [ ] 集成 `expo-image-picker` + `expo-image-manipulator`

依赖安装:
```bash
# 后端
cd server && npm install multer

# 前端
npx expo install expo-image-picker expo-image-manipulator
```

### 第二阶段 - 社交功能 (1-2 周)

目标: 用户关系和互动

后端:
- [ ] 创建 follows、notifications 表
- [ ] 实现关注/取消关注 API
- [ ] 实现粉丝/关注列表 API
- [ ] 实现通知 API
- [ ] 实现用户主页帖子列表 API

前端:
- [ ] 新增 `src/services/userService.ts`
- [ ] 新增 `FollowButton.tsx`、`UserAvatar.tsx` 组件
- [ ] 新增 `app/community/user/[id].tsx` 用户主页
- [ ] 新增 `app/community/user/[id]/followers.tsx` 粉丝/关注列表
- [ ] 新增 `app/notifications/index.tsx` 通知页面
- [ ] Tab 栏 "社区" 图标显示未读角标
- [ ] 实现二级评论（回复功能）

依赖安装:
```bash
npx expo install expo-notifications
```

### 第三阶段 - 私信系统 (1 周)

目标: 基础私信功能

后端:
- [ ] 创建 conversations、messages 表
- [ ] 实现会话和消息 API
- [ ] 实现标记已读 API

前端:
- [ ] 新增 `src/services/messageService.ts`
- [ ] 新增 `src/hooks/usePolling.ts`
- [ ] 新增 `app/messages/index.tsx` 会话列表
- [ ] 新增 `app/messages/[id].tsx` 聊天页面
- [ ] Tab 栏 "消息" Tab 项 + 未读角标

### 第四阶段 - 审核与优化 (1 周)

目标: 内容安全和体验优化

后端:
- [ ] 创建 reports 表
- [ ] 实现举报 API
- [ ] 集成本地敏感词过滤
- [ ] 帖子发布时自动审核

前端:
- [ ] 新增 `ReportSheet.tsx` 举报弹窗
- [ ] 瀑布流模式实现
- [ ] 骨架屏加载状态
- [ ] 空状态占位图
- [ ] 性能优化（FlatList 优化、图片懒加载）

---

## 八、路由配置更新

在 `app/_layout.tsx` 中新增社区子页面路由:

```tsx
<Stack>
  <Stack.Screen name="(tabs)" />
  <Stack.Screen name="breed/[id]" options={{ animation: 'slide_from_right' }} />
  {/* 社区子页面 */}
  <Stack.Screen name="community/post/[id]" options={{ animation: 'slide_from_right' }} />
  <Stack.Screen name="community/create" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
  <Stack.Screen name="community/user/[id]" options={{ animation: 'slide_from_right' }} />
  <Stack.Screen name="community/user/[id]/followers" options={{ animation: 'slide_from_right' }} />
  <Stack.Screen name="community/user/[id]/following" options={{ animation: 'slide_from_right' }} />
  <Stack.Screen name="messages/index" options={{ animation: 'slide_from_right' }} />
  <Stack.Screen name="messages/[id]" options={{ animation: 'slide_from_right' }} />
  <Stack.Screen name="notifications/index" options={{ animation: 'slide_from_right' }} />
</Stack>
```

---

## 九、Tab 栏调整

更新 `app/(tabs)/_layout.tsx`，新增消息 Tab:

```tsx
<Tabs.Screen name="messages" options={{
  title: '消息',
  tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles" size={size} color={color} />,
  tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
}} />
```

调整后 Tab 顺序: 首页 | 百科 | AI顾问 | 社区 | 消息 | 我的

---

## 十、关键注意事项

1. **分页一致性**: 所有列表接口统一使用 `page` + `pageSize` 参数，响应格式为 `{ data: T[], total: number, page: number }`

2. **错误处理**: `src/services/api.ts` 统一拦截 401（跳登录）、403（提示封禁）、500（通用错误提示）

3. **乐观更新**: 点赞/收藏/关注操作使用乐观更新（先更新 UI，失败则回滚），提升交互流畅度

4. **图片缓存**: 使用 `expo-image`（Expo 内置）替代 `Image` 组件，自带磁盘缓存

5. **敏感信息**: `.env` 中配置 OSS 密钥、审核 API Key，不要硬编码

6. **数据库索引**: 已在建表 SQL 中标注关键索引，帖子列表查询走 `(status, created_at)` 或 `(status, like_count, comment_count, created_at)` 复合索引

7. **软删除**: 帖子和评论使用 `status='deleted'` 而非物理删除，保留数据完整性

8. **计数器维护**: `like_count`、`comment_count`、`follower_count` 等使用数据库触发器或应用层同步更新，避免 COUNT 查询性能问题
