# 萌宠星球非基础设施上线前收口实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or **superpowers:executing-plans** to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不处理服务器、域名和公网平台选择的前提下，完成数据库升级可靠性、邮箱认证边界、上传安全、生产安全配置、自动化验收和发布变更整理，使项目达到可交付 staging 的状态。

**Architecture:** 保持现有 Expo Router/React Native Web + Express + MySQL 分层。数据库迁移采用可重复执行的条件 DDL；认证、上传和 AI 能力继续由后端负责权限、限流和真实数据，前端只消费 API；测试数据通过统一命名规则和事务清理脚本隔离。

**Tech Stack:** Expo 56、React Native Web、TypeScript 6、Express 5、Node.js、mysql2、MySQL 9.7、JWT、bcryptjs、Node 内置 `fetch`、Chrome DevTools UI 烟测。

---

## 0. 范围与当前基线

### 本计划包含

- 数据库迁移说明、幂等性和旧库升级演练。
- 邮箱注册激活、邮箱真实性验证和邮箱验证码登录的实现边界。
- 图片上传校验、内容输出安全、生产配置和 AI 上游错误处理。
- 类型检查、构建、服务端烟测、UI 烟测、数据清理和发布门禁。
- 变更清单、发布说明和可回滚的提交组织。

### 本计划明确排除

- 服务器型号、操作系统、域名、DNS、证书、公网平台和云厂商选择。
- PM2、Docker、Nginx 或其他进程托管方案在真实服务器上的安装与切换。
- 生产账号创建、真实邮件服务商签约、生产密钥填充和生产数据迁移执行。

### 已验证基线

- `npm run typecheck`：通过。
- `npm run build:web`：通过。
- `npm run test:server:smoke`：157 通过，0 失败。
- `npm run test:ui:smoke`：通过，覆盖百科、注册、宠物、发帖、评论、入圈、收藏和真实通知。
- `npm run test:migrations`：通过，包含迁移契约和当前 MySQL 实库检查。
- `/api/health`：返回 HTTP 200 和 `status: ok`。
- 数据清理后：5 个用户、0 帖子、0 评论、0 收藏、5 圈子、0 宠物，UI 烟测用户数为 0。

### 本次执行状态（2026-08-24）

- 已完成：任务 1-4、任务 7-13 的代码、测试和文档工作；旧版 `server/schema.sql` 迁移已连续执行两遍并通过结构断言；任务 8 的帖子/评论 HTML 攻击字符串和超长正文回归已加入服务端烟测。
- 已完成但待外部邮件验证：任务 5-6 的接口、数据表、邮件服务边界、前端状态和本地单元检查；当前没有 Mailpit 或真实邮件供应商配置。
- 未开始 staging 外部验收：任务 14 需要部署负责人注入实际 staging API/数据库环境变量，本地计划不代替该环境验收。
- 当前最后一次 `npm run verify:pre-release`：全部通过；随后重启 API 服务并执行最新 `npm run test:server:smoke`，167 项全部通过；数据库 dry-run 为 0 条测试数据。

### 已知未闭环项

- 邮箱真实性验证、注册激活邮件、邮箱验证码登录尚未接入，邮件供应商和发信配置被延期。
- `002`、`003`、`007` 仍存在非幂等 `ALTER TABLE` 或约束创建风险，未完成完整旧库升级演练。
- 上传流程尚未纳入完整 UI 烟测；生产密钥、调试输出、AI 上游失败和持久化策略仍需门禁。

## 1. 执行规则

- 每个任务先写失败测试或可复现检查，再修改实现，最后运行该任务的验收命令。
- 数据库演练只使用克隆库；生产库禁止运行清理脚本和迁移回滚脚本。
- 每个任务保持小范围、可回滚；完成后运行 `git diff --check` 和对应测试。
- 任何“通过”结论必须附命令输出；无法运行时标记为“未验证”，不得用文档推断替代。
- 真实邮件供应商、生产密钥和公网部署属于外部配置；代码只能提供明确失败提示和可替换适配层。

## 2. P0：建立发布边界和数据库基线

### 任务 1：冻结当前变更清单

**目标：** 让后续执行者知道当前代码哪些是既有变更，避免把工作区临时文件误提交。

**文件：** `docs/release/2026-08-24-release-inventory.md`、`package.json`（仅核对脚本，不随意改动）。

**步骤：**

- [ ] 执行 `git status --short`、`git diff --stat`、`git ls-files server/.env`，记录已跟踪和未跟踪文件。
- [ ] 按认证/安全、宠物/个人中心、社区/通知/圈子、测试/迁移四类列出变更文件和验收命令。
- [ ] 记录 `server/.env` 未纳入版本库；确认日志、上传目录、浏览器临时产物和构建目录不进入提交。
- [ ] 用 `git diff --check` 验证无空白错误；用 `npm run typecheck` 验证基线仍可编译。

**验收：** 清单能逐文件映射到测试或人工验收项，且工作区中不存在应提交的密钥文件。

### 任务 2：建立唯一数据库升级路径

**目标：** 消除“新库执行完整结构”和“旧库重复执行增量迁移”混用造成的风险。

**文件：** `server/migrations/README.md`、`docs/database.md`、`server/full_schema.sql`、`server/seed.sql`。

**步骤：**

- [ ] 盘点 `server/migrations/001_*.sql` 到 `008_*.sql` 的依赖、创建表、字段和索引。
- [ ] 在迁移 README 中明确两条路径：新库执行 `full_schema.sql` 后按需执行 `seed.sql`；已有旧库按 `002` 到 `008` 顺序执行。
- [ ] 明确 `001` 是历史基线，不得在已由 `full_schema.sql` 初始化的数据库上重复执行。
- [ ] 列出 `users`、`posts`、`comments`、`user_pets`、`circles`、`notifications`、`points` 等关键对象的最终字段和索引来源。
- [ ] 写出失败处理方式：记录失败迁移、恢复克隆库、修复脚本后从失败迁移重新执行；不在应用启动时隐式执行迁移。

**验收：** 新成员只阅读 README 就能选出正确路径，并能通过现有 `npm run test:migrations`。

### 任务 3：将旧库增量迁移改为幂等

**目标：** 同一迁移重复执行不报错，也不重复创建索引或约束。

**文件：** `server/migrations/002_add_user_fields.sql`、`003_add_comment_reply.sql`、`007_add_user_email_unique.sql`、`scripts/migration-contract.test.js`、`scripts/migration-live.test.js`。

**步骤：**

- [ ] 先补失败测试：在临时数据库中连续执行每个迁移两次，第二次必须退出码为 0；重复执行后查询字段、索引和约束数量必须不变。
- [ ] `002` 对 `password_hash`、`gender`、`birthday`、`city`、`followers_count`、`following_count`、`posts_count` 使用 `INFORMATION_SCHEMA.COLUMNS` 条件 DDL。
- [ ] `003` 对 `reply_to_user_id` 使用字段存在性检查，对 `idx_comments_parent` 使用 `INFORMATION_SCHEMA.STATISTICS` 检查。
- [ ] `007` 对 `uk_users_email` 使用 `INFORMATION_SCHEMA.TABLE_CONSTRAINTS` 或等价唯一索引检查，并兼容已有同名约束。
- [ ] 迁移脚本保持单文件可审查，避免依赖客户端特有的 `IF NOT EXISTS` 语法；沿用当前 MySQL 9.7 可执行的 `PREPARE/EXECUTE` 条件模式。
- [ ] 运行 `npm run test:migrations`，再对 002 到 008 按顺序执行第二遍，确认无 `ER_DUP_FIELDNAME`、`ER_DUP_KEYNAME` 或解析错误。

**验收：** 契约测试、实库测试和第二遍迁移全部通过，且对象数量没有膨胀。

### 任务 4：完成旧库升级演练和回滚记录

**目标：** 证明从旧版数据库到当前结构的全过程可重复、可观测、可恢复。

**文件：** `scripts/legacy-migration-rehearsal.ps1`、`docs/release/legacy-migration-rehearsal-2026-08-24.md`。

**步骤：**

- [ ] 用 `D:\MYSQL\bin\mysql.exe` 创建独立的 `pet_planet_migration_rehearsal` 克隆库，不触碰开发库和生产库。
- [ ] 导入旧版结构快照，按 `002` 到 `008` 顺序执行；脚本记录每一步开始时间、退出码和错误输出。
- [ ] 对 `posts.stats`、`posts.circle_id`、`user_pets`、`uk_users_email`、评论父子索引执行 SQL 断言。
- [ ] 重复执行完整迁移序列，确认第二遍仍为 0 退出码。
- [ ] 记录失败时的恢复动作：删除演练库并从快照重建；不编写会自动删除任意数据库的命令。
- [ ] 将库名、命令、断言结果和已知差异写入演练报告，报告只提交结构信息，不提交连接密码。

**验收：** 演练报告包含成功日志、对象断言、重复执行结果和恢复步骤。

## 3. P0：认证与邮箱能力

### 任务 5：实现邮箱注册激活和真实性验证

**目标：** 注册后只能通过一次性、有时效的激活链接确认邮箱；未配置发信服务时明确失败，不伪造成功。

**文件：** `server/migrations/009_email_verification.sql`、`server/services/emailService.js`、`server/utils/emailVerification.js`、`server/routes/auth.js`、`server/index.js`、`server/.env.example`、`src/services/authApi.ts`、`app/(auth)/verify-email.tsx`、`app/(auth)/register.tsx`、`app/(auth)/login.tsx`、`server/test-api.js`、`scripts/product-ui-smoke.js`。

**步骤：**

- [ ] 先补 API 失败测试：激活 token 过期、重复使用、篡改、错误用户和已激活用户必须返回明确的 4xx；发送服务未配置必须返回可识别的配置错误。
- [ ] 新增验证记录表，保存 token 哈希、用户 ID、用途、过期时间、使用时间和创建时间；数据库中不保存明文 token。
- [ ] `emailService` 只接收收件人、主题、纯文本和 HTML，提供本地 Mailpit 适配和生产 SMTP/API 适配接口；未配置时抛出配置错误。
- [ ] 注册事务创建用户和激活记录；激活链接通过 `GET /api/auth/verify-email?token=...` 消费，成功后设置 `email_verified_at` 并使 token 失效。
- [ ] 增加重新发送接口，按用户和邮箱地址限流，并使旧 token 失效；响应不得泄露邮箱是否存在。
- [ ] 前端新增激活结果页，覆盖成功、过期、已使用、无效和服务异常状态；注册成功页只显示“请检查邮箱”，不显示伪造链接。
- [ ] 明确未验证用户的登录策略并在接口、UI 和测试中统一：建议允许登录但限制发帖、评论、上传等高风险动作，直到邮箱验证完成。
- [ ] 使用本地 Mailpit 完成注册、收信、点击激活、再次登录和受限动作检查；将邮件主题和链接格式写入测试断言。

**验收：** `server/test-api.js` 和 UI 烟测验证真实邮件边界；没有邮件配置时功能状态为“未配置”，不能标记为完整上线能力。

### 任务 6：实现邮箱验证码登录

**目标：** 在已有邮箱密码登录之外，提供可开关的邮箱验证码登录，保证验证码不可逆、短时有效、一次使用和可限流。

**文件：** `server/migrations/010_email_login_codes.sql`、`server/utils/emailLoginCode.js`、`server/routes/auth.js`、`server/services/emailService.js`、`server/.env.example`、`src/services/authApi.ts`、`app/(auth)/login.tsx`、`server/test-api.js`、`scripts/product-ui-smoke.js`。

**步骤：**

- [ ] 先补失败测试：错误邮箱、错误验证码、过期验证码、重复使用、连续请求和连续失败必须分别得到 4xx/429。
- [ ] 验证码表只保存哈希和必要审计字段；验证码有效期不超过 10 分钟，成功登录后立即标记使用。
- [ ] 增加“发送验证码”和“验证码登录”接口，按 IP、邮箱和用户维度限流，响应统一避免邮箱枚举。
- [ ] 前端只有在后端配置开关启用时显示验证码模式；倒计时、错误信息和重新发送状态必须与服务端返回一致。
- [ ] Mailpit 端到端读取最新验证码并完成登录；未配置邮件服务时 UI 显示不可用原因。

**验收：** 代码、接口、前端状态和限流测试全部通过；真实邮件供应商仍作为部署阶段配置项，不在本计划内伪造完成。

## 4. P0：上传与内容安全

### 任务 7：收紧图片上传边界

**目标：** 上传接口只接受经身份验证的合规图片，拒绝伪造扩展名、超限文件和不可识别内容。

**文件：** `server/index.js`、`server/routes/users.js`、`server/routes/posts.js`、`server/services/uploadService.js`、`src/services/uploadService.ts`、`server/test-api.js`、`scripts/product-ui-smoke.js`。

**步骤：**

- [ ] 先补失败测试：未登录、空文件、超大文件、非图片 MIME、图片扩展名伪造文本、路径穿越文件名均必须失败。
- [ ] 使用 multer 的大小限制和内存/临时目录策略；允许列表仅为 JPEG、PNG、WebP，并限制单文件和单请求数量。
- [ ] 对文件头执行 magic bytes 检查，不能只信任客户端 MIME 或扩展名；服务端生成随机文件名和固定相对路径。
- [ ] 响应只返回应用内相对 URL 或受控资源 URL，不返回绝对磁盘路径；未授权用户不能读取私有上传。
- [ ] 前端上传失败时保留可恢复的表单状态；成功路径写入宠物头像或帖子图片并在 UI 烟测中检查可见。
- [ ] 清理脚本增加测试上传文件的删除规则，并验证清理不会删除非测试文件。

**验收：** API 负例、真实小图片上传、UI 可见性和清理回归测试均通过。

### 任务 8：验证内容输出和 XSS 防护

**目标：** 用户输入在百科、帖子、评论、通知和个人资料中始终按文本渲染。

**文件：** `server/routes/posts.js`、`server/routes/comments.js`、`server/routes/users.js`、`src/app` 下对应帖子/评论/资料页面、`server/test-api.js`、`scripts/product-ui-smoke.js`。

**步骤：**

- [ ] 增加包含 `<img src=x onerror=...>`、`javascript:` 和超长文本的接口测试，确认服务端不执行、不生成危险重定向。
- [ ] 搜索并移除非必要的 `dangerouslySetInnerHTML`；富文本若无明确白名单则按纯文本展示。
- [ ] 为标题、正文、评论、昵称和简介统一设置长度上限，超限返回 422 并保持错误格式一致。
- [ ] UI 烟测提交攻击字符串后刷新页面，确认页面显示文本且浏览器无脚本执行。

**验收：** 负例测试和浏览器控制台检查通过，所有新增输出点有对应测试。

## 5. P0：生产模式安全与 AI 边界

### 任务 9：集中校验运行时配置并关闭调试泄露

**目标：** 生产模式缺少关键配置时快速失败，响应和日志不泄露密钥、令牌、SQL 或堆栈。

**文件：** `server/config/runtime.js`、`server/index.js`、`server/db.js`、`server/middleware/auth.js`、`server/.env.example`、`server/test-api.js`、`scripts/runtime-config.test.js`。

**步骤：**

- [ ] 先补配置测试：生产模式缺少 JWT 密钥、数据库密码、允许来源或上传根目录时，启动检查必须失败并列出变量名。
- [ ] 新增集中配置读取器；开发环境可使用明确的本地默认值，生产环境禁止弱 JWT 默认值和空数据库密码。
- [ ] CORS 只接受显式来源列表；禁止生产环境使用通配来源配合凭证。
- [ ] 统一错误处理中间件：生产响应只返回稳定错误码和用户可读消息，详细堆栈仅写受控日志。
- [ ] 检查日志和调试分支，删除响应中的密码、JWT、邮件 token、验证码、SQL 和绝对路径。
- [ ] 运行配置单元测试、服务端烟测、类型检查和 Web 构建。

**验收：** 生产配置缺失会阻止启动，开发模式仍可运行，接口响应不含敏感字段。

### 任务 10：补齐认证、资源和 AI 上游限流

**目标：** 防止登录、验证码、上传和 AI 代理被单一客户端耗尽资源。

**文件：** `server/middleware/rateLimit.js`、`server/routes/auth.js`、`server/routes/upload.js`（若现有上传路由集中在其他文件则保持现有边界）、`server/routes/ai.js`、`server/test-api.js`。

**步骤：**

- [ ] 先补 429 测试：登录失败、验证码发送、激活重发、上传和 AI 请求分别验证窗口、响应头和错误格式。
- [ ] 对认证接口使用 IP+账号维度限流，对上传和 AI 使用 IP+用户维度限流；限制体积、并发和请求超时。
- [ ] AI 上游缺少密钥、超时、非 2xx、非法 JSON 时返回稳定错误，不把供应商响应原样透传给客户端。
- [ ] 使用 `AbortController` 设置上游超时，并在日志中记录请求 ID、耗时和错误类别，不记录提示词中的敏感信息。
- [ ] 运行 `npm run test:server:smoke`，确认正常用户流程未被限流规则误伤。

**验收：** 429、AI 失败和正常路径均有测试证据，限流配置可通过环境变量调整。

## 6. P1：测试、清理与发布质量门禁

### 任务 11：建立一键预发布质量门禁

**目标：** 任何候选版本都使用同一套顺序检查，失败即停止，不自动修改数据库。

**文件：** `scripts/pre-release-verify.ps1`、`package.json`、`docs/release/2026-08-24-release-inventory.md`。

**步骤：**

- [ ] 编写 PowerShell 门禁脚本，使用 `$ErrorActionPreference = 'Stop'`，每一步输出命令名和耗时。
- [ ] 按依赖顺序执行：

  ```powershell
  npm run typecheck
  npm run test:migrations
  npm run db:summary
  npm run test:server:smoke
  npm run build:web
  npm run test:ui:smoke
  npm run db:cleanup:dry-run
  git diff --check
  ```

- [ ] 增加 `npm run verify:pre-release` 脚本入口；门禁脚本不得调用 `npm run db:cleanup` 的应用模式。
- [ ] 记录每个命令的退出码、测试数量和关键摘要；任意一步失败时返回非零退出码。
- [ ] 将门禁结果写入发布清单，明确哪些是自动验证、哪些仍需人工验证。

**验收：** 在当前干净数据库上一次运行通过；人为让某一步失败时，后续步骤不会继续。

### 任务 12：固化烟测生命周期和测试数据清理

**目标：** UI/API 烟测可重复运行，结束后不污染开发数据库。

**文件：** `scripts/cleanup-test-data.js`、`scripts/cleanup-test-data.test.js`、`scripts/product-ui-smoke.js`、`server/test-api.js`、`package.json`。

**步骤：**

- [ ] 统一测试数据前缀，并在清理脚本和测试中保持一致：`ui` 八位日期、`tu` 十位以上时间戳、`b` 十位以上时间戳、`notify` 八位日期。
- [ ] 清理顺序遵循外键依赖：通知、积分、收藏/点赞、评论、帖子、圈子成员、宠物、用户；每一类输出删除数量。
- [ ] 所有测试用户、帖子、圈子和上传文件都必须携带可识别前缀；禁止按普通业务字段模糊删除。
- [ ] UI 烟测使用固定测试图片并在 `finally` 分支执行文件清理；清理失败必须让脚本失败。
- [ ] 保留 `db:cleanup:dry-run` 作为默认门禁，只有显式人工执行 `db:cleanup` 才实际删除。
- [ ] 连续运行两次 `npm run test:ui:smoke`，每次结束后执行 `npm run db:summary` 和 dry-run，结果均为 0 条测试数据。

**验收：** 第二次烟测不受第一次残留影响，清理统计可审计且无误删。

### 任务 13：完成差异审查和发布变更整理

**目标：** 将当前大工作区变更拆成可审查的领域提交，并形成上线前变更说明。

**文件：** `docs/release/2026-08-24-release-notes.md`、全部待提交代码和测试文件。

**步骤：**

- [ ] 使用 `git diff --name-only`、`git diff --stat`、`git diff --check` 审查所有跟踪文件；逐个确认没有临时脚本、浏览器产物、日志、上传文件或密钥。
- [ ] 对照任务 1 清单，将变更分为数据库/迁移、认证/安全、业务闭环、测试/工具四组；每组写明行为变化和验证命令。
- [ ] 发布说明记录数据库迁移顺序、环境变量清单、邮件功能的配置状态、已知限制和回滚入口。
- [ ] 每个领域单独提交，提交信息遵循仓库 Lore 协议，包含 `Constraint`、`Rejected`、`Confidence`、`Scope-risk`、`Directive`、`Tested` 和 `Not-tested`。
- [ ] 提交前重新运行 `npm run verify:pre-release`，确认工作区只剩允许保留的本地环境文件。

**验收：** 提交历史能按领域回滚，发布说明与实际 diff 一致，`server/.env` 未被纳入提交。

## 7. P1：上线前最终验收（不含服务器和域名）

### 任务 14：执行 staging 代码验收

**目标：** 在部署负责人提供实际 staging API 地址和配置后，验证应用代码与数据库契约，不承担基础设施变更。

**文件：** `docs/release/staging-acceptance-2026-08-24.md`、`scripts/pre-release-verify.ps1`。

**步骤：**

- [ ] 由部署环境注入 `$env:STAGING_API_BASE_URL`、`$env:STAGING_DB_HOST`、`$env:STAGING_DB_NAME` 等变量；脚本只读取变量，不在仓库保存值。
- [ ] 使用 `$env:EXPO_PUBLIC_API_BASE_URL = $env:STAGING_API_BASE_URL` 构建 Web，并执行 `npm run build:web`。
- [ ] 在 staging 数据库执行只读 `npm run db:summary`、迁移状态查询和 `npm run db:cleanup:dry-run`；不执行应用模式清理。
- [ ] 依次验证健康检查、邮箱密码注册/登录、百科浏览、宠物创建、发帖、评论、收藏、签到积分、个人中心结果和通知。
- [ ] 逐项验证失败路径：未登录访问、无权限圈子操作、重复收藏、重复签到、无效激活 token、过期验证码、非法上传、AI 上游不可用。
- [ ] 将每项结果、请求 ID、时间和截图/日志位置写入 staging 验收报告；敏感值只写“已配置/未配置”。

**验收：** staging 代码验收报告无未解释失败；基础设施地址、证书和域名本身不在本计划结论中。

## 8. 完成定义

- [ ] 新库路径和旧库路径已书面区分，旧库迁移序列可连续执行两遍。
- [ ] 邮箱激活和验证码登录在本地邮件沙箱中闭环；未配置真实邮件服务时状态明确为未配置。
- [ ] 上传、XSS、认证、限流和 AI 失败路径均有自动化测试证据。
- [ ] `npm run verify:pre-release` 全部通过，且 UI/API 烟测不会留下测试数据。
- [ ] 发布说明、环境变量清单、已知风险和回滚步骤已更新。
- [ ] 工作区不含密钥、日志、临时浏览器文件和测试上传文件；所有提交通过 `git diff --check`。

## 9. 推荐执行顺序与停止点

1. 先完成任务 1 到 4，建立数据库可重复升级能力；任一迁移演练失败时停止后续邮箱和发布工作。
2. 再完成任务 5 到 6；没有本地 Mailpit 闭环证据时，不把邮箱功能标记为完成。
3. 接着完成任务 7 到 10，优先处理上传、XSS、生产配置和限流这类高风险边界。
4. 最后完成任务 11 到 13，形成统一门禁和可审查提交；门禁失败则回到对应任务修复。
5. 部署负责人提供 staging 环境变量后执行任务 14；该任务完成后才进入外部基础设施上线流程。

**计划终点：** 代码、数据库、认证、安全和质量门禁达到可交付 staging 的状态；服务器、域名、公网平台和真实生产账号仍由部署阶段单独执行和验收。


10 将这个产品代码设计模块化归类 后续更好的维护 升级
