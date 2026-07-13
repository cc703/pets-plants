# 萌宠星球上线计划清单

生成日期：2026-07-13  
适用仓库：`D:\桌面\宠物星球\pet-planet`  
计划模式：`$plan` direct  
当前目标：把已本地闭环的 Expo Web + Express + MySQL 项目推进到可公网访问、可回滚、可验证的上线状态。

## 1. 当前事实

- 前端是 Expo Router / React Native Web 项目，开发启动脚本为 `npm.cmd run web`，当前缺少生产构建脚本。参考：`package.json:40`。
- 已有基础验证脚本：`typecheck`、`test:server:smoke`、`db:summary`、`verify`。参考：`package.json:41`、`package.json:42`、`package.json:45`、`package.json:48`。
- 后端是 Express 服务，入口为 `server/index.js`，生产端口由 `PORT` 环境变量决定。参考：`server/index.js:19`、`server/index.js:167`。
- 后端通过 `server/.env` 读取配置，并连接 MySQL 连接池。参考：`server/index.js:5`、`server/index.js:28`。
- 上传文件当前由本地 `server/uploads` 静态目录提供。参考：`server/index.js:25`。
- 健康检查接口已存在：`GET /api/health`。参考：`server/index.js:111`。
- 应用已有 Expo 基础元信息、scheme、iOS bundle id、Android package 和 Web favicon。参考：`app.json:3`、`app.json:4`、`app.json:9`、`app.json:12`、`app.json:21`、`app.json:23`。
- 本地敏感文件已被忽略：`server/.env`、`server/uploads`、构建产物目录。参考：`.gitignore:8`、`.gitignore:9`、`.gitignore:35`、`.gitignore:50`。

## 2. 上线范围决策

默认先上线 Web MVP，移动端打包作为第二阶段。

- [ ] 决定正式访问域名，例如 `petplanet.example.com`。
- [ ] 决定 API 域名，例如 `api.petplanet.example.com`。
- [ ] 决定部署平台：
  - 推荐轻量路径：前端静态托管 + 后端云服务器/容器 + 云 MySQL。
  - 备选一体化路径：一台云服务器部署 Nginx、Node、MySQL。
- [ ] 决定是否同步做 App 包发布：
  - 不做：本计划只覆盖 Web 上线。
  - 做：额外补 `eas.json`、应用签名、隐私政策、应用商店资料。

验收标准：

- [ ] 有明确前端域名、API 域名、部署平台、数据库方案。
- [ ] Web MVP 与 App 打包边界分开，不混在同一批上线任务里。

## 3. 环境变量与密钥

上线前必须完成，不能用本地 `.env` 直搬生产。

- [ ] 新建 `server/.env.example`，只保留变量名和示例值，不写真实密钥。
- [ ] 生产环境配置以下变量：
  - `PORT`
  - `DB_HOST`
  - `DB_PORT`
  - `DB_USER`
  - `DB_PASSWORD`
  - `DB_NAME`
  - `JWT_SECRET`
  - `JWT_REFRESH_SECRET`
  - `JWT_EXPIRES_IN`
  - `JWT_REFRESH_EXPIRES_IN`
  - `UPLOAD_DIR`
  - `DEEPSEEK_API_KEY`
- [ ] 前端生产环境配置 `EXPO_PUBLIC_API_BASE_URL`，指向线上 API 根地址。
- [ ] 轮换当前本地用过或可能暴露过的 DeepSeek Key、JWT Secret。
- [ ] 确认生产密钥只存放在部署平台 Secret / 服务器环境变量中。

验收标准：

- [ ] `git ls-files server/.env` 无输出。
- [ ] 生产环境不依赖本地 `server/.env`。
- [ ] 前端访问线上 API，不再访问 `localhost:3000`。

## 4. 数据库上线

- [ ] 选择生产 MySQL：
  - 推荐：云 MySQL。
  - 可接受：服务器自建 MySQL，但必须有备份策略。
- [ ] 创建生产库 `pet_planet`。
- [ ] 使用唯一 schema 初始化入口：
  - 全新库优先使用 `server/full_schema.sql`。
  - 若继续使用迁移链，确认 migrations 顺序完整且可重复执行。
- [ ] 导入必要基础数据：品种、圈子、初始配置。
- [ ] 禁止导入本地 smoke 测试用户和测试帖子。
- [ ] 配置每日自动备份。
- [ ] 配置最小权限数据库账号，后端不使用 root。

验收标准：

- [ ] 生产环境 `npm.cmd run db:summary` 等价检查可读取 users/posts/comments/bookmarks/circles。
- [ ] 后端 smoke 能在生产数据库上通过，或在 staging 数据库上通过后再切生产。
- [ ] 有数据库备份和恢复路径。

## 5. 后端部署

- [ ] 新增生产启动方式：
  - 推荐：PM2 或 Docker。
  - 当前开发方式 `node index.js` 只能作为本地方式。
- [ ] 配置进程守护：
  - 服务崩溃自动重启。
  - 服务器重启后自动拉起。
- [ ] 配置日志：
  - access log。
  - error log。
  - 按日期滚动或接入云日志。
- [ ] 配置反向代理：
  - Nginx 将 `api.petplanet.example.com` 转发到 Node `PORT`。
  - 只开放 80/443，不直接暴露 Node 端口。
- [ ] 配置 HTTPS 证书。
- [ ] 配置 CORS，只允许正式前端域名。
- [ ] 配置上传目录持久化，或迁移到对象存储。

验收标准：

- [ ] `GET https://api.../api/health` 返回 `{ "status": "ok" }`。
- [ ] 服务器重启后 API 自动恢复。
- [ ] 后端日志可定位请求错误。
- [ ] 非授权域名不能随意跨域调用 API。

## 6. 前端 Web 部署

- [ ] 增加生产构建脚本，例如 `build:web`。
- [ ] 使用生产 API 地址构建：
  - `EXPO_PUBLIC_API_BASE_URL=https://api...`
- [ ] 生成静态 Web 产物。
- [ ] 部署到静态托管平台或 Nginx 静态目录。
- [ ] 配置 SPA 路由 fallback，刷新任意页面不 404。
- [ ] 配置 HTTPS。
- [ ] 验证 favicon、图标、首屏、社区页、百科页、登录页。

验收标准：

- [ ] `https://petplanet...` 可访问首页。
- [ ] 刷新 `/community`、`/wiki`、`/breed/...` 不 404。
- [ ] 前端请求线上 API 域名。
- [ ] 浏览器控制台无关键运行时错误。

## 7. 上传与媒体

当前 `server/uploads` 是本地目录，正式上线前至少做持久化。

- [ ] 短期方案：服务器磁盘持久化 `uploads`，并纳入备份。
- [ ] 推荐方案：迁移到对象存储和 CDN。
- [ ] 限制上传大小、图片格式、文件头。
- [ ] 去除 EXIF 隐私信息。
- [ ] 配置图片访问域名。
- [ ] 后续接入内容审核。

验收标准：

- [ ] 上传头像后刷新页面仍可访问。
- [ ] 发帖图片公网可访问。
- [ ] 上传非图片文件被拒绝。
- [ ] 迁移或重启服务不丢上传文件。

## 8. 安全加固

- [ ] 禁用生产 mock auth。
- [ ] 确认密码重置链路必须依赖一次性验证码或 token。
- [ ] 登录、注册、短信、AI 问答接口加限流。
- [ ] JWT secret 与 refresh secret 使用强随机值。
- [ ] Web refresh token 存储策略重新评估，优先 HttpOnly Secure Cookie。
- [ ] 用户生成内容统一转义，防 XSS。
- [ ] 图片、帖子、评论接入举报和审核流程。
- [ ] 关闭生产环境 debug token 返回。

验收标准：

- [ ] 错误验证码不能重置密码。
- [ ] 登录暴力尝试会被限流。
- [ ] 前端无生产 mock 登录分支生效。
- [ ] 生产响应不暴露堆栈、debug token、数据库错误详情。

## 9. 观测与运维

- [ ] 健康检查：`/api/health`。
- [ ] API 错误日志。
- [ ] 数据库连接失败告警。
- [ ] DeepSeek 调用失败率和额度监控。
- [ ] 磁盘空间监控，尤其是 uploads。
- [ ] 数据库备份成功/失败通知。
- [ ] 关键接口延迟监控：登录、发帖、评论、AI 问答。

验收标准：

- [ ] API 挂掉能收到告警。
- [ ] MySQL 不可用能收到告警。
- [ ] 磁盘接近容量上限能收到告警。
- [ ] 可以通过日志定位某次用户请求失败原因。

## 10. CI/CD 与发布流程

- [ ] 建立 staging 环境。
- [ ] 每次合并到主分支前运行：
  - `npm.cmd run typecheck`
  - `npm.cmd run test:server:smoke`
  - `npm.cmd run db:summary`
- [ ] 发布前运行完整验收：
  - 登录
  - 注册
  - 百科搜索
  - 社区发帖
  - 评论
  - 收藏
  - 图片上传
  - AI 问答
- [ ] 建立回滚策略：
  - 前端静态产物保留上一版。
  - 后端保留上一版镜像或发布包。
  - 数据库迁移必须有回滚说明。

验收标准：

- [ ] 可以一键部署 staging。
- [ ] 可以从 staging 晋级 production。
- [ ] 发布失败时 10 分钟内可回滚。

## 11. 移动端上线附加清单

仅当要发布 iOS / Android 时执行。

- [ ] 新增 `eas.json`。
- [ ] 确认 Expo 账号和项目绑定。
- [ ] 确认 iOS bundle id：`com.petplanet.app`。
- [ ] 确认 Android package：`com.petplanet.app`。
- [ ] 准备应用图标、启动图、截图。
- [ ] 准备隐私政策、用户协议。
- [ ] 说明相册、相机权限用途。
- [ ] 配置生产 API 地址。
- [ ] 生成 preview 包测试。
- [ ] 再生成 production 包。

验收标准：

- [ ] Android 安装包可安装并能登录。
- [ ] iOS TestFlight 可安装并能登录。
- [ ] 拍照/相册上传权限说明符合商店要求。

## 12. 分阶段执行顺序

### P0：上线前必须完成

- [ ] 选定部署平台、域名、数据库。
- [ ] 增加 `server/.env.example`。
- [ ] 轮换密钥。
- [ ] 配置生产 MySQL。
- [ ] 配置后端进程守护。
- [ ] 配置 HTTPS 和反向代理。
- [ ] 增加前端生产构建脚本。
- [ ] 前端接线上 API。
- [ ] 跑通 staging 验收。

### P1：上线当天必须完成

- [ ] 生产库初始化。
- [ ] 后端部署。
- [ ] 前端部署。
- [ ] 域名解析。
- [ ] HTTPS 生效。
- [ ] 跑生产 smoke。
- [ ] 手动走核心链路。
- [ ] 记录版本号和回滚包。

### P2：上线后 1 周内完成

- [ ] 上传迁移到对象存储。
- [ ] 增加告警。
- [ ] 增加 Redis 或生产级限流。
- [ ] 增加内容审核。
- [ ] 清理 mock / 测试兜底开关。
- [ ] 拆分过大页面和后端 route。

## 13. 验收命令

本地或 staging：

```powershell
npm.cmd run typecheck
npm.cmd run db:summary
npm.cmd run test:server:smoke
```

生产健康检查：

```powershell
Invoke-WebRequest -UseBasicParsing -Uri "https://api.example.com/api/health"
```

Git 状态：

```powershell
git status --short
git rev-list --left-right --count "origin/main...HEAD"
```

## 14. 上线完成定义

只有同时满足以下条件，才算上线完成：

- [ ] 用户能通过正式域名打开前端。
- [ ] 用户能注册、登录、刷新登录状态。
- [ ] 用户能浏览百科、搜索品种、进入详情。
- [ ] 用户能浏览社区、发帖、评论、点赞、收藏。
- [ ] 用户能上传头像或帖子图片。
- [ ] AI 问答能返回内容。
- [ ] 生产数据库有备份。
- [ ] API 有健康检查、日志和基础告警。
- [ ] 密钥不在 Git 中。
- [ ] 有明确回滚方案。

## 15. ADR

### Decision

先按 Web MVP 上线，后端和数据库独立部署；移动端商店发布作为第二阶段。

### Drivers

- 当前项目已本地闭环，但缺少生产部署配置。
- Web 上线最快，可以先验证真实用户访问和 API 稳定性。
- 移动端发布需要额外账号、签名、隐私政策、审核材料，不应阻塞 Web MVP。

### Alternatives Considered

- 一次性 Web + iOS + Android 全部上线：覆盖面完整，但风险高、准备项多、审核周期不可控。
- 只保留本地演示：成本低，但无法验证真实公网环境和生产运维问题。
- Web MVP 先上线：范围可控，能最快形成真实闭环。

### Why Chosen

Web MVP 先上线能最小化发布风险，同时保留后续移动端扩展空间。

### Consequences

- 需要先把前端生产构建、后端部署、数据库和域名 HTTPS 打通。
- 移动端相关的 EAS、商店资料和签名可以后置。
- 必须尽快补生产密钥、上传存储、限流和监控。

### Follow-ups

- 下一步建议先执行 P0 清单。
- 完成 P0 后再进入 staging 验收。
- staging 验收通过后再切 production。
