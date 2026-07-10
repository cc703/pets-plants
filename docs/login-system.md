# 萌宠星球 - 登录系统需求文档与实现方案

> 项目: pet-planet (Expo SDK 56 + React Native 0.85.3)
> 日期: 2026-05-27
> 状态: 设计阶段

---

## 一、项目现状分析

### 1.1 现有架构

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端框架 | Expo SDK 56 + React Native 0.85.3 | 已有完整 Tab 导航 |
| 路由 | expo-router ~56.2.7 | 文件系统路由, (tabs) 布局 |
| 后端 | Express.js 5.2.1 + MySQL | 已有品种 API, 无认证 |
| 设计系统 | 自定义 theme.ts | 薄荷绿主色 #6EC89B, 杏仁橘辅色 #F4A261 |

### 1.2 现有数据库用户表 (schema.sql 已存在)

```sql
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(100),
  avatar_url VARCHAR(500),
  nickname VARCHAR(50),
  bio VARCHAR(200),
  preferences JSON,
  level INT DEFAULT 1,
  points INT DEFAULT 0,
  status ENUM('active', 'banned', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP,
  INDEX idx_username (username),
  INDEX idx_phone (phone)
);
```

**问题**: 现有 users 表缺少 `password_hash`、`email_verified`、`phone_verified`、第三方登录字段、refresh_token 等认证必要字段。需要扩展。

### 1.3 现有 Profile 页面状态

当前 `app/(tabs)/profile.tsx` 使用硬编码的模拟数据, 没有登录状态判断, 没有与后端交互。需要改造为: 未登录显示登录引导, 已登录显示个人资料。

---

## 二、功能需求分析

### 2.1 用户注册

| 注册方式 | 优先级 | 说明 |
|----------|--------|------|
| 手机号 + 短信验证码 | P0 | 中国大陆手机号, 6位验证码, 60秒重发 |
| 邮箱 + 密码 | P0 | 邮箱格式校验, 密码强度要求, 邮箱验证链接 |
| 用户名 + 密码 | P1 | 最简注册方式, 作为备选 |
| 微信登录 | P1 | OAuth2.0, 需要微信开放平台审核 |
| Apple 登录 | P2 | iOS 必须提供, Sign in with Apple |

**注册流程**:

```
选择注册方式
  |
  +-- 手机号注册: 输入手机号 -> 发送验证码 -> 输入验证码 -> 设置昵称 -> 完成
  |
  +-- 邮箱注册: 输入邮箱+密码 -> 发送验证邮件 -> 点击链接激活 -> 完成
  |
  +-- 第三方登录: 授权 -> 获取头像昵称 -> 补充资料(可选) -> 完成
```

### 2.2 用户登录

| 登录方式 | 优先级 | 说明 |
|----------|--------|------|
| 手机号 + 密码 | P0 | 标准登录 |
| 手机号 + 短信验证码 | P0 | 免密登录 |
| 邮箱 + 密码 | P0 | 标准登录 |
| 生物识别 (指纹/Face ID) | P1 | expo-local-authentication |
| 微信登录 | P1 | 与注册共用 OAuth 流程 |

**登录流程**:

```
输入凭据
  |
  +-- 密码登录: 验证凭据 -> 签发 JWT -> 存储 Token -> 跳转首页
  |
  +-- 验证码登录: 输入手机号 -> 发送验证码 -> 验证 -> 签发 JWT -> 跳转首页
  |
  +-- 生物识别: 读取本地存储的 Token -> 刷新 Token -> 跳转首页
```

### 2.3 个人资料管理

| 功能 | 说明 |
|------|------|
| 头像上传 | 从相册选择或拍照, 裁剪压缩后上传 |
| 昵称修改 | 2-20字符, 不允许特殊字符 |
| 个性签名 | 最多100字符 |
| 手机号绑定/换绑 | 需要验证新旧手机号 |
| 邮箱绑定/换绑 | 需要验证新旧邮箱 |

### 2.4 Token 认证与会话管理

| 项目 | 方案 |
|------|------|
| 认证方式 | JWT (Access Token + Refresh Token) |
| Access Token | 有效期 2 小时, 存内存 |
| Refresh Token | 有效期 30 天, 存 SecureStore |
| Token 刷新 | Access Token 过期时自动用 Refresh Token 刷新 |
| 多设备管理 | 每个设备独立 Refresh Token, 支持远程登出 |
| 会话保持 | 应用重启后自动恢复登录状态 |

### 2.5 忘记密码 / 重置密码

```
选择找回方式
  |
  +-- 手机号找回: 输入手机号 -> 验证码 -> 设置新密码 -> 完成
  |
  +-- 邮箱找回: 输入邮箱 -> 发送重置链接 -> 点击链接 -> 设置新密码 -> 完成
```

---

## 三、技术方案设计

### 3.1 前端状态管理方案: React Context + useReducer

**选型理由**:

- 项目当前规模不需要 Zustand/Redux 的重量级方案
- 认证状态是全局性的, Context 天然适合
- useReducer 提供可预测的状态转换
- 与 expo-router 的布局系统天然兼容 (在 _layout.tsx 中包裹 Provider)

**状态结构**:

```typescript
// src/contexts/AuthContext.tsx

interface User {
  id: string;
  username: string;
  nickname: string;
  avatarUrl: string | null;
  phone: string | null;
  email: string | null;
  bio: string;
  level: number;
  points: number;
  createdAt: string;
}

interface AuthState {
  // 认证状态
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
  user: User | null;
  accessToken: string | null;

  // 错误状态
  error: string | null;
}

type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: { user: User; accessToken: string } }
  | { type: 'AUTH_FAILURE'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'UPDATE_USER'; payload: Partial<User> }
  | { type: 'CLEAR_ERROR' }
  | { type: 'TOKEN_REFRESHED'; payload: string };
```

**Context 提供的方法**:

```typescript
interface AuthContextValue extends AuthState {
  // 认证方法
  loginWithPhone: (phone: string, password: string) => Promise<void>;
  loginWithSms: (phone: string, code: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  loginWithBiometric: () => Promise<void>;
  register: (params: RegisterParams) => Promise<void>;
  logout: () => Promise<void>;

  // 密码管理
  sendSmsCode: (phone: string, type: 'login' | 'register' | 'reset') => Promise<void>;
  resetPassword: (params: ResetPasswordParams) => Promise<void>;

  // 资料管理
  updateProfile: (params: UpdateProfileParams) => Promise<void>;
  uploadAvatar: (uri: string) => Promise<string>;

  // 工具方法
  clearError: () => void;
  refreshAccessToken: () => Promise<void>;
}
```

### 3.2 认证流程设计: JWT 双 Token 机制

**Token 生命周期**:

```
登录成功
  |
  +-- 返回 Access Token (2h) + Refresh Token (30d)
  |
  +-- Access Token 存内存 (AuthContext state)
  |   Refresh Token 存 expo-secure-store
  |
  +-- 每次 API 请求携带 Authorization: Bearer <access_token>
  |
  +-- Access Token 过期 (401)
  |     |
  |     +-- 自动用 Refresh Token 请求新 Access Token
  |     |     |
  |     |     +-- 成功: 更新内存中的 Access Token, 重试原请求
  |     |     +-- 失败 (Refresh Token 也过期): 清除状态, 跳转登录
  |     |
  |     +-- 并发请求队列: 等待刷新完成后统一重试
  |
  +-- 应用重启
        |
        +-- 从 SecureStore 读取 Refresh Token
        +-- 尝试刷新 Access Token
        +-- 成功: 恢复登录状态
        +-- 失败: 进入未登录状态
```

**API 请求拦截器设计**:

```typescript
// src/services/apiClient.ts

class ApiClient {
  private accessToken: string | null = null;
  private refreshPromise: Promise<string> | null = null;

  async request<T>(config: RequestConfig): Promise<T> {
    // 1. 注入 Access Token
    if (this.accessToken) {
      config.headers.Authorization = `Bearer ${this.accessToken}`;
    }

    try {
      const response = await fetch(config.url, config);
      return response.json();
    } catch (error) {
      if (error.status === 401) {
        // 2. 尝试刷新 Token
        const newToken = await this.refreshAccessToken();
        config.headers.Authorization = `Bearer ${newToken}`;
        // 3. 重试原请求
        const retryResponse = await fetch(config.url, config);
        return retryResponse.json();
      }
      throw error;
    }
  }

  private async refreshAccessToken(): Promise<string> {
    // 防止并发刷新: 多个 401 同时触发时共享同一个刷新请求
    if (!this.refreshPromise) {
      this.refreshPromise = this.doRefresh().finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
  }

  private async doRefresh(): Promise<string> {
    const refreshToken = await SecureStore.getItemAsync('refresh_token');
    if (!refreshToken) throw new AuthError('No refresh token');

    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      await SecureStore.deleteItemAsync('refresh_token');
      throw new AuthError('Refresh failed');
    }

    const { accessToken } = await response.json();
    this.accessToken = accessToken;
    return accessToken;
  }
}
```

### 3.3 本地存储方案: expo-secure-store

**存储策略**:

| 数据 | 存储位置 | 原因 |
|------|----------|------|
| Refresh Token | expo-secure-store | 加密存储, 防止明文泄露 |
| 用户基础信息 (缓存) | AsyncStorage | 非敏感, 用于离线展示 |
| 生物识别凭据 | expo-secure-store | 加密存储, 配合 expo-local-authentication |
| 登录配置 (记住我) | AsyncStorage | 非敏感偏好设置 |

**关键依赖** (需要安装):

```json
{
  "expo-secure-store": "~14.0.0",
  "expo-local-authentication": "~16.0.0",
  "@react-native-async-storage/async-storage": "~2.1.0"
}
```

### 3.4 API 接口设计

**基础路径**: `/api/auth`

#### 3.4.1 注册接口

```
POST /api/auth/register
Content-Type: application/json

请求体:
{
  "method": "phone" | "email" | "username",
  "phone": "13800138000",        // method=phone 时必填
  "email": "user@example.com",   // method=email 时必填
  "username": "petlover",        // method=username 时必填
  "password": "Abc123456",       // method=email/username 时必填
  "smsCode": "123456",           // method=phone 时必填
  "nickname": "萌宠爱好者"       // 可选
}

成功响应 (201):
{
  "code": 0,
  "data": {
    "user": { "id": "uuid", "nickname": "...", ... },
    "accessToken": "eyJhbG...",
    "refreshToken": "dGhpcyBp..."
  }
}

错误响应 (400/409):
{
  "code": 40001,
  "message": "该手机号已注册"
}
```

#### 3.4.2 登录接口

```
POST /api/auth/login
Content-Type: application/json

请求体:
{
  "method": "password" | "sms" | "biometric",
  "phone": "13800138000",
  "email": "user@example.com",
  "password": "Abc123456",       // method=password 时必填
  "smsCode": "123456"            // method=sms 时必填
}

成功响应 (200):
{
  "code": 0,
  "data": {
    "user": { "id": "uuid", "nickname": "...", ... },
    "accessToken": "eyJhbG...",
    "refreshToken": "dGhpcyBp..."
  }
}
```

#### 3.4.3 发送短信验证码

```
POST /api/auth/sms/send
Content-Type: application/json

请求体:
{
  "phone": "13800138000",
  "type": "login" | "register" | "reset"
}

成功响应 (200):
{
  "code": 0,
  "data": { "expiresIn": 60 }
}
```

#### 3.4.4 刷新 Token

```
POST /api/auth/refresh
Content-Type: application/json

请求体:
{
  "refreshToken": "dGhpcyBp..."
}

成功响应 (200):
{
  "code": 0,
  "data": {
    "accessToken": "eyJhbG...(新)",
    "refreshToken": "dGhpcyBp...(可选, 轮转刷新)"
  }
}
```

#### 3.4.5 登出

```
POST /api/auth/logout
Authorization: Bearer <accessToken>

请求体 (可选):
{
  "refreshToken": "dGhpcyBp...",
  "allDevices": false
}

成功响应 (200):
{
  "code": 0,
  "message": "已登出"
}
```

#### 3.4.6 获取当前用户信息

```
GET /api/auth/me
Authorization: Bearer <accessToken>

成功响应 (200):
{
  "code": 0,
  "data": {
    "id": "uuid",
    "username": "petlover",
    "nickname": "萌宠爱好者",
    "avatarUrl": "https://...",
    "phone": "138****8000",
    "email": "u***@example.com",
    "bio": "热爱毛茸茸的小动物",
    "level": 1,
    "points": 0,
    "createdAt": "2026-05-27T00:00:00Z"
  }
}
```

#### 3.4.7 更新个人资料

```
PUT /api/auth/profile
Authorization: Bearer <accessToken>
Content-Type: application/json

请求体:
{
  "nickname": "新昵称",
  "bio": "新的个性签名",
  "avatarUrl": "https://..."
}

成功响应 (200):
{
  "code": 0,
  "data": { ...更新后的用户对象 }
}
```

#### 3.4.8 重置密码

```
POST /api/auth/password/reset
Content-Type: application/json

请求体:
{
  "method": "phone" | "email",
  "phone": "13800138000",
  "email": "user@example.com",
  "smsCode": "123456",           // method=phone 时必填
  "resetToken": "abc123",        // method=email 时, 从链接中获取
  "newPassword": "NewPass123"
}

成功响应 (200):
{
  "code": 0,
  "message": "密码重置成功"
}
```

---

## 四、前端文件结构设计

### 4.1 新增文件清单

```
src/
  contexts/
    AuthContext.tsx              # 认证状态 Context + Provider + useAuth hook

  services/
    apiClient.ts                # HTTP 客户端, Token 自动注入/刷新
    authApi.ts                  # 认证相关 API 封装

  hooks/
    useAuth.ts                  # (可选) 从 Context 拆出的便捷 hook

  screens/                      # 或直接放在 app/ 下 (expo-router)
    auth/
      LoginScreen.tsx           # 登录页面
      RegisterScreen.tsx        # 注册页面
      ForgotPasswordScreen.tsx  # 忘记密码页面
      VerifyCodeScreen.tsx      # 验证码输入页面 (复用于注册/登录/重置)

  components/
    auth/
      AuthGuard.tsx             # 路由守卫, 未登录时重定向
      PhoneInput.tsx            # 手机号输入组件 (带国家代码选择)
      PasswordInput.tsx         # 密码输入组件 (带显隐切换)
      SmsCodeButton.tsx         # 短信验证码按钮 (带倒计时)
      SocialLoginButtons.tsx    # 第三方登录按钮组
      BiometricPrompt.tsx       # 生物识别提示组件
      AvatarPicker.tsx          # 头像选择/裁剪组件

app/
  (auth)/
    _layout.tsx                 # 认证页面布局 (无 Tab Bar)
    login.tsx                   # 登录路由
    register.tsx                # 注册路由
    forgot-password.tsx         # 忘记密码路由
    verify-code.tsx             # 验证码路由

  (tabs)/
    profile.tsx                 # [改造] 根据登录状态显示不同内容
```

### 4.2 路由结构变更

```
app/
  _layout.tsx                   # [改造] 包裹 AuthProvider
  (auth)/                       # [新增] 认证页面组
    _layout.tsx                 # 认证页面栈布局
    login.tsx
    register.tsx
    forgot-password.tsx
    verify-code.tsx
  (tabs)/
    _layout.tsx                 # [不变]
    index.tsx                   # [不变]
    wiki.tsx                    # [不变]
    ai.tsx                      # [改造] 登录后可保存对话历史
    community.tsx               # [改造] 登录后才能发帖/评论
    profile.tsx                 # [改造] 未登录显示登录引导
```

---

## 五、UI/UX 设计规范

### 5.1 设计原则

- 与现有萌宠星球主题保持一致 (薄荷绿 #6EC89B 为主色)
- 圆角卡片风格, 统一使用 BorderRadius.lg (16px)
- 交互反馈: 按钮按下缩放 0.96, 渐入动画
- 错误提示: 红色文字 + 图标, 不使用弹窗 (内联显示)
- 加载状态: 骨架屏 / ActivityIndicator, 禁用按钮防止重复提交

### 5.2 登录页面布局

```
+------------------------------------------+
|  [SafeAreaView]                           |
|                                           |
|     [Logo]  萌宠星球                       |
|     [Subtitle]  欢迎回来                    |
|                                           |
|  +--------------------------------------+ |
|  |  [Tab Switcher]                       | |
|  |  手机号登录  |  邮箱登录               | |
|  +--------------------------------------+ |
|                                           |
|  [PhoneInput / EmailInput]                |
|  +--------------------------------------+ |
|  |  +86  请输入手机号                     | |
|  +--------------------------------------+ |
|                                           |
|  [PasswordInput]                          |
|  +--------------------------------------+ |
|  |  请输入密码              [显隐图标]     | |
|  +--------------------------------------+ |
|                                           |
|  [忘记密码?]                  (右对齐链接)  |
|                                           |
|  [登录按钮]  (薄荷绿, 全宽, 圆角)          |
|  +--------------------------------------+ |
|  |            登  录                     | |
|  +--------------------------------------+ |
|                                           |
|  ---- 或 ----                             |
|                                           |
|  [短信验证码登录]  (次级按钮)               |
|  [微信登录]       (第三方按钮)              |
|                                           |
|  [注册引导]  还没有账号？立即注册            |
|                                           |
+------------------------------------------+
```

**交互细节**:

- Tab 切换使用滑动动画, 与 wiki 页面的 speciesTabs 风格一致
- 输入框获得焦点时边框变为 primary + '40' 透明度
- 登录按钮: loading 时显示 ActivityIndicator, 禁用点击
- 错误信息显示在对应输入框下方, 红色文字
- "忘记密码" 链接跳转到 forgot-password 路由

### 5.3 注册页面布局

```
+------------------------------------------+
|  [< 返回]          创建账号                 |
|                                           |
|  [Step Indicator]  1 --- 2 --- 3          |
|                                           |
|  Step 1: 选择注册方式                       |
|  +--------------------------------------+ |
|  |  [手机号注册]   [邮箱注册]             | |
|  +--------------------------------------+ |
|                                           |
|  Step 2: 输入凭据 + 验证                    |
|  +--------------------------------------+ |
|  |  手机号输入框                          | |
|  |  [获取验证码] 按钮 (60秒倒计时)        | |
|  |  验证码输入框 (6位分格输入)            | |
|  +--------------------------------------+ |
|                                           |
|  Step 3: 设置密码 + 昵称                    |
|  +--------------------------------------+ |
|  |  密码输入框 (带强度指示器)             | |
|  |  确认密码输入框                        | |
|  |  昵称输入框                            | |
|  +--------------------------------------+ |
|                                           |
|  [注册按钮]                                |
|                                           |
|  已有账号？去登录                           |
+------------------------------------------+
```

**密码强度指示器**:

```
弱  [===            ]  红色   (< 6位, 纯数字)
中  [=========      ]  橙色   (6-8位, 含字母)
强  [===============]  绿色   (8位+, 含大小写+数字)
```

### 5.4 忘记密码页面布局

```
+------------------------------------------+
|  [< 返回]          重置密码                 |
|                                           |
|  [说明文字]                                |
|  选择找回方式，我们将帮助你重置密码          |
|                                           |
|  +--------------------------------------+ |
|  |  [Tab]  手机号找回 | 邮箱找回          | |
|  +--------------------------------------+ |
|                                           |
|  手机号输入框                              |
|  验证码输入框 + [获取验证码]                |
|  新密码输入框                              |
|  确认新密码输入框                           |
|                                           |
|  [重置密码按钮]                            |
+------------------------------------------+
```

### 5.5 个人资料页面 (改造后)

**未登录状态**:

```
+------------------------------------------+
|  个人中心                  [设置]          |
|                                           |
|  +--------------------------------------+ |
|  |  [大头像占位]                         | |
|  |  登录萌宠星球                         | |
|  |  登录后享受完整功能                    | |
|  |                                       | |
|  |  [登录/注册按钮]                      | |
|  +--------------------------------------+ |
|                                           |
|  (以下为游客可浏览的内容)                   |
|  - 品种百科入口                            |
|  - 关于我们                               |
|  - 设置 (语言/主题)                        |
+------------------------------------------+
```

**已登录状态** (与现有布局基本一致, 但数据从 API 获取):

```
+------------------------------------------+
|  个人中心                  [设置]          |
|                                           |
|  [真实头像]  昵称                          |
|  Lv.1 · 注册 N 天                         |
|  个性签名                                 |
|                                           |
|  [金币]  [经验]  [收集进度]                |
|                                           |
|  升级进度条                               |
|                                           |
|  我的宠物卡片                             |
|  菜单列表 (收藏/集卡/成就...)              |
|  成就进度                                 |
+------------------------------------------+
```

### 5.6 错误处理与加载状态

**错误提示组件** (内联, 非弹窗):

```typescript
// 输入框下方的错误提示
<View style={styles.errorRow}>
  <Ionicons name="alert-circle" size={14} color={Colors.error} />
  <Text style={styles.errorText}>手机号格式不正确</Text>
</View>
```

**全局错误** (网络断开等):

复用现有的 `NetworkBanner` 组件, 在顶部显示红色横幅。

**加载状态**:

```typescript
// 按钮加载态
<TouchableOpacity
  style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
  disabled={isLoading}
  onPress={handleLogin}
>
  {isLoading ? (
    <ActivityIndicator color={Colors.surface} size="small" />
  ) : (
    <Text style={styles.submitBtnText}>登 录</Text>
  )}
</TouchableOpacity>
```

---

## 六、后端实现方案

### 6.1 数据库表结构扩展

```sql
-- 扩展 users 表 (ALTER 语句)
ALTER TABLE users
  ADD COLUMN password_hash VARCHAR(255) AFTER username,
  ADD COLUMN email_verified BOOLEAN DEFAULT FALSE AFTER email,
  ADD COLUMN phone_verified BOOLEAN DEFAULT FALSE AFTER phone,
  ADD COLUMN avatar_key VARCHAR(255) COMMENT '对象存储key' AFTER avatar_url,
  ADD COLUMN wechat_openid VARCHAR(100) UNIQUE AFTER bio,
  ADD COLUMN wechat_unionid VARCHAR(100),
  ADD COLUMN apple_user_id VARCHAR(100) UNIQUE,
  ADD COLUMN login_method VARCHAR(20) DEFAULT 'password' COMMENT '最近登录方式',
  ADD COLUMN password_changed_at TIMESTAMP NULL,
  ADD COLUMN deleted_at TIMESTAMP NULL;

-- 刷新 Token 表
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  token_hash VARCHAR(255) NOT NULL COMMENT 'SHA256(refresh_token)',
  device_info JSON COMMENT '设备信息: platform, model, os_version',
  ip_address VARCHAR(45),
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP NULL,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id),
  INDEX idx_token (token_hash),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='刷新Token表';

-- 短信验证码表
CREATE TABLE IF NOT EXISTS sms_codes (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  code VARCHAR(6) NOT NULL,
  type ENUM('login', 'register', 'reset') NOT NULL,
  attempts INT DEFAULT 0 COMMENT '已验证尝试次数',
  max_attempts INT DEFAULT 5,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_phone_type (phone, type),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='短信验证码表';

-- 密码重置令牌表 (邮箱找回用)
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token (token_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='密码重置令牌表';
```

### 6.2 后端路由扩展 (server/index.js)

```
/api/auth/
  POST   /register          # 注册
  POST   /login             # 登录
  POST   /logout            # 登出 (需认证)
  POST   /refresh           # 刷新 Token
  POST   /sms/send          # 发送短信验证码
  POST   /sms/verify        # 验证短信验证码
  GET    /me                # 获取当前用户信息 (需认证)
  PUT    /profile           # 更新个人资料 (需认证)
  POST   /password/reset    # 重置密码
  POST   /avatar/upload     # 上传头像 (需认证)

/api/users/:id
  GET    /                  # 获取用户公开信息
```

### 6.3 后端认证中间件

```javascript
// server/middleware/auth.js
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '2h';

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ code: 40100, message: '未登录' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ code: 40101, message: 'Token已过期' });
    }
    return res.status(401).json({ code: 40102, message: 'Token无效' });
  }
}

// 可选认证: 已登录则注入 userId, 未登录也放行
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(authHeader.slice(7), JWT_SECRET);
      req.userId = payload.sub;
    } catch {}
  }
  next();
}
```

### 6.4 安全措施

| 措施 | 实现方式 |
|------|----------|
| 密码哈希 | bcrypt, cost factor 12 |
| JWT 签名 | HS256, 密钥从环境变量读取 |
| Refresh Token 存储 | 数据库只存 SHA256 哈希 |
| 短信防刷 | 同一手机号 60秒内只能发一次, 每日上限 10 条 |
| 验证码防暴力 | 最多 5 次尝试, 超过后作废重新发送 |
| 登录失败锁定 | 同一账号连续 5 次失败, 锁定 15 分钟 |
| CORS | 仅允许已知域名 |
| Rate Limiting | express-rate-limit, 登录接口 10次/分钟 |
| SQL 注入 | mysql2 参数化查询 (已有) |

---

## 七、实施计划与阶段划分

### Phase 1: 基础认证 (1-2周)

**目标**: 完成手机号/邮箱 + 密码注册登录, JWT 认证

**前端**:
- [ ] 安装依赖: expo-secure-store, @react-native-async-storage/async-storage
- [ ] 创建 `src/contexts/AuthContext.tsx` - 认证状态管理
- [ ] 创建 `src/services/apiClient.ts` - HTTP 客户端 + Token 管理
- [ ] 创建 `src/services/authApi.ts` - 认证 API 封装
- [ ] 创建 `app/(auth)/_layout.tsx` - 认证页面布局
- [ ] 创建 `app/(auth)/login.tsx` - 登录页面
- [ ] 创建 `app/(auth)/register.tsx` - 注册页面
- [ ] 改造 `app/_layout.tsx` - 包裹 AuthProvider
- [ ] 改造 `app/(tabs)/profile.tsx` - 登录/未登录双态

**后端**:
- [ ] 扩展 users 表 (password_hash 等字段)
- [ ] 创建 refresh_tokens 表, sms_codes 表
- [ ] 安装依赖: jsonwebtoken, bcrypt
- [ ] 实现 `/api/auth/register`
- [ ] 实现 `/api/auth/login`
- [ ] 实现 `/api/auth/refresh`
- [ ] 实现 `/api/auth/logout`
- [ ] 实现 `/api/auth/me`
- [ ] 实现 authMiddleware

### Phase 2: 短信验证 + 密码重置 (1周)

**前端**:
- [ ] 创建 `src/components/auth/SmsCodeButton.tsx` - 验证码倒计时按钮
- [ ] 创建 `src/components/auth/PasswordInput.tsx` - 密码输入组件
- [ ] 改造登录页面支持短信验证码登录
- [ ] 创建 `app/(auth)/forgot-password.tsx` - 忘记密码页面
- [ ] 创建 `app/(auth)/verify-code.tsx` - 验证码页面

**后端**:
- [ ] 实现 `/api/auth/sms/send` (接入短信服务商)
- [ ] 实现 `/api/auth/sms/verify`
- [ ] 实现 `/api/auth/password/reset`
- [ ] 创建 password_reset_tokens 表

### Phase 3: 个人资料 + 头像上传 (1周)

**前端**:
- [ ] 创建 `src/components/auth/AvatarPicker.tsx` - 头像选择组件
- [ ] 改造 profile 页面支持编辑资料
- [ ] 实现资料编辑弹窗/页面

**后端**:
- [ ] 实现 `/api/auth/profile` (PUT)
- [ ] 实现 `/api/auth/avatar/upload`
- [ ] 接入对象存储 (OSS/S3) 或本地文件存储

### Phase 4: 第三方登录 + 生物识别 (1-2周)

**前端**:
- [ ] 安装 expo-local-authentication
- [ ] 创建 `src/components/auth/BiometricPrompt.tsx`
- [ ] 创建 `src/components/auth/SocialLoginButtons.tsx`
- [ ] 实现微信登录流程 (expo-auth-session)
- [ ] 实现 Apple 登录 (expo-apple-authentication)

**后端**:
- [ ] 实现微信 OAuth 回调
- [ ] 实现 Apple Sign In 验证
- [ ] 扩展 users 表支持第三方 ID

### Phase 5: 优化与安全加固 (持续)

- [ ] Token 自动刷新的并发处理
- [ ] 网络重连后自动恢复认证状态
- [ ] 登录历史记录
- [ ] 设备管理 (远程登出)
- [ ] 账号注销功能
- [ ] 安全审计日志

---

## 八、依赖清单

### 8.1 新增 npm 依赖 (前端)

```bash
npx expo install expo-secure-store
npx expo install @react-native-async-storage/async-storage
npx expo install expo-local-authentication    # Phase 4
npx expo install expo-image-picker            # 头像选择
npx expo install expo-auth-session            # 第三方登录
npx expo install expo-crypto                  # Token 哈希
npx expo install expo-apple-authentication    # Phase 4, Apple 登录
```

### 8.2 新增 npm 依赖 (后端)

```bash
cd server
npm install jsonwebtoken bcrypt express-rate-limit uuid
npm install multer  # 文件上传 (头像)
```

---

## 九、关键代码示例

### 9.1 AuthContext Provider (核心)

```typescript
// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { authApi } from '../services/authApi';
import { apiClient } from '../services/apiClient';

const REFRESH_TOKEN_KEY = 'pet_planet_refresh_token';
const USER_CACHE_KEY = 'pet_planet_user_cache';

// ... (状态类型和 Reducer 如上文 3.1 节定义)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // 应用启动时恢复登录状态
  useEffect(() => {
    restoreSession();
  }, []);

  const restoreSession = async () => {
    dispatch({ type: 'AUTH_START' });
    try {
      const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      if (!refreshToken) {
        dispatch({ type: 'AUTH_FAILURE', payload: '' });
        return;
      }
      const { accessToken, user } = await authApi.refreshToken(refreshToken);
      apiClient.setAccessToken(accessToken);
      dispatch({ type: 'AUTH_SUCCESS', payload: { user, accessToken } });
    } catch {
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      dispatch({ type: 'AUTH_FAILURE', payload: '' });
    }
  };

  const loginWithPhone = useCallback(async (phone: string, password: string) => {
    dispatch({ type: 'AUTH_START' });
    try {
      const result = await authApi.login({ method: 'password', phone, password });
      await handleAuthResult(result);
    } catch (error: any) {
      dispatch({ type: 'AUTH_FAILURE', payload: error.message });
    }
  }, []);

  const handleAuthResult = async (result: AuthResult) => {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, result.refreshToken);
    apiClient.setAccessToken(result.accessToken);
    dispatch({ type: 'AUTH_SUCCESS', payload: { user: result.user, accessToken: result.accessToken } });
  };

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {}
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    apiClient.setAccessToken(null);
    dispatch({ type: 'LOGOUT' });
  }, []);

  const value = {
    ...state,
    loginWithPhone,
    loginWithSms,
    loginWithEmail,
    register,
    logout,
    sendSmsCode,
    resetPassword,
    updateProfile,
    uploadAvatar,
    clearError: () => dispatch({ type: 'CLEAR_ERROR' }),
    refreshAccessToken: restoreSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
```

### 9.2 AuthGuard 路由守卫

```typescript
// src/components/auth/AuthGuard.tsx
import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading' || status === 'idle') return;

    const inAuthGroup = segments[0] === '(auth)';

    if (status === 'unauthenticated' && !inAuthGroup) {
      // 未登录但不在认证页面, 某些页面需要保护
      // profile 页面不需要强制跳转, 可以展示游客模式
      // community 的发帖功能在组件内部处理
    } else if (status === 'authenticated' && inAuthGroup) {
      // 已登录但在认证页面, 跳转首页
      router.replace('/(tabs)');
    }
  }, [status, segments]);

  return <>{children}</>;
}
```

### 9.3 登录页面核心结构

```typescript
// app/(auth)/login.tsx
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../src/contexts/AuthContext';
import { Colors, Spacing, BorderRadius, FontSize, Shadows } from '../../src/utils/theme';
import PhoneInput from '../../src/components/auth/PhoneInput';
import PasswordInput from '../../src/components/auth/PasswordInput';

export default function LoginPage() {
  const router = useRouter();
  const { loginWithPhone, loginWithSms, status, error, clearError } = useAuth();
  const [loginMethod, setLoginMethod] = useState<'password' | 'sms'>('password');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const isLoading = status === 'loading';

  const handleLogin = useCallback(async () => {
    if (loginMethod === 'password') {
      await loginWithPhone(phone, password);
    } else {
      await loginWithSms(phone, smsCode);
    }
  }, [loginMethod, phone, password, smsCode, loginWithPhone, loginWithSms]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Logo */}
        <View style={styles.logoSection}>
          <View style={styles.logoIcon}>
            <Ionicons name="paw" size={32} color={Colors.primary} />
          </View>
          <Text style={styles.appName}>萌宠星球</Text>
          <Text style={styles.welcomeText}>欢迎回来</Text>
        </View>

        {/* 登录方式切换 */}
        <View style={styles.methodTabs}>
          <TouchableOpacity
            style={[styles.methodTab, loginMethod === 'password' && styles.methodTabActive]}
            onPress={() => setLoginMethod('password')}
          >
            <Text style={[styles.methodTabText, loginMethod === 'password' && styles.methodTabTextActive]}>
              密码登录
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.methodTab, loginMethod === 'sms' && styles.methodTabActive]}
            onPress={() => setLoginMethod('sms')}
          >
            <Text style={[styles.methodTabText, loginMethod === 'sms' && styles.methodTabTextActive]}>
              验证码登录
            </Text>
          </TouchableOpacity>
        </View>

        {/* 表单 */}
        <View style={styles.form}>
          <PhoneInput value={phone} onChangeText={setPhone} />
          {loginMethod === 'password' ? (
            <PasswordInput value={password} onChangeText={setPassword} placeholder="请输入密码" />
          ) : (
            <SmsCodeInput value={smsCode} onChangeText={setSmsCode} phone={phone} type="login" />
          )}

          {error && (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={14} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {loginMethod === 'password' && (
            <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')}>
              <Text style={styles.forgotLink}>忘记密码？</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.loginBtn, isLoading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={isLoading ? [Colors.border, Colors.border] : [Colors.primary, Colors.primaryDark]}
              style={styles.loginBtnGradient}
            >
              {isLoading ? (
                <ActivityIndicator color={Colors.surface} />
              ) : (
                <Text style={styles.loginBtnText}>登 录</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* 注册引导 */}
        <View style={styles.registerSection}>
          <Text style={styles.registerHint}>还没有账号？</Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
            <Text style={styles.registerLink}>立即注册</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
```

### 9.4 Profile 页面改造 (登录/未登录双态)

```typescript
// app/(tabs)/profile.tsx 改造思路
export default function ProfilePage() {
  const { status, user, logout } = useAuth();

  if (status === 'unauthenticated') {
    return <GuestProfileView />;  // 未登录: 显示登录引导
  }

  if (status === 'loading') {
    return <ProfileSkeleton />;   // 加载中: 骨架屏
  }

  return <UserProfileView user={user} />;  // 已登录: 显示个人信息
}
```

---

## 十、风险与注意事项

| 风险 | 影响 | 应对措施 |
|------|------|----------|
| 短信服务商接入延迟 | 注册/登录功能受阻 | 先支持邮箱注册, 手机号作为 P1 |
| 微信开放平台审核周期长 | 微信登录延期 | 微信登录放到 Phase 4, 不阻塞核心功能 |
| SecureStore 在 Web 端不可用 | Web 端无法安全存储 Token | Web 端 fallback 到 httpOnly Cookie |
| JWT Secret 泄露 | 所有 Token 失效 | 定期轮换密钥, 支持密钥版本化 |
| 密码暴力破解 | 账号安全 | Rate limiting + 失败锁定 + 验证码 |
| 并发 Token 刷新 | 多个请求同时触发刷新 | 刷新锁 (refreshPromise) 机制 |

---

## 附录: 与现有代码的集成点

1. **`app/_layout.tsx`**: 在 ErrorBoundary 内层包裹 `<AuthProvider>` 和 `<AuthGuard>`
2. **`app/(tabs)/profile.tsx`**: 导入 `useAuth`, 根据 `status` 渲染不同视图
3. **`app/(tabs)/community.tsx`**: 发帖/评论前检查登录状态, 未登录弹出登录引导
4. **`app/(tabs)/ai.tsx`**: 登录后可保存聊天历史到服务器
5. **`src/utils/theme.ts`**: 复用所有现有设计 Token, 不新增颜色
6. **`src/types/index.ts`**: 新增 User 相关类型定义
7. **`server/index.js`**: 新增 `/api/auth/*` 路由, 新增 authMiddleware
8. **`server/schema.sql`**: 扩展 users 表, 新增 refresh_tokens / sms_codes 表
