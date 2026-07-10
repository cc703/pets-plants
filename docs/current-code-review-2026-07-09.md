# 萌宠星球当前项目代码审核评估

审核日期：2026-07-09  
审核范围：当前工作区代码、前后端主流程、数据库初始化脚本、验证脚本与本机运行状态  
审核角色：宠物软件产品开发视角 + 代码质量 / 安全 / 架构评估  

## 一、结论摘要

当前项目已经具备较完整的宠物社区类 App 雏形：注册登录、知识百科、社区发帖评论、圈子、收藏、积分签到、私信、AI 问答、虚拟宠物等主功能已经形成页面、服务层和后端接口闭环。前端 Expo Web 可以正常启动，后端 Express API 可以正常启动，MySQL 数据库联通后，服务端主流程和 UI smoke 均已通过。

综合评估：项目已达到“可演示、可联调、可继续完善 MVP”的阶段，但尚未达到“可直接生产上线”的标准。主要风险集中在密钥管理、数据库 schema 版本漂移、部分 mock/本地存储逻辑残留、生产安全防护不足、初始化流程不够可重复。

最终建议：COMMENT / 有条件通过。可以继续作为课程设计、演示或 MVP 迭代基础；若准备上线或提交正式验收，需要优先处理 HIGH 与 MEDIUM 项。

## 二、当前验证结果

| 验证项 | 结果 | 说明 |
| --- | --- | --- |
| TypeScript 类型检查 | 通过 | `npm.cmd run typecheck` 无报错 |
| 数据库摘要 | 通过 | `npm.cmd run db:summary` 可读取 users/posts/comments/bookmarks/circles |
| 服务端 smoke | 通过 | `61 通过, 0 失败` |
| UI smoke | 通过 | 完成注册、发帖、评论、加入圈子、收藏、收藏可见 |
| 前端启动 | 通过 | Expo Web: `http://localhost:8081` |
| 后端启动 | 通过 | API: `http://localhost:3000` |
| 数据库服务 | 通过 | MySQL97 已运行，3306 可用 |

最新 UI smoke 证据：

```json
{
  "ok": true,
  "verified": [
    "register",
    "create-post",
    "comment-post",
    "join-circle",
    "bookmark-post",
    "favorites-visible"
  ]
}
```

## 三、项目结构与功能覆盖

当前项目规模：

| 模块 | 数量 / 说明 |
| --- | --- |
| Expo Router 页面 | 32 个 `.tsx` 页面 |
| `src` 业务代码 | 46 个 `.ts/.tsx` 文件 |
| 服务端路由 | 10 个 route 文件 |
| 数据库表 | 20 张表 |
| 主要文档 | `api-design.md`、`community-system.md`、`database.md`、`login-system.md` |

主要功能覆盖：

- 注册登录：注册、登录、刷新 token、登出、修改密码已打通。
- 知识百科：品种百科、详情、搜索、排行、声音/朗读等体验已有基础。
- 社区：帖子列表、发帖、评论、点赞、收藏、举报、圈子已形成闭环。
- 商城/积分：积分摘要、签到、积分流水、获得/消费接口已可用。
- 个人中心：资料编辑、偏好设置、收藏、关注、消息入口等已搭建。
- AI 宠物助手：后端接入 DeepSeek，前端具备 AI 问答入口。
- 虚拟宠物：本地养成、状态衰减、互动逻辑已有实现。

产品层面看，内容布局已经基本符合宠物 App 的核心用户路径：先看品种百科和首页推荐，再进入社区交流，最后通过积分、虚拟宠物、AI 问答增强留存。

## 四、主要优点

1. 功能闭环完整  
   注册、登录、社区发帖、评论、圈子、收藏、积分和消息接口已经能通过自动化 smoke 验证。

2. 前后端分层清晰  
   前端页面位于 `app/`，服务层位于 `src/services/`，后端接口位于 `server/routes/`，结构容易继续扩展。

3. 有端到端验证意识  
   `package.json` 已提供 `typecheck`、`test:server:smoke`、`test:ui:smoke`、`db:summary` 等脚本，说明项目已经具备基础回归验证能力。

4. 宠物垂直领域内容较丰富  
   品种数据、百科详情、养宠适配、AI 问答、虚拟宠物、社区圈子等都围绕宠物场景展开，不是通用模板换皮。

5. 接口大多使用参数化查询  
   后端大量使用 `pool.execute` 参数绑定，降低了常规 SQL 注入风险。

## 五、审核发现

### HIGH 1：本地环境文件包含真实密钥和数据库密码

位置：

- `server/.env`：包含真实数据库密码、JWT 密钥和第三方 AI API Key。

风险：

真实数据库密码、JWT 密钥和第三方 AI API Key 出现在项目文件中。如果该文件被提交、打包、截图或分享，可能导致数据库、用户 token 签名和 AI 账号额度泄露。

建议：

- 确认 `.gitignore` 忽略 `server/.env`。
- 只保留 `server/.env.example` 作为模板。
- 轮换已经暴露过的 DeepSeek API Key 和 JWT secret。
- 本地使用 `.env`，生产环境使用平台 Secret / 环境变量。

### HIGH 2：数据库初始化脚本与代码实际依赖存在结构漂移

位置：

- `server/schema.sql:90` 定义 `posts.stats JSON`
- `server/full_schema.sql:122` 仍是 `likes_count INT`
- `server/routes/posts.js:125` 代码按 `stats JSON` 排序

现象：

本次重新运行时，数据库 20 张表已存在，但 `posts` 表缺少 `stats` 字段，导致帖子接口失败。已通过非破坏性迁移补充 `posts.stats` 后，服务端 smoke 才 61/61 通过。

风险：

新机器或老师环境按 `full_schema.sql` 初始化后，可能再次出现接口 500。当前“能跑通”依赖手工补字段，不是完全可重复部署。

建议：

- 统一 `schema.sql` 与 `full_schema.sql`，确定唯一初始化入口。
- 增加 `server/migrations/004_add_posts_stats.sql` 之类的迁移脚本。
- 把 `db:summary` 扩展为 schema 校验，检查关键字段是否存在。

### HIGH 3：密码重置接口缺少真实验证码/令牌校验

位置：

- `server/routes/auth.js:332`：`router.post('/password/reset', ...)`
- `server/routes/auth.js:334`：读取 `method, phone, email, smsCode, newPassword`

风险：

从代码结构看，重置密码接口依赖 phone/email/smsCode 参数，但当前审核未看到严格的短信验证码或 reset token 校验链路。如果该接口可直接按手机号/邮箱改密码，会形成账号接管风险。

建议：

- 重置密码必须校验一次性验证码或 reset token。
- 验证码应有过期时间、尝试次数限制、使用后失效。
- smoke 测试需要覆盖错误验证码、过期验证码、重复使用验证码。

### MEDIUM 1：缺少请求频率限制和暴力破解防护

位置：

- `server/routes/auth.js:33` 注册
- `server/routes/auth.js:132` 登录
- `server/routes/auth.js:309` 短信发送
- `server/routes/auth.js:332` 密码重置

风险：

登录、注册、短信、AI 问答等接口没有看到 rate limit。上线后容易被撞库、短信轰炸或刷 AI token。

建议：

- 引入按 IP + 用户名维度的频率限制。
- 登录失败次数达到阈值后短暂锁定。
- AI 聊天接口按用户和 IP 做限额。

### MEDIUM 2：Web 端 token / 用户缓存安全性较弱

位置：

- `src/utils/storage.ts:5` 说明 Web 使用 `localStorage`
- `src/utils/storage.ts:12` 读取 `localStorage`
- `src/utils/storage.ts:20` 写入 `localStorage`
- `src/contexts/AuthContext.tsx:114` 缓存用户信息到 AsyncStorage

风险：

Web 上 refresh token 存在 localStorage，遇到 XSS 时容易被读取。宠物社区有用户生成内容，后续若富文本、评论、昵称、图片描述处理不严，风险会上升。

建议：

- Web 生产环境优先考虑 HttpOnly Secure Cookie 存 refresh token。
- Access token 保持内存态，缩短有效期。
- 对用户生成内容做统一转义和敏感词/链接策略。

### MEDIUM 3：前端仍有 Mock 认证逻辑残留

位置：

- `src/services/authApi.ts:110`：Mock 模式
- `src/services/authApi.ts:117`：读取 `localStorage`
- `src/services/authApi.ts:153`：生成 mock accessToken

风险：

Mock 登录与真实登录并存，容易造成调试环境和正式环境行为不一致。后续多人协作时，可能误以为某些认证流程已接后端。

建议：

- 明确用环境变量控制 mock 模式，例如 `EXPO_PUBLIC_USE_MOCK_AUTH=false`。
- 生产构建中禁用 mock 分支。
- 在 README 或开发文档里说明 mock 仅用于离线演示。

### MEDIUM 4：上传接口基础可用，但生产级文件安全还不足

位置：

- `server/routes/users.js:10` multer diskStorage
- `server/routes/users.js:20` upload 配置
- `server/routes/users.js:23` fileFilter
- `server/routes/users.js:347` avatar 上传
- `server/routes/users.js:367` image 上传

风险：

目前上传已有限制，但宠物社区会大量上传图片。生产环境需要进一步考虑图片压缩、EXIF 清理、文件病毒扫描、对象存储、缩略图、违规图片审核。

建议：

- 限制图片尺寸、文件大小和 MIME + 文件头双重校验。
- 上传后生成缩略图，原图走对象存储。
- 对头像、帖子图片接入内容审核队列。

### MEDIUM 5：部分页面过大，后续维护成本会上升

位置：

- `app/(tabs)/index.tsx`：963 行
- `app/(tabs)/profile.tsx`：717 行
- `app/(tabs)/pet.tsx`：包含大量虚拟宠物 UI 与逻辑
- `server/routes/posts.js`：568 行

风险：

大文件承载过多 UI、状态和业务逻辑，后续修改社区、首页、宠物养成时容易出现回归问题。

建议：

- 将首页拆成 Header、BreedSection、CommunityPreview、QuickActions 等组件。
- 将个人中心拆成 UserHeader、PointsPanel、MenuSection、FavoritesModal 等组件。
- 将 `posts.js` 按列表、详情、互动、收藏等逻辑拆分，或至少抽出 repository/helper。

### LOW 1：Expo 依赖有可用补丁升级

运行时提示：

- `expo 56.0.5 -> ~56.0.15`
- 另有 6 个 package 可能需要更新

建议：

在功能稳定后执行：

```powershell
npx expo install --check
```

按 Expo 推荐版本更新，避免运行时兼容问题。

### LOW 2：React Native Web 有样式弃用警告

运行时提示：

- `"shadow*" style props are deprecated. Use "boxShadow".`
- `"textShadow*" style props are deprecated. Use "textShadow".`

建议：

逐步替换 Web 端弃用样式，避免后续 RN Web 版本升级后出现样式问题。

## 六、架构观察

架构状态：WATCH

目前架构适合课程设计/MVP：Expo Router + React Native Web + Express + MySQL，开发速度快，演示效果直观。但数据库迁移、环境配置、安全边界还偏“本地开发模式”。如果目标是正式宠物社区产品，需要补齐以下工程化层：

1. 唯一数据库迁移链路  
   不再依赖多个 SQL 文件人工判断，使用 migrations 顺序升级。

2. 环境隔离  
   dev/test/prod 三套配置清晰分离，生产密钥不落地。

3. 权限和风控  
   认证、重置密码、上传、AI 调用、举报审核要有明确风控策略。

4. 数据一致性  
   帖子点赞数、评论数、收藏数、圈子成员数、积分流水需要事务或一致性修复任务。

5. 可观测性  
   后端目前主要 `console.error`，后续应增加结构化日志、错误码、请求 ID。

## 七、宠物软件产品视角评估

### 已经比较成熟的部分

- 品种百科是宠物产品的核心入口，当前数据量和详情字段较完整。
- 社区和圈子能承接用户分享真实养宠日常，方向正确。
- 积分、签到、虚拟宠物有留存设计，适合年轻用户和课程展示。
- AI 问答能作为宠物助手入口，适合扩展“喂养建议、行为解释、疾病初筛提醒”等功能。

### 下一阶段建议优先级

1. 先稳定数据库和后端 schema  
   这是所有功能可重复运行的基础。

2. 完善宠物百科内容可信度  
   增加“内容来源/免责声明/兽医建议提示”，避免健康建议过度承诺。

3. 强化社区安全  
   用户举报、敏感词、图片审核、黑名单、删除/隐藏流程要闭环。

4. 商城要明确边界  
   如果只是积分商城，可以先叫“积分商城”；如果涉及真实商品交易，需要支付、订单、售后、库存等完整系统。

5. 让虚拟宠物和真实社区行为联动  
   例如发帖、答题、签到、百科学习获得宠物经验，使产品特色更强。

## 八、建议整改清单

### 立即处理

- 移除真实 `.env` 内容，轮换 DeepSeek API Key 和 JWT secret。
- 合并/修正 `schema.sql` 与 `full_schema.sql`，补充迁移脚本。
- 为密码重置接口增加真实验证码/token 校验。

### 短期处理

- 加登录、短信、AI 接口频率限制。
- 生产构建禁用 mock auth。
- 增加 schema 校验脚本，防止字段缺失。
- 给上传增加更严格的文件校验和图片处理。

### 中期处理

- 拆分超大页面和超大 route。
- 增加单元测试和更细的 API 测试。
- 增加结构化日志和错误追踪。
- 梳理积分、帖子统计、圈子统计的一致性策略。

## 九、最终评级

| 维度 | 评级 | 说明 |
| --- | --- | --- |
| 产品完整度 | B+ | 主功能完整，适合展示和继续迭代 |
| 前端体验 | B | 页面丰富，布局已成型，但大文件较多 |
| 后端 API | B | 主链路通过 smoke，但安全和迁移要补强 |
| 数据库设计 | B- | 表较完整，但 schema 文件漂移是明显风险 |
| 安全性 | C+ | 认证基础可用，但密钥、限流、重置密码需修 |
| 可维护性 | B- | 分层清晰，但文件体积和 mock 残留需整理 |
| 可上线程度 | C+ | 当前适合演示，不建议直接生产上线 |

最终判断：当前项目的结构框架和主要内容布局已经可用，宠物软件核心功能方向正确。下一步不应再盲目堆功能，而应优先做“安全、数据库迁移、稳定性、可维护性”四类工程化收口。
