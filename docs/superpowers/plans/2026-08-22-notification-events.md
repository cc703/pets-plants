# 通知事件真实生成 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将评论/回复、点赞、关注产生的通知写入同一数据库事务，并用服务端与 UI 冒烟验证通知闭环。

**Architecture:** 新增事务内通知写入 helper，接收已打开的 MySQL connection，只执行参数化 INSERT，不负责提交或回滚。评论、帖子点赞、用户关注路由在各自已有事务中调用 helper；取消动作和收藏路由不产生通知。通知读取继续复用现有 `/api/notifications`。

**Tech Stack:** Express 5, mysql2/promise, UUID, Node smoke tests, Expo Router UI smoke.

---

### Task 1: 建立通知写入 helper 与失败测试

**Files:**
- Create: `server/utils/notifications.js`
- Modify: `server/test-api.js`

- [ ] **Step 1: Add a server smoke assertion for a real notification insert**

在 `test-api.js` 增加 `testNotifications()` 的前置断言：读取 A 当前未读数，使用 B 对 A 的帖子发表评论，然后读取 A 通知列表，断言新增记录的 `type=comment`、`fromUser.id=secondUserId` 和 `targetId=postId`。

- [ ] **Step 2: Run the focused server smoke and confirm the new assertion fails**

Run: `npm.cmd run test:server:smoke`

Expected: existing API checks pass until the new comment notification assertion fails because no notification row is created.

- [ ] **Step 3: Implement the minimal transaction helper**

Create `server/utils/notifications.js`:

```js
const { v4: uuidv4 } = require('uuid');

async function createNotification(connection, {
  userId,
  fromUserId = null,
  type,
  targetType = null,
  targetId = null,
  content,
}) {
  if (!userId || !type || !content) return;
  if (fromUserId && userId === fromUserId) return;
  await connection.execute(
    `INSERT INTO notifications
      (id, user_id, from_user_id, type, target_type, target_id, content, is_read)
     VALUES (?, ?, ?, ?, ?, ?, ?, FALSE)`,
    [uuidv4(), userId, fromUserId, type, targetType, targetId, content],
  );
}

module.exports = { createNotification };
```

- [ ] **Step 4: Run syntax checks**

Run: `node.exe --check server/utils/notifications.js`

Expected: exit code 0.

### Task 2: Connect comment and reply notifications

**Files:**
- Modify: `server/routes/comments.js`
- Modify: `server/test-api.js`

- [ ] **Step 1: Add reply-specific smoke coverage**

Create a top-level comment by B, then create a reply by A or B with `parentId`; assert the intended recipient receives `type=reply`. Preserve the existing top-level `type=comment` assertion.

- [ ] **Step 2: Run the focused smoke and confirm the reply assertion fails**

Run: `npm.cmd run test:server:smoke`

Expected: the new reply assertion fails before route integration.

- [ ] **Step 3: Add notification creation inside the existing comment transaction**

After inserting the comment and before `connection.commit()`:

```js
const { createNotification } = require('../utils/notifications');
const recipientId = parentId
  ? (await connection.execute('SELECT user_id FROM comments WHERE id = ?', [parentId]))[0][0]?.user_id
  : posts[0].user_id;
await createNotification(connection, {
  userId: recipientId,
  fromUserId: req.user.id,
  type: parentId ? 'reply' : 'comment',
  targetType: parentId ? 'comment' : 'post',
  targetId: parentId || postId,
  content: parentId ? '回复了你的评论' : '评论了你的帖子',
});
```

If the parent comment has no valid owner, use the locked post owner as recipient. The helper prevents self-notification.

- [ ] **Step 4: Run the server smoke**

Run: `npm.cmd run test:server:smoke`

Expected: top-level comment and reply notification assertions pass.

### Task 3: Connect post-like notifications

**Files:**
- Modify: `server/routes/posts.js`
- Modify: `server/test-api.js`

- [ ] **Step 1: Add like notification assertions**

Before B toggles the post like, record A unread count. After B likes A's post, assert A receives a `like` notification. Toggle B again to unlike and assert A's unread count does not increase a second time.

- [ ] **Step 2: Run the server smoke and confirm the like assertion fails**

Run: `npm.cmd run test:server:smoke`

Expected: the new like notification assertion fails before route integration.

- [ ] **Step 3: Make the like route transactional and emit only on like creation**

Use one connection and transaction for the post lock, relation insert/delete, stats update, and notification. Lock the post with `SELECT user_id, stats ... FOR UPDATE`, call `createNotification` only in the insert branch with `type: 'like'`, `targetType: 'post'`, and content `赞了你的帖子`, then commit. Roll back on all errors.

- [ ] **Step 4: Run the server smoke**

Run: `npm.cmd run test:server:smoke`

Expected: like creation, unlike idempotence, and existing post tests pass.

### Task 4: Connect follow notifications

**Files:**
- Modify: `server/routes/users.js`
- Modify: `server/test-api.js`

- [ ] **Step 1: Add follow notification assertions**

Have B follow A and assert A receives `type=follow` with `targetType=user`; have B unfollow and assert the unfollow path does not add a new notification.

- [ ] **Step 2: Run the server smoke and confirm the assertion fails**

Run: `npm.cmd run test:server:smoke`

Expected: follow notification assertion fails before route integration.

- [ ] **Step 3: Make the follow creation path transactional and emit one notification**

Use a transaction around relation insert and count update. Call `createNotification` only after a new follow row is inserted, with recipient `targetId`, sender `req.user.id`, `type: 'follow'`, `targetType: 'user'`, `targetId`, and content `关注了你`. Keep self-follow as HTTP 400 and keep unfollow notification-free.

- [ ] **Step 4: Run the server smoke**

Run: `npm.cmd run test:server:smoke`

Expected: all existing tests plus the follow notification assertions pass.

### Task 5: Verify notification UI and finish the task

**Files:**
- Modify: `scripts/product-ui-smoke.js`
- Modify: `app/(tabs)/notification.tsx` only if a verified navigation defect is found.

- [ ] **Step 1: Extend UI smoke with a real notification check**

After the smoke user posts and comments, open `/notification`, wait for the server-backed notification list, and assert the created interaction text is visible. Do not add mock data or bypass the API.

- [ ] **Step 2: Run full verification**

Run:

```powershell
npm.cmd run typecheck
npm.cmd run test:server:smoke
node.exe scripts/product-ui-smoke.js
git diff --check
```

Expected: typecheck passes, server smoke reports zero failures, UI smoke prints `ok: true`, and diff check reports no whitespace errors.

- [ ] **Step 3: Record the next plan**

After verification, inspect remaining gaps and propose the next bounded module. Likely candidates are replacing hardcoded circle data or removing notification service mock declarations, but choose based on fresh evidence rather than assumption.
