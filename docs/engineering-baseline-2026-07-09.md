# 工程化基线说明

生成时间：2026-07-09  
适用项目：宠物星球 `pet-planet`

## 1. 本阶段目标

本阶段重点是把项目从“能跑起来”整理成“可重复启动、可重复验证、可安全继续开发”的工程基线。

当前基线包含：

- 根目录统一启动脚本。
- 数据库结构漂移检查。
- 后端 API smoke。
- UI smoke。
- 邮箱找回密码 Token 机制。
- 数据库持久化限流桶。
- 提交前检查清单。

## 2. 启动命令

启动后端：

```bash
npm.cmd run server
```

启动后端开发模式：

```bash
npm.cmd run server:dev
```

启动前端 Web：

```bash
npm.cmd run web
```

当前本机已验证端口：

| 端口 | 服务 |
| --- | --- |
| 3000 | Express API |
| 8081 | Expo Web / Metro |

## 3. 数据库迁移

新增迁移：

```text
server/migrations/005_email_reset_and_rate_limit.sql
```

包含：

- `email_reset_tokens`：邮箱找回密码的一次性 Token。
- `rate_limit_buckets`：接口限流桶。

执行方式：

```bash
mysql -u root -p pet_planet < server/migrations/005_email_reset_and_rate_limit.sql
```

如果是全新数据库，可以直接执行：

```bash
mysql -u root -p < server/full_schema.sql
```

## 4. 验证命令

完整工程基线验证：

```bash
npm.cmd run verify
```

分项验证：

```bash
npm.cmd run typecheck
npm.cmd run db:summary
npm.cmd run test:server:smoke
npm.cmd run test:ui:smoke
```

## 5. 账号安全基线

当前密码找回支持两条路径：

- 手机号验证码重置。
- 邮箱一次性 Token 重置。

邮箱重置策略：

- Token 存储为 bcrypt hash。
- Token 有效期 15 分钟。
- 新 Token 生成时，旧 Token 自动作废。
- Token 使用后标记为已使用。
- 重置成功后删除该用户所有 refresh token。
- 非生产环境返回 `debugToken` 方便本地测试。
- 生产环境不返回明文 Token，后续应接入真实邮件服务。

## 6. 限流基线

当前限流策略：

- 优先使用 MySQL 表 `rate_limit_buckets`。
- 如果数据库不可用，自动退回内存限流。
- 认证接口默认 15 分钟 80 次。
- AI 接口默认 1 分钟 20 次。

后续生产增强建议：

- 多实例部署时迁移到 Redis。
- 对登录失败、验证码发送、AI 问答设置更细粒度规则。
- 增加限流命中日志与告警。

## 7. 提交基线建议

当前项目主体目录在 Git 中仍显示为未跟踪。建议提交前按以下顺序处理：

1. 确认 `.env`、上传文件、缓存、构建产物不进入提交。
2. 运行 `npm.cmd run verify`。
3. 运行 `npm.cmd run test:ui:smoke`。
4. 检查 `git status --short`。
5. 将当前可运行版本作为基线提交。

推荐提交信息遵循项目 AGENTS.md 中的 Lore Commit Protocol。

## 8. 当前边界

此基线不包含：

- 真实邮件发送服务。
- Redis 限流。
- 生产部署脚本。
- CI/CD 配置。
- 真实商城订单、支付和物流。

这些内容应作为后续阶段独立推进。
