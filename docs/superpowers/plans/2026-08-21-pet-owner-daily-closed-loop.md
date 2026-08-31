# 已养宠用户日常闭环 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将游客浏览、真实认证、主宠档案、跨用户社区互动、服务端积分和个人中心结果连成一个 MySQL 驱动的日常闭环。

**Architecture:** 新增独立 `user_pets` 资源，保持 `virtual_pets` 仅服务云养宠。服务端继续拥有写入、权限和积分规则；前端服务层不再把 API 失败替换成伪造的认证、帖子或积分数据，而是让页面显示明确错误。个人中心只聚合各资源，不重复保存业务事实。

**Tech Stack:** Expo Router、React Native Web、TypeScript、Express 5、MySQL 9、mysql2、JWT、Node 内置 `fetch` 测试脚本。

---

## File Structure

- Create: `server/migrations/006_user_pets.sql` - 为既有数据库创建真实主宠档案表。
- Modify: `server/full_schema.sql` - 新库初始化时创建同一张表。
- Modify: `scripts/db-summary.js` - 检查 `user_pets` 表和关键列。
- Create: `server/routes/userPets.js` - 当前用户主宠的读取、创建、更新和删除 API。
- Modify: `server/index.js` - 注册主宠路由；保留 DB 端口配置。
- Modify: `server/test-api.js` - 双用户、主宠、游客只读、积分与跨用户互动 smoke 覆盖。
- Create: `src/services/userPetService.ts` - 主宠 API 封装和响应规范化。
- Create: `src/contexts/UserPetContext.tsx` - 当前用户主宠的加载/刷新/写入状态。
- Modify: `app/_layout.tsx` - 在 `AuthProvider` 内包裹 `UserPetProvider`。
- Modify: `app/(tabs)/pet.tsx`, `app/pet/[id].tsx` - 将第一阶段主宠入口从虚拟宠物状态分离。
- Modify: `app/(tabs)/profile.tsx` - 聚合真实主宠、积分、帖子和收藏。
- Modify: `src/services/authApi.ts`, `src/services/postService.ts`, `src/services/pointsService.ts` - 删除主应用路径中的本地伪成功降级。
- Modify: `app/(tabs)/community.tsx`, `app/(tabs)/wiki.tsx`, `app/(tabs)/profile.tsx` - 显示 API 失败、空数据与游客权限状态。
- Modify: `server/routes/points.js` - 移除用户可直接加分的 HTTP 路由，保留内部 `awardPoints`。
- Modify: `scripts/product-ui-smoke.js` - 以两个测试用户验证完整闭环。

## Task 1: 建立主宠档案数据库契约

**Files:**
- Create: `server/migrations/006_user_pets.sql`
- Modify: `server/full_schema.sql:115-133`
- Modify: `scripts/db-summary.js:24-30`

- [ ] **Step 1: 在 `server/test-api.js` 添加主宠 schema 前置断言并执行，确认当前 API 返回 404**

```js
const response = await request('GET', '/user-pets/me', null, true);
assert('GET /user-pets/me 在路由实现前返回 404', response.status === 404);
```

Run: `npm.cmd run test:server:smoke`
Expected: FAIL at the new assertion because the route does not exist.

- [ ] **Step 2: 创建 `server/migrations/006_user_pets.sql`**

```sql
CREATE TABLE IF NOT EXISTS user_pets (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  breed_id VARCHAR(50) NOT NULL,
  name VARCHAR(50) NOT NULL,
  birthday DATE NULL,
  gender ENUM('male', 'female', 'unknown') NOT NULL DEFAULT 'unknown',
  avatar_url VARCHAR(500) NULL,
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_primary_pet (user_id),
  CONSTRAINT fk_user_pets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_pets_breed FOREIGN KEY (breed_id) REFERENCES breeds(id),
  INDEX idx_user_pets_breed (breed_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- [ ] **Step 3: 将相同 `CREATE TABLE` 块加入 `server/full_schema.sql`，放在 `virtual_pets` 前，并在 `scripts/db-summary.js` 中添加列检查**

```js
requireColumn('user_pets', 'user_id'),
requireColumn('user_pets', 'breed_id'),
requireColumn('user_pets', 'is_primary'),
```

- [ ] **Step 4: 应用迁移并验证数据库结构**

Run: `cmd.exe /d /c "D:\MYSQL\bin\mysql.exe -u root -p pet_planet < server\migrations\006_user_pets.sql"`
Expected: exit code 0, no destructive schema operation.

Run: `npm.cmd run db:summary`
Expected: PASS and no missing `user_pets` column error.

- [ ] **Step 5: Commit**

```bash
git add server/migrations/006_user_pets.sql server/full_schema.sql scripts/db-summary.js server/test-api.js
git commit -m "Persist real primary pet profiles"
```

## Task 2: 实现主宠 API 与服务端权限

**Files:**
- Create: `server/routes/userPets.js`
- Modify: `server/index.js:60-71`
- Modify: `server/test-api.js`

- [ ] **Step 1: 将主宠行为测试写入 `server/test-api.js`，并运行确认失败**

```js
const initialPet = await request('GET', '/user-pets/me', null, true);
assert('新用户主宠为空', initialPet.status === 200 && initialPet.data.data === null);

const createdPet = await request('POST', '/user-pets/me', {
  breedId: 'golden-retriever', name: '团子', birthday: '2024-03-01', gender: 'male',
}, true);
assert('创建主宠返回 201', createdPet.status === 201);
assert('创建主宠返回昵称', createdPet.data.data?.name === '团子');
```

Run: `npm.cmd run test:server:smoke`
Expected: FAIL because `/api/user-pets/me` is not mounted.

- [ ] **Step 2: 创建 `server/routes/userPets.js`，实现统一映射与品种校验**

```js
function toUserPet(row) {
  if (!row) return null;
  return {
    id: row.id, breedId: row.breed_id, name: row.name,
    birthday: row.birthday, gender: row.gender, avatarUrl: row.avatar_url,
    isPrimary: Boolean(row.is_primary), createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

async function requireBreed(pool, breedId) {
  const [breeds] = await pool.execute('SELECT id FROM breeds WHERE id = ?', [breedId]);
  return breeds.length > 0;
}
```

Implement exactly these authenticated routes:

```text
GET    /me -> 200 { code: 0, data: UserPet | null }
POST   /me -> 201 when absent; 409 when current user already has a primary pet
PUT    /me -> 200 when current user has a primary pet; 404 when absent
DELETE /me -> 200 and deletes only req.user.id's row
```

For create/update, reject an unknown `breedId`, blank `name`, names longer than 50, invalid birthday strings, and genders outside `male|female|unknown` with 400. Use `req.user.id` in every SELECT/INSERT/UPDATE/DELETE.

- [ ] **Step 3: 在 `server/index.js` 挂载路由**

```js
const userPetRoutes = require('./routes/userPets');
app.use('/api/user-pets', userPetRoutes);
```

- [ ] **Step 4: 扩展 smoke 测试，覆盖更新、删除、无效品种和第二用户隔离**

```js
assert('无效品种被拒绝', invalidBreed.status === 400);
assert('更新主宠返回 200', updatedPet.status === 200);
assert('第二用户看不到第一用户主宠', secondUserPet.data.data === null);
assert('删除主宠返回 200', deletedPet.status === 200);
```

- [ ] **Step 5: 运行验证**

Run: `npm.cmd run test:server:smoke`
Expected: PASS, including all new main-pet assertions.

Run: `npm.cmd run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/routes/userPets.js server/index.js server/test-api.js
git commit -m "Expose private primary pet profiles"
```

## Task 3: 删除多用户闭环中的伪数据降级

**Files:**
- Modify: `src/services/authApi.ts:115-174`
- Modify: `src/services/postService.ts:10-245`
- Modify: `src/services/pointsService.ts:1-165`
- Modify: `server/routes/points.js:168-187`
- Modify: `server/test-api.js`

- [ ] **Step 1: 为积分公开加分接口写入失败测试**

```js
const earnResponse = await request('POST', '/points/earn', {
  amount: 5000, type: 'reward', description: '客户端任意加分',
}, true);
assert('客户端不能调用任意加分接口', earnResponse.status === 404);
```

Run: `npm.cmd run test:server:smoke`
Expected: FAIL because the current route returns 200.

- [ ] **Step 2: 从 `server/routes/points.js` 删除 `router.post('/earn', ...)`，保留并导出 `awardPoints`**

The following server-side call sites remain valid and are the only reward sources in this phase:

```js
await awardPoints(pool, userId, totalPoints, 'check_in', description);
await awardPoints(pool, userId, 5, 'post', '发布帖子', postId);
await awardPoints(pool, userId, 2, 'comment', '发表评论', commentId);
```

- [ ] **Step 3: 删除主应用路径的 Mock 降级**

In `src/services/authApi.ts`, delete `getMockUsers`, `saveMockUsers`, `mockRegister`, `mockLogin` and any catch block that returns their result.

In `src/services/postService.ts`, delete mock users/posts and change `getPosts` and `getPostById` to propagate the API/timeout error:

```ts
const response = await Promise.race([
  request<PostListResponse>(`/api/posts?${params}`),
  timeoutAfter(POSTS_REQUEST_TIMEOUT_MS),
]);
return { data: (response.data || []).map(normalizePost), total: response.pagination?.total || 0, page: response.pagination?.page || page };
```

In `src/services/pointsService.ts`, remove localStorage/AsyncStorage fallback helpers and let `getSummary`, `getTodayStatus`, `checkIn`, `spendPoints`, and `getHistory` propagate `ApiError`.

Remove `addPoints` from the public client service because no normal UI may mint points.

- [ ] **Step 4: 更新受影响页面的错误状态而非伪成功**

For each existing loader, preserve last successfully received server data only while a refresh is pending. On first-load failure, render a retry action and the user-facing message `暂时无法连接服务，请稍后重试`.

Apply this behavior to:

```text
app/(tabs)/community.tsx
app/(tabs)/profile.tsx
app/points-shop.tsx
```

- [ ] **Step 5: 验证受控积分与 API 行为**

Run: `npm.cmd run test:server:smoke`
Expected: PASS; post/comment/check-in rewards pass, direct `/points/earn` assertion passes.

Run: `npm.cmd run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/services/authApi.ts src/services/postService.ts src/services/pointsService.ts app/(tabs)/community.tsx app/(tabs)/profile.tsx app/points-shop.tsx server/routes/points.js server/test-api.js
git commit -m "Make community data server authoritative"
```

## Task 4: 在前端接入真实主宠档案

**Files:**
- Create: `src/services/userPetService.ts`
- Create: `src/contexts/UserPetContext.tsx`
- Modify: `app/_layout.tsx`
- Modify: `app/(tabs)/pet.tsx`
- Modify: `app/pet/[id].tsx`

- [ ] **Step 1: 创建前端服务类型与 API 封装**

```ts
export interface UserPet {
  id: string;
  breedId: string;
  name: string;
  birthday: string | null;
  gender: 'male' | 'female' | 'unknown';
  avatarUrl: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export const userPetService = {
  getMine: async (): Promise<UserPet | null> => { /* GET /user-pets/me */ },
  createMine: async (input: UserPetInput): Promise<UserPet> => { /* POST */ },
  updateMine: async (input: UserPetInput): Promise<UserPet> => { /* PUT */ },
  deleteMine: async (): Promise<void> => { /* DELETE */ },
};
```

- [ ] **Step 2: 创建 `UserPetContext` 并使认证状态成为加载边界**

```ts
export interface UserPetContextValue {
  pet: UserPet | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  refresh: () => Promise<void>;
  save: (input: UserPetInput) => Promise<UserPet>;
  remove: () => Promise<void>;
}
```

When `AuthContext.status !== 'authenticated'`, clear pet, error, and loading state. When authenticated, call `getMine`; no `AsyncStorage` persistence is permitted for this resource.

- [ ] **Step 3: 在 `app/_layout.tsx` 包装 Provider 并替换第一阶段入口**

```tsx
<AuthProvider>
  <UserPetProvider>
    <RootNavigator />
  </UserPetProvider>
</AuthProvider>
```

Keep the current virtual-pet `PetProvider` only for future cloud-pet screens; do not read it in profile/main-pet flows.

- [ ] **Step 4: 将 `app/(tabs)/pet.tsx` 改为主宠档案页**

The page must have these states:

```text
未登录：登录引导
加载中：固定高度加载状态
无档案：选择品种、昵称、生日、性别后创建
有档案：显示主宠并允许编辑或删除
API 失败：错误文案和重试按钮
```

Use existing breed search/data only to choose a `breedId`; submit the selected id to `userPetService`.

- [ ] **Step 5: 运行前端验证**

Run: `npm.cmd run typecheck`
Expected: PASS.

Run: `npm.cmd run test:ui:smoke`
Expected: update script in Task 5 before this command; it must pass after main-pet flow is included.

- [ ] **Step 6: Commit**

```bash
git add src/services/userPetService.ts src/contexts/UserPetContext.tsx app/_layout.tsx app/(tabs)/pet.tsx app/pet/[id].tsx
git commit -m "Connect primary pet profile to API"
```

## Task 5: 聚合个人中心并完成双用户闭环回归

**Files:**
- Modify: `app/(tabs)/profile.tsx`
- Modify: `scripts/product-ui-smoke.js`
- Modify: `server/test-api.js`

- [ ] **Step 1: 定义个人中心的真实数据加载合同**

```ts
const [petResult, pointsResult, postsResult, bookmarksResult] = await Promise.allSettled([
  userPetService.getMine(),
  pointsService.getSummary(),
  getUserPosts(user.id, 1, 1),
  getBookmarks(1, 1),
]);
```

For each rejected result, show its section-level retry state. Do not replace values with mock counts. The header remains usable when one section fails.

- [ ] **Step 2: 写入两用户后端闭环断言并在实现前确认失败**

```js
assert('用户 B 能读取用户 A 的帖子', secondUserPostList.data.data.some((post) => post.id === postId));
assert('用户 B 评论 A 的帖子成功', secondUserComment.status === 201);
assert('用户 B 收藏只出现在 B 的收藏中', secondUserBookmarks.data.data.some((item) => item.postId === postId));
assert('用户 A 的主宠仍为 A 的档案', firstUserPet.data.data?.name === '团子');
```

Run: `npm.cmd run test:server:smoke`
Expected: FAIL until the test script creates and switches the second authenticated user.

- [ ] **Step 3: 扩展 `server/test-api.js` 的第二用户辅助状态**

Use a second local token variable and a request helper accepting an explicit token:

```js
async function requestAs(method, path, body, accessToken) {
  return request(method, path, body, false, accessToken);
}
```

Register user B, query A's public post, create B's comment, toggle B's bookmark, check B's bookmark list, then restore A's token to test A's primary pet and point summary. Use unique timestamp-derived usernames and phones so smoke runs remain repeatable.

- [ ] **Step 4: 扩展 `scripts/product-ui-smoke.js` 的可见闭环**

Add test IDs:

```text
primary-pet-create-breed
primary-pet-name-input
primary-pet-birthday-input
primary-pet-gender-male
primary-pet-save-btn
profile-primary-pet-name
profile-points-value
profile-check-in-btn
```

The UI smoke flow must do:

```text
游客打开百科 -> 进入社区 -> 点击发帖并看到登录引导 -> 注册 A
-> 创建主宠 -> 发帖 -> 注册 B -> 评论/收藏 A 帖子
-> 登录 A -> 签到 -> 打开个人中心并断言主宠、积分和收藏入口
```

- [ ] **Step 5: 运行完整验证**

Run: `npm.cmd run typecheck`
Expected: PASS.

Run: `npm.cmd run db:summary`
Expected: PASS and required `user_pets` columns exist.

Run: `npm.cmd run test:server:smoke`
Expected: PASS with user A/B, main-pet and points assertions.

Run: `npm.cmd run test:ui:smoke`
Expected: PASS and JSON output includes `guest-browse`, `create-primary-pet`, `create-post`, `comment-post`, `bookmark-post`, `check-in`, `profile-results`.

- [ ] **Step 6: Commit**

```bash
git add app/(tabs)/profile.tsx scripts/product-ui-smoke.js server/test-api.js
git commit -m "Verify the pet owner daily loop"
```

## Final Verification

- [ ] Run `git diff --check` and expect no whitespace errors.
- [ ] Run `npm.cmd run typecheck` and expect exit code 0.
- [ ] Run `npm.cmd run db:summary` and expect `user_pets` required-column checks to pass.
- [ ] Run `npm.cmd run test:server:smoke` and expect all assertions to pass.
- [ ] Run `npm.cmd run test:ui:smoke` and expect the real browser flow to pass.
- [ ] Run `git status --short`; report all intentional files and any smoke-generated database records.
