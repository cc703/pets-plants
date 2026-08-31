# 2026-08-25 发布候选冻结

## 目的与边界

本记录将当前工作区的发布候选改动拆分为可独立审查、可独立验证的提交批次。它不执行 `git add`、不创建提交，也不改变产品代码。

- 冻结时工作区包含 42 个已跟踪修改和 32 个新增文件。
- 当前分支为 `main`，工作区仍有未提交业务改动。
- 本地验证范围不含服务器、域名、DNS、证书、生产邮件服务和公网发布。

## 已验证基线

以下命令已在当前代码版本的本地环境逐项通过：

| 命令 | 结果 |
| --- | --- |
| `npm run typecheck` | 通过 |
| `npm run test:unit` | 通过 |
| `npm run test:migrations` | 通过 |
| `npm run test:server:smoke` | 185 通过，0 失败 |
| `npm run test:secrets` | 通过；147 个 Git 跟踪文件，0 个跟踪环境文件，0 个密钥模式匹配 |
| `npm run build:web` | 通过 |
| `npm run test:ui:smoke` | 通过，包含清理验证 |
| `npm run db:summary` 与 `npm run db:cleanup:dry-run` | 无 UI 烟测残留 |
| `git diff --check` | 通过；仅有 Git 的 LF/CRLF 提示 |

`npm run verify:pre-release` 在 2026-08-24 曾完整通过；2026-08-25 的并行复核改为上述逐项命令，原因是组合命令超过当前终端等待时限，并非某一步验证失败。

## 建议提交批次

### 1. 数据库演进与兼容迁移

目标：使新库初始化、旧库增量升级及迁移契约具备可重复验证的行为。

- `server/migrations/002_auth_tables.sql`
- `server/migrations/003_community_tables.sql`
- `server/migrations/004_posts_stats_schema.sql`
- `server/migrations/006_user_pets.sql`
- `server/migrations/007_email_identity.sql`
- `server/migrations/008_backfill_post_circle_ids.sql`
- `server/migrations/009_email_verification.sql`
- `server/migrations/010_email_login_codes.sql`
- `server/migrations/README.md`
- `scripts/migration-contract.test.js`
- `scripts/migration-live.test.js`
- `scripts/legacy-migration-rehearsal.ps1`
- `docs/database.md`
- `docs/release/legacy-migration-rehearsal-2026-08-24.md`

验证：`npm run test:migrations`。

### 2. 已养宠用户日常闭环

目标：完成宠物档案、社区浏览与互动、圈子、积分、通知和个人结果展示的本地闭环。

- `server/routes/user-pets.js`
- `server/routes/posts.js`
- `server/routes/comments.js`
- `server/routes/circles.js`
- `server/routes/points.js`
- `server/utils/notifications.js`
- `src/contexts/UserPetContext.tsx`
- `src/services/userPetService.ts`
- `src/services/breedService.ts`
- `src/services/postService.ts`
- `src/services/circleService.ts`
- `src/services/pointsService.ts`
- `src/services/searchService.ts`
- `src/components/SearchFilter.tsx`
- `app/(tabs)/community.tsx`
- `app/(tabs)/notification.tsx`
- `app/(tabs)/pet.tsx`
- `app/(tabs)/profile.tsx`
- `app/(tabs)/wiki.tsx`
- `app/breed/[id].tsx`
- `app/circle/create.tsx`
- `app/circle/[id].tsx`
- `app/circle/index.tsx`
- `app/my-posts.tsx`
- `app/post/create.tsx`
- `app/quiz/play.tsx`
- `app/search/result.tsx`
- `app/_layout.tsx`

验证：`npm run test:server:smoke`、`npm run test:ui:smoke`、`npm run build:web`。

### 3. 邮箱身份与认证安全

目标：提供邮箱验证、验证码登录及未配置邮件服务时的可识别失败路径。

- `app/(auth)/login.tsx`
- `app/(auth)/register.tsx`
- `app/(auth)/verify-email.tsx`
- `src/contexts/AuthContext.tsx`
- `src/services/authApi.ts`
- `server/routes/auth.js`
- `server/services/emailService.js`
- `server/utils/emailVerification.js`
- `server/utils/emailLoginCode.js`
- `server/email-auth-unit.test.js`
- `docs/superpowers/specs/2026-08-22-email-delivery-deferred.md`

验证：`npm run test:unit`、`npm run test:server:smoke`。

限制：真实邮件投递、激活链接与验证码收取仍依赖后续邮件服务配置，不能据本地模拟验证推断生产投递成功。

### 4. 运行时配置、上传与接口防护

目标：将生产必要配置前置校验，并对上传和高频入口加入边界控制。

- `server/config/runtime.js`
- `server/index.js`
- `server/middleware/auth.js`
- `server/middleware/rateLimit.js`
- `server/services/uploadService.js`
- `server/upload-service.test.js`
- `server/runtime-config.test.js`
- `server/.env.example`
- `server/routes/ai.js`

验证：`npm run test:unit`、`npm run test:server:smoke`。

### 5. 回归门禁与发布辅助

目标：固化数据清理、前后端烟测、预发布聚合验证和设计记录。

- `package.json`
- `server/test-api.js`
- `scripts/cleanup-test-data.js`
- `scripts/cleanup-test-data.test.js`
- `scripts/db-summary.js`
- `scripts/product-ui-smoke.js`
- `scripts/pre-release-verify.ps1`
- `docs/release/2026-08-24-release-inventory.md`
- `docs/superpowers/plans/2026-08-21-pet-owner-daily-closed-loop.md`
- `docs/superpowers/plans/2026-08-22-notification-events.md`
- `docs/superpowers/plans/2026-08-24-prelaunch-remainder.md`
- `docs/superpowers/specs/2026-08-21-pet-owner-daily-closed-loop-design.md`
- `docs/superpowers/specs/2026-08-22-notification-events-design.md`

验证：`npm run verify:pre-release`；如终端执行时间受限，则按“已验证基线”逐项执行并记录。

## 需要按 hunk 审查的共享文件

下列文件同时服务于多个批次，正式提交时不应整文件一次性加入某一个批次：

| 文件 | 原因 | 处理建议 |
| --- | --- | --- |
| `server/full_schema.sql` | 同时包含宠物、邮箱和结构兼容字段 | 按表与索引块拆分，或放入最后的整合提交 |
| `server/routes/users.js` | 同时涉及用户资料、宠物关联与上传防护 | 按功能块拆分 |
| `server/routes/auth.js` | 基础登录、邮箱验证、验证码登录共存 | 认证基础与邮箱功能一起审查；避免与无关功能混入 |
| `server/test-api.js` | 覆盖日常闭环、认证、安全和 AI 降级 | 按测试段落拆分，或在门禁提交中统一纳入 |
| `package.json` | 测试脚本为多个批次共用 | 放入门禁批次 |

## 冻结前风险清单

- 邮件服务未配置时接口会明确返回 `EMAIL_NOT_CONFIGURED`，这是已验证的本地降级；真实发信仍未验证。
- 旧账号迁移后可能没有密码。迁移 002 现在保留 `password_hash = NULL` 这一显式状态，密码登录会安全拒绝，并提示使用邮箱验证码登录；新注册账号仍写入正常密码哈希。
- 当前工作区包含大规模 `app/(tabs)/pet.tsx` 修改，单文件变更量较高，应在提交前单独做行为复核。
- Git 报告 LF/CRLF 转换提示；不是 `git diff --check` 错误，但提交前应确认团队换行策略，避免产生无意义行级噪音。
- 本记录只归档改动边界，不代表代码审查结论。逐批提交前仍需要一次面向差异的审查和对应验证。

## 批次 1 审查结果

### 已验证

- `npm run test:migrations` 通过；002、003、007 在当前数据库连续执行两次后对象快照一致，且 004/008 的契约检查通过。
- 当前连接的 `pet_planet` 数据库包含 `users.email_verified_at`、`email_verification_tokens` 和 `email_login_codes`。
- `npm run test:migrations` 已改为创建带命名前缀的临时库，覆盖 fresh schema 与 legacy 002-010 两次执行；测试结束后临时库为 0。
- 002、003、004、006、007、008、009、010 的 SQL 本身均使用了 `CREATE TABLE IF NOT EXISTS` 或条件 DDL 设计；009/010 的单独脚本可重复执行。

### 未完成 / 不能据此推断

- 旧账号 `password_hash = NULL` 已有专门集成覆盖：密码登录拒绝、邮箱验证码登录、设置初始密码和重新使用密码登录均已验证。
- 数据库结构验证不能证明真实邮件投递成功；这仍依赖后续邮件服务沙箱或生产配置。

### 进入下一批次的条件

数据库结构阻塞已解除，批次 1 可以进入提交前差异审查。剩余收口项为：

1. 为 `password_hash = NULL` 增加独立的服务端集成测试，锁定旧账号提示和拒绝行为。
2. 保留 `npm run test:migrations` 的临时库输出，禁止对 `pet_planet` 执行测试 DDL/DML。
3. 邮件服务配置后，在邮件沙箱完成激活链接和验证码收取的端到端验证。

## 批次 2 审查结果

### 已验证

- 服务端日常闭环烟测在本地当前版本为 172 通过、0 失败，覆盖圈子发帖计数增加、删除后计数恢复、圈子帖子互动状态等回归。
- 修复删除帖子按历史标签猜圈子的问题，改为使用帖子真实 `circle_id` 回收 `circles.post_count`。
- 圈子帖子接口现在返回当前用户的 `isLiked` 与 `isBookmarked`，不再固定返回 `false`。
- 从圈子详情点击发帖会携带 `circleId`，发帖页加载圈子后自动选中来源圈子。
- `npm run typecheck`、Node 语法检查和 `npm run test:ui:smoke` 均通过；UI 烟测进程退出码为 0。

### 仍需关注

- `app/(tabs)/pet.tsx` 和 `app/(tabs)/profile.tsx` 仍是大文件变更，当前自动化覆盖核心路径，但尚未完成逐屏视觉与异常状态审查。
- `server/routes/posts.js`、`server/routes/comments.js` 和 `server/routes/circles.js` 的列表接口存在按条目逐次查询用户/互动状态的 N+1 结构；当前数据量小且烟测通过，扩容前应评估批量查询或缓存。
- 真实图片选择/上传依赖设备权限与运行时，UI 烟测覆盖的是可执行路径，不等同于真机相册权限验证。
- 生产限流依赖 `rate_limit_buckets`；数据库异常时已改为失败闭合并返回 503，仍需在预发布环境验证数据库故障告警和恢复流程。

## 2026-08-28 复核附录

### 已验证

- `npm run test:server:smoke`：185 通过、0 失败，包含旧账号初始密码、激活/重置/登录验证码重放与过期，以及并发邮箱重置只能成功一次。
- `npm run test:ui:smoke`：通过；注册、主宠创建、百科浏览、发帖、评论、加入圈子、收藏和真实通知展示均完成，退出码为 0。
- `npm run test:secrets`：通过；147 个 Git 跟踪文件中没有被跟踪的环境文件、私钥或常见云密钥模式。
- `npm run verify:pre-release`：通过全部门禁（类型检查、单元、敏感配置、迁移、数据库摘要、服务端烟测、Web 构建、UI 烟测、清理 dry-run、空白检查）。
- UI 烟测结束后自动执行 `scripts/cleanup-test-data.js --apply`，测试用户、帖子、评论和临时圈子已清理。
- API `GET http://localhost:3000/api/health` 返回 HTTP 200，状态为 `ok`。

### 未验证 / 仍属风险

- 邮件服务、激活链接、登录验证码的真实投递仍未验证，依赖后续邮件服务配置。
- UI 烟测使用 Chromium headless Web 环境，不能替代 Android/iOS 真机权限和布局验证。

## 后续顺序

1. 审查批次 2 中宠物页、社区与圈子的大文件变更，确认界面与 API 契约一致。
2. 审查批次 3、4 的认证与安全边界，并补上旧账号无密码的集成测试。
3. 再做一次敏感信息扫描和完整门禁。
4. 按批次暂存、运行对应验证、提交；每次提交后保留干净的验证证据。
