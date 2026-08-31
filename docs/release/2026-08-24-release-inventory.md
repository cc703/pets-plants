# 2026-08-24 发布变更清单

## 目的

记录本轮上线前收口的文件范围、验证命令和已知阻塞，避免将既有业务变更、临时产物或本地密钥混入发布提交。

## 当前边界

- 本清单只覆盖代码、数据库脚本、测试和发布文档。
- 服务器、域名、DNS、证书、公网平台、进程托管和生产账号由部署阶段单独负责。
- `server/.env` 只作为本地运行配置，不得加入版本库。

## 变更分组

| 分组 | 主要文件 | 验证命令 | 状态 |
| --- | --- | --- | --- |
| 数据库与迁移 | `server/full_schema.sql`、`server/migrations/*.sql`、`scripts/migration-*.test.js` | `npm run test:migrations` | fresh schema 与 legacy 002-010 双次升级已在隔离临时库通过；旧库演练报告为 PASS |
| 认证与邮箱 | `server/routes/auth.js`、`server/services/emailService.js`、`server/utils/email*.js`、认证页面 | `npm run test:server:smoke`、`npm run test:unit`、Mailpit 端到端 | 接口和前端已接入；Mailpit/真实邮件闭环未验证 |
| 宠物与个人中心 | `server/routes/user-pets.js`、`src/contexts/UserPetContext.tsx`、宠物页面 | `npm run test:ui:smoke` | 已有闭环，需保持回归通过 |
| 社区、通知与圈子 | `server/routes/posts.js`、`comments.js`、`circles.js`、相关页面和服务 | `npm run test:server:smoke`、`npm run test:ui:smoke` | 已有闭环，需保持回归通过 |
| 上传与运行时安全 | `server/index.js`、上传路由/服务、运行时配置、限流 | `npm run test:unit`、服务端烟测、`npm run typecheck` | 已完成本地验证 |
| 质量与发布 | `scripts/pre-release-verify.ps1`、发布文档、清理脚本 | `npm run verify:pre-release` | 已通过完整门禁 |

## 不应提交的内容

- `server/.env`、其他包含密钥的环境文件。
- `server/uploads` 中的测试或用户文件。
- Chrome 临时用户目录、截图、日志、`dist` 和 Expo 缓存产物。
- 临时数据库导出、密码、邮件 token、验证码和 JWT。

## 当前已验证基线

- `npm run typecheck`：通过。
- `npm run build:web`：通过。
- `npm run test:server:smoke`：167 通过，0 失败。
- `npm run test:ui:smoke`：已通过并执行过测试数据清理。
- `npm run test:migrations`：迁移契约、fresh schema 和 legacy 002-010 双次执行在隔离临时库通过。
- `npm run db:summary`：当前数据库无 UI 烟测用户、帖子、评论、收藏和宠物残留。

## 发布前必达

- [x] legacy 002-010 迁移连续执行两遍无错误。
- [x] 旧库演练报告为 PASS，包含字段、索引、约束断言。
- [ ] 邮箱激活和验证码登录在本地邮件沙箱中闭环；当前仅完成未配置时的明确配置错误和本地单元检查。
- [x] 上传、XSS、限流、生产配置和 AI 上游失败路径有自动化证据。
- [x] `npm run verify:pre-release` 全部通过。
- [ ] 最终 diff 不含密钥、临时产物和非本轮变更。
