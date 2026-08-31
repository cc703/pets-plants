/**
 * 萌宠星球 - 后端 API 全面测试脚本
 * 用法: node test-api.js
 */

const BASE = 'http://localhost:3000/api';
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const pool = require('./db');
const { hashLoginCode } = require('./utils/emailLoginCode');
const { hashVerificationToken } = require('./utils/emailVerification');
let token = null;
let secondToken = null;
let refreshToken = null;
let userId = null;
let secondUserId = null;
let username = null;
let phone = null;
let email = null;
let postId = null;
let secondPostId = null;
let commentId = null;
let circleId = null;
let defaultCirclePostCount = null;
let passed = 0;
let failed = 0;

async function request(method, path, body = null, useAuth = false, authToken = token) {
  const headers = { 'Content-Type': 'application/json' };
  if (useAuth && authToken) headers['Authorization'] = `Bearer ${authToken}`;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function resetLocalRateLimitBuckets() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to reset rate-limit buckets in production');
  }
  await pool.execute('DELETE FROM rate_limit_buckets');
}

async function registerTestUser(label) {
  const now = Date.now().toString();
  const name = `${label}${now.slice(-10)}${Math.floor(Math.random() * 1000)}`;
  const response = await request('POST', '/auth/register', {
    username: name,
    password: 'Test1234',
    nickname: `测试用户${label}`,
    phone: `138${now.slice(-8)}`,
    email: `${name}@example.test`,
  });
  requireSuccess(`注册测试用户 ${label} 返回 201`, response, 201, (data) => data.message || JSON.stringify(data));
  return {
    username: name,
    token: response.data.data?.accessToken,
    refreshToken: response.data.data?.refreshToken,
    userId: response.data.data?.user?.id,
  };
}

function assert(name, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`);
  }
}

function requireSuccess(name, response, expectedStatus, detailSelector) {
  if (response.status !== expectedStatus) {
    const detail = detailSelector ? detailSelector(response.data) : JSON.stringify(response.data);
    assert(name, false, `expected ${expectedStatus}, got ${response.status}; ${detail}`);
    throw new Error(`${name} failed`);
  }
  assert(name, true);
}

// ==================== 测试用例 ====================

async function testHealth() {
  console.log('\n📌 健康检查');
  const { status, data } = await request('GET', '/health');
  assert('GET /health 返回 200', status === 200);
  assert('状态为 ok', data.status === 'ok');
}

async function testAuth() {
  console.log('\n📌 认证模块');

  // 注册
  username = 'tu' + Date.now().toString().slice(-10);
  phone = '139' + Date.now().toString().slice(-8);
  email = `${username}@example.test`;
  const { status: regStatus, data: regData } = await request('POST', '/auth/register', {
    username,
    password: 'Test1234',
    nickname: '测试用户',
    phone,
    email,
  });
  requireSuccess('POST /auth/register 返回 201', { status: regStatus, data: regData }, 201, (data) => data.message || JSON.stringify(data));
  assert('注册返回 accessToken', !!regData.data?.accessToken);
  assert('注册返回 refreshToken', !!regData.data?.refreshToken);
  assert('注册返回 user', !!regData.data?.user);

  token = regData.data?.accessToken;
  refreshToken = regData.data?.refreshToken;
  userId = regData.data?.user?.id;

  // 重复注册
  const { status: dupStatus } = await request('POST', '/auth/register', {
    username,
    password: 'Test1234',
  });
  assert('重复注册返回 409', dupStatus === 409);

  // 登录
  const { status: loginStatus, data: loginData } = await request('POST', '/auth/login', {
    username,
    password: 'Test1234',
  });
  requireSuccess('POST /auth/login 返回 200', { status: loginStatus, data: loginData }, 200, (data) => data.message || JSON.stringify(data));
  assert('登录返回 accessToken', !!loginData.data?.accessToken);

  const { status: emailLoginStatus, data: emailLoginData } = await request('POST', '/auth/login', {
    email,
    password: 'Test1234',
  });
  assert('邮箱密码登录返回 200', emailLoginStatus === 200);
  assert('邮箱密码登录返回当前用户', emailLoginData.data?.user?.id === userId);

  token = loginData.data?.accessToken;
  refreshToken = loginData.data?.refreshToken;

  // 错误密码
  const { status: wrongStatus } = await request('POST', '/auth/login', {
    username,
    password: 'wrongpassword',
  });
  assert('错误密码返回 401', wrongStatus === 401);

  // 刷新 Token
  const { status: refreshStatus, data: refreshData } = await request('POST', '/auth/refresh', {
    refreshToken,
  });
  requireSuccess('POST /auth/refresh 返回 200', { status: refreshStatus, data: refreshData }, 200, (data) => data.message || JSON.stringify(data));
  assert('刷新返回新 accessToken', !!refreshData.data?.accessToken);

  const second = await registerTestUser('b');
  secondToken = second.token;
  secondUserId = second.userId;
  assert('第二用户返回 accessToken', !!secondToken);
}

async function testUserPets() {
  console.log('\n📌 主宠档案模块');

  const { status: unauthStatus } = await request('GET', '/user-pets/me');
  assert('未登录读取主宠返回 401', unauthStatus === 401);

  const { status: breedsStatus, data: breedsData } = await request('GET', '/breeds?limit=1');
  requireSuccess('GET /breeds 返回 200', { status: breedsStatus, data: breedsData }, 200, (resp) => resp.message || JSON.stringify(resp));
  const breed = breedsData.data?.[0];
  assert('测试存在可用品种', !!breed?.id);
  if (!breed?.id) throw new Error('No breed available for user-pets test');

  const petName = `阿圆${Date.now().toString().slice(-4)}`;
  const create = await request('POST', '/user-pets/me', {
    breedId: breed.id,
    name: petName,
    birthday: '2024-01-02',
    sex: 'female',
  }, true);
  requireSuccess('A 创建主宠返回 201', create, 201, (resp) => resp.message || JSON.stringify(resp));
  assert('A 主宠绑定当前用户', create.data.data?.userId === userId);
  assert('A 主宠返回品种信息', create.data.data?.breed?.id === breed.id);

  const duplicate = await request('POST', '/user-pets/me', {
    breedId: breed.id,
    name: '重复档案',
  }, true);
  assert('A 重复创建主宠返回 409', duplicate.status === 409);

  const updatedName = `${petName}已更新`;
  const update = await request('PUT', '/user-pets/me', {
    name: updatedName,
    sex: 'male',
  }, true);
  requireSuccess('A 更新主宠返回 200', update, 200, (resp) => resp.message || JSON.stringify(resp));
  assert('A 更新主宠名称生效', update.data.data?.name === updatedName);

  const bBefore = await request('GET', '/user-pets/me', null, true, secondToken);
  requireSuccess('B 初始读取主宠返回 200', bBefore, 200, (resp) => resp.message || JSON.stringify(resp));
  assert('B 看不到 A 的主宠', bBefore.data.data === null);

  const bCreate = await request('POST', '/user-pets/me', {
    breedId: breed.id,
    name: `小B${Date.now().toString().slice(-4)}`,
    sex: 'unknown',
  }, true, secondToken);
  requireSuccess('B 创建自己的主宠返回 201', bCreate, 201, (resp) => resp.message || JSON.stringify(resp));
  assert('B 主宠绑定第二用户', bCreate.data.data?.userId === secondUserId);

  const aAfter = await request('GET', '/user-pets/me', null, true);
  requireSuccess('A 再次读取主宠返回 200', aAfter, 200, (resp) => resp.message || JSON.stringify(resp));
  assert('A 主宠未被 B 覆盖', aAfter.data.data?.name === updatedName);
}

async function testUsers() {
  console.log('\n📌 用户模块');

  // 获取自己的信息
  const { status, data } = await request('GET', '/users/me', null, true);
  requireSuccess('GET /users/me 返回 200', { status, data }, 200, (resp) => resp.message || JSON.stringify(resp));
  assert('返回用户信息', !!data.data);

  // 更新偏好
  const { status: prefStatus, data: prefData } = await request('PATCH', '/users/me/preferences', {
    notifications: false,
    autoPlayVideo: false,
  }, true);
  requireSuccess('PATCH /users/me/preferences 返回 200', { status: prefStatus, data: prefData }, 200, (resp) => resp.message || JSON.stringify(resp));
  assert('偏好设置返回 notifications=false', prefData.data?.notifications === false);

  // 更新资料
  const { status: profileStatus, data: profileData } = await request('PUT', '/users/me', {
    nickname: '测试用户已更新',
    bio: '测试资料更新',
  }, true);
  requireSuccess('PUT /users/me 返回 200', { status: profileStatus, data: profileData }, 200, (resp) => resp.message || JSON.stringify(resp));
  assert('资料更新返回新昵称', profileData.data?.nickname === '测试用户已更新');
}

async function testPosts() {
  console.log('\n📌 帖子模块');

  // 获取帖子列表
  const { status: listStatus, data: listData } = await request('GET', '/posts?page=1&pageSize=10');
  assert('GET /posts 返回 200', listStatus === 200);
  assert('返回帖子数组', Array.isArray(listData.data));

  const { status: circlesStatus, data: circlesData } = await request('GET', '/circles', null, true);
  assert('发帖前可获取圈子 c5', circlesStatus === 200 && circlesData.data?.some((circle) => circle.id === 'c5'));
  defaultCirclePostCount = circlesData.data?.find((circle) => circle.id === 'c5')?.postCount ?? null;

  // 创建帖子
  const { status: createStatus, data: createData } = await request('POST', '/posts', {
    content: '这是一条测试帖子 #测试',
    tags: ['测试'],
    circleId: 'c5',
  }, true);
  requireSuccess('POST /posts 返回 201', { status: createStatus, data: createData }, 201, (resp) => resp.message || JSON.stringify(resp));
  postId = createData.data?.id;
  assert('创建帖子返回所属圈子', createData.data?.circleId === 'c5');
  const circleAfterCreate = await request('GET', '/circles/c5');
  assert(
    '圈子发帖后帖子数增加',
    defaultCirclePostCount === null || circleAfterCreate.data.data?.postCount === defaultCirclePostCount + 1,
    `expected ${defaultCirclePostCount + 1}, got ${circleAfterCreate.data.data?.postCount}`,
  );

  if (postId) {
    // 获取帖子详情
    const { status: detailStatus, data: detailData } = await request('GET', `/posts/${postId}`);
    assert('GET /posts/:id 返回 200', detailStatus === 200);
    assert('帖子详情返回所属圈子', detailData.data?.circleId === 'c5');

    const { status: filteredStatus, data: filteredData } = await request('GET', '/posts?page=1&limit=10&sort=latest&circleId=c5');
    assert('按圈子筛选帖子返回 200', filteredStatus === 200);
    assert('按圈子筛选包含刚创建的帖子', filteredData.data?.some((post) => post.id === postId));
    assert('按圈子筛选结果归属一致', filteredData.data?.every((post) => post.circleId === 'c5'));

    // 点赞
    const { status: likeStatus } = await request('POST', `/posts/${postId}/like`, null, true);
    assert('POST /posts/:id/like 返回 200', likeStatus === 200);

    // A 收藏
    const { status: bookmarkStatus } = await request('POST', `/posts/${postId}/bookmark`, null, true);
    assert('A POST /posts/:id/bookmark 返回 200', bookmarkStatus === 200);

    // B 对 A 的帖子收藏
    const { status: secondBookmarkStatus } = await request('POST', `/posts/${postId}/bookmark`, null, true, secondToken);
    assert('B POST /posts/:id/bookmark 返回 200', secondBookmarkStatus === 200);

    const circlePosts = await request('GET', '/circles/c5/posts?page=1&pageSize=10', null, true);
    const circlePost = circlePosts.data?.data?.find((post) => post.id === postId);
    assert('圈子帖子接口返回当前用户点赞状态', circlePost?.isLiked === true);
    assert('圈子帖子接口返回当前用户收藏状态', circlePost?.isBookmarked === true);

    const secondPost = await request('POST', '/posts', {
      content: '这是第二用户用于收藏隔离的帖子 #测试',
      tags: ['测试'],
    }, true, secondToken);
    requireSuccess('B 创建隔离帖子返回 201', secondPost, 201, (resp) => resp.message || JSON.stringify(resp));
    secondPostId = secondPost.data.data?.id;
    if (secondPostId) {
      const { status: aBookmarkBPostStatus } = await request('POST', `/posts/${secondPostId}/bookmark`, null, true);
      assert('A 收藏 B 帖子返回 200', aBookmarkBPostStatus === 200);
    }
  }
}

async function testComments() {
  console.log('\n📌 评论模块');

  if (!postId) {
    assert('评论前置帖子存在', false, '缺少帖子 ID');
    return;
  }

  const { status: createStatus, data: createData } = await request('POST', `/posts/${postId}/comments`, {
    content: '这是 B 对 A 帖子的测试评论',
  }, true, secondToken);
  requireSuccess('B POST /posts/:id/comments 返回 201', { status: createStatus, data: createData }, 201, (resp) => resp.message || JSON.stringify(resp));
  commentId = createData.data?.id;

  const { status: listStatus, data: listData } = await request('GET', `/posts/${postId}/comments?page=1&limit=10`, null, true);
  assert('GET /posts/:id/comments 返回 200', listStatus === 200);
  assert('评论列表返回数组', Array.isArray(listData.data));

  if (commentId) {
    const { status: likeStatus, data: likeData } = await request('POST', `/comments/${commentId}/like`, null, true);
    assert('POST /comments/:id/like 返回 200', likeStatus === 200);
    assert('评论点赞返回 likeCount', typeof likeData.data?.likeCount === 'number');
  }
}

async function testContentSafety() {
  console.log('\n📌 内容安全');
  const unsafeContent = '<img src=x onerror=alert(1)> javascript:alert(2)';
  const { status: createStatus, data: createData } = await request('POST', '/posts', {
    title: '<script>alert(1)</script>',
    content: unsafeContent,
    images: [],
    tags: [],
  }, true);
  assert('攻击字符串帖子仍按文本创建', createStatus === 201);

  if (createStatus === 201) {
    const unsafePostId = createData.data?.id || createData.data?.post?.id;
    const { status: getStatus, data: getData } = await request('GET', `/posts/${unsafePostId}`);
    assert('攻击字符串帖子可读取', getStatus === 200);
    assert('帖子内容未被服务端改写为 HTML', getData.data?.content === unsafeContent);

    const { status: commentStatus, data: commentData } = await request('POST', `/posts/${unsafePostId}/comments`, {
      content: unsafeContent,
    }, true);
    assert('攻击字符串评论仍按文本创建', commentStatus === 201);
    if (commentStatus === 201) {
      assert('评论内容未被服务端改写为 HTML', commentData.data?.content === unsafeContent);
    }
  }

  const { status: longStatus } = await request('POST', '/posts', {
    content: 'x'.repeat(5001),
    images: [],
    tags: [],
  }, true);
  assert('超长帖子正文被拒绝', longStatus === 400 || longStatus === 422);
}

async function testNotifications() {
  console.log('\n📌 通知模块');

  const { status, data } = await request('GET', '/notifications?page=1&pageSize=50', null, true);
  assert('GET /notifications 返回 200', status === 200);
  assert('返回通知数组', Array.isArray(data.data));
  assert(
    'A 收到 B 的帖子评论通知',
    data.data?.some((item) => item.type === 'comment' && item.targetId === postId && item.fromUser?.id === secondUserId),
  );

  const beforeLikeCount = await request('GET', '/notifications/unread-count', null, true);
  const bLike = await request('POST', `/posts/${postId}/like`, null, true, secondToken);
  assert('B 点赞 A 的帖子返回 200', bLike.status === 200);
  const afterLikeCount = await request('GET', '/notifications/unread-count', null, true);
  assert('B 点赞后 A 未读数增加', Number(afterLikeCount.data?.data) === Number(beforeLikeCount.data?.data) + 1);

  const aNotificationsAfterLike = await request('GET', '/notifications?page=1&pageSize=50', null, true);
  assert(
    'A 收到 B 的帖子点赞通知',
    aNotificationsAfterLike.data.data?.some((item) => item.type === 'like' && item.targetId === postId && item.fromUser?.id === secondUserId),
  );

  const bUnlike = await request('POST', `/posts/${postId}/like`, null, true, secondToken);
  assert('B 取消点赞返回 200', bUnlike.status === 200);
  const afterUnlikeCount = await request('GET', '/notifications/unread-count', null, true);
  assert('取消点赞不新增 A 通知', Number(afterUnlikeCount.data?.data) === Number(afterLikeCount.data?.data));

  const beforeFollowCount = await request('GET', '/notifications/unread-count', null, true);
  const bFollow = await request('POST', `/users/${userId}/follow`, null, true, secondToken);
  assert('B 关注 A 返回 200', bFollow.status === 200);
  const afterFollowCount = await request('GET', '/notifications/unread-count', null, true);
  assert('B 关注后 A 未读数增加', Number(afterFollowCount.data?.data) === Number(beforeFollowCount.data?.data) + 1);

  const aNotificationsAfterFollow = await request('GET', '/notifications?page=1&pageSize=50', null, true);
  assert(
    'A 收到 B 的关注通知',
    aNotificationsAfterFollow.data.data?.some((item) => item.type === 'follow' && item.targetId === userId && item.fromUser?.id === secondUserId),
  );

  const bUnfollow = await request('POST', `/users/${userId}/follow`, null, true, secondToken);
  assert('B 取消关注返回 200', bUnfollow.status === 200);
  const afterUnfollowCount = await request('GET', '/notifications/unread-count', null, true);
  assert('取消关注不新增 A 通知', Number(afterUnfollowCount.data?.data) === Number(afterFollowCount.data?.data));

  const beforeReply = await request('GET', '/notifications/unread-count', null, true, secondToken);
  const reply = await request('POST', `/posts/${postId}/comments`, { content: '这是 A 对 B 的回复', parentId: commentId }, true);
  assert('A 回复 B 的评论返回 201', reply.status === 201);
  const bNotifications = await request('GET', '/notifications?page=1&pageSize=50', null, true, secondToken);
  assert(
    'B 收到 A 的回复通知',
    bNotifications.data.data?.some((item) => item.type === 'reply' && item.targetId === postId && item.fromUser?.id === userId),
  );
  const afterReply = await request('GET', '/notifications/unread-count', null, true, secondToken);
  assert('回复后 B 未读数增加', Number(afterReply.data?.data) === Number(beforeReply.data?.data) + 1);

  const { status: countStatus, data: countData } = await request('GET', '/notifications/unread-count', null, true);
  assert('GET /notifications/unread-count 返回 200', countStatus === 200);
  assert('未读数返回 number', typeof countData.data === 'number');
}

async function testPoints() {
  console.log('\n📌 积分模块');

  const { status: summaryStatus, data: summaryData } = await request('GET', '/points/summary', null, true);
  assert('GET /points/summary 返回 200', summaryStatus === 200);
  assert('返回积分数据', typeof summaryData.data?.points === 'number');

  const { status: todayStatus } = await request('GET', '/points/today', null, true);
  assert('GET /points/today 返回 200', todayStatus === 200);

  // 签到
  const { status: checkInStatus, data: checkInData } = await request('POST', '/points/check-in', null, true);
  assert('POST /points/check-in 返回 200', checkInStatus === 200);
  assert('签到返回积分', typeof checkInData.data?.pointsEarned === 'number');

  // 重复签到
  const { status: dupCheckIn } = await request('POST', '/points/check-in', null, true);
  assert('重复签到返回 409', dupCheckIn === 409);

  // 积分流水
  const { status: historyStatus, data: historyData } = await request('GET', '/points/history?page=1&limit=10', null, true);
  assert('GET /points/history 返回 200', historyStatus === 200);
  assert('返回流水数组', Array.isArray(historyData.data));
  assert('积分流水包含签到记录', historyData.data.some((item) => item.type === 'check_in'));

  const { status: afterSummaryStatus, data: afterSummaryData } = await request('GET', '/points/summary', null, true);
  assert('签到后 GET /points/summary 返回 200', afterSummaryStatus === 200);
  assert('签到后 summary 标记今日已签到', afterSummaryData.data?.checkedInToday === true);

  // 公共加积分接口已下线
  const { status: earnStatus } = await request('POST', '/points/earn', {
    amount: 50,
    type: 'reward',
    description: '测试奖励',
  }, true);
  assert('POST /points/earn 返回 404', earnStatus === 404);

  // 消费积分
  const { status: spendStatus } = await request('POST', '/points/spend', {
    amount: 10,
    description: '测试消费',
  }, true);
  assert('POST /points/spend 返回 200', spendStatus === 200);
}

async function testAI() {
  console.log('\n📌 AI 模块');

  const { status, data } = await request('POST', '/ai/chat', {
    messages: [{ text: '你好', isUser: true }],
  });
  assert('POST /ai/chat 返回 200 或上游不可用的 502', status === 200 || status === 502);
  if (status === 200) {
    assert('返回回复内容', !!data.data?.reply);
  } else {
    assert('上游不可用返回可展示错误', data.code === 5002 && !!data.message);
  }

  const { status: knowledgeStatus, data: knowledgeData } = await request('GET', '/ai/knowledge');
  assert('GET /ai/knowledge 返回成功或上游不可用', knowledgeStatus === 200 || knowledgeStatus === 500 || knowledgeStatus === 502);
  if (knowledgeStatus === 200) {
    assert('AI 今日知识返回文本', !!knowledgeData.data?.text);
    assert('AI 今日知识来源为 DeepSeek', knowledgeData.data?.source === 'DeepSeek AI');
  } else {
    assert('AI 今日知识失败返回稳定错误', knowledgeData.code === 5000 || knowledgeData.code === 5002);
  }
}

async function testMessages() {
  console.log('\n📌 私信模块');

  const { status: convStatus, data: convData } = await request('GET', '/messages/conversations', null, true);
  assert('GET /messages/conversations 返回 200', convStatus === 200);
  assert('会话列表返回数组', Array.isArray(convData.data));

  const { status: unreadStatus, data: unreadData } = await request('GET', '/messages/unread-count', null, true);
  assert('GET /messages/unread-count 返回 200', unreadStatus === 200);
  assert('未读消息数返回 number', typeof unreadData.data === 'number');
}

async function testCircles() {
  console.log('\n📌 圈子模块');

  const createdCircleName = `测试圈子${Date.now().toString().slice(-6)}`;
  const { status: createCircleStatus, data: createCircleData } = await request('POST', '/circles', {
    name: createdCircleName,
    description: '用于验证圈主权限和成员关系',
    emoji: '🐾',
    color: '#4CAF50',
  }, true);
  assert('POST /circles 创建圈子返回 201', createCircleStatus === 201);
  assert('创建圈子返回 owner 角色', createCircleData.data?.currentUserRole === 'owner');
  const createdCircleId = createCircleData.data?.id;
  if (createdCircleId) {
    const ownerLeaveAttempt = await request('POST', `/circles/${createdCircleId}/join`, null, true);
    assert('圈主退出自己创建的圈子返回 400/403', ownerLeaveAttempt.status === 400 || ownerLeaveAttempt.status === 403);

    const addSecondMember = await request('POST', `/circles/${createdCircleId}/join`, null, true, secondToken);
    assert('第二用户加入测试圈子返回 200', addSecondMember.status === 200 && addSecondMember.data?.data?.isJoined === true);

    const promoteMember = await request('PATCH', `/circles/${createdCircleId}/members/${secondUserId}`, { role: 'admin' }, true);
    assert('圈主提拔成员为管理员返回 200', promoteMember.status === 200);
    assert('提拔后角色为 admin', promoteMember.data?.data?.role === 'admin');

    const adminManage = await request('DELETE', `/circles/${createdCircleId}/members/${userId}`, null, true, secondToken);
    assert('管理员移除圈主返回 403', adminManage.status === 403);

    const demoteMember = await request('PATCH', `/circles/${createdCircleId}/members/${secondUserId}`, { role: 'member' }, true);
    assert('圈主降级管理员返回 200', demoteMember.status === 200 && demoteMember.data?.data?.role === 'member');

    const removeMember = await request('DELETE', `/circles/${createdCircleId}/members/${secondUserId}`, null, true);
    assert('圈主移除成员返回 200', removeMember.status === 200);

    const editedCircleName = `${createdCircleName}已编辑`;
    const ownerEdit = await request('PUT', `/circles/${createdCircleId}`, {
      name: editedCircleName,
      description: '圈主已更新的圈子简介',
      emoji: '🐶',
      color: '#FF9800',
    }, true);
    assert('圈主编辑圈子返回 200', ownerEdit.status === 200);
    assert('圈主编辑返回最新名称', ownerEdit.data?.data?.name === editedCircleName);
    assert('圈主编辑返回最新简介', ownerEdit.data?.data?.description === '圈主已更新的圈子简介');

    const memberEdit = await request('PUT', `/circles/${createdCircleId}`, {
      description: '普通成员不应修改',
    }, true, secondToken);
    assert('普通成员编辑圈子返回 403', memberEdit.status === 403);

    const { status: createdMembersStatus, data: createdMembersData } = await request('GET', `/circles/${createdCircleId}/members`, null, true);
    assert('创建圈子成员接口返回 200', createdMembersStatus === 200);
    assert('创建者自动成为 owner', createdMembersData.data?.currentUserRole === 'owner' && createdMembersData.data?.members?.some((member) => member.userId === userId && member.role === 'owner'));

    const rejoinSecond = await request('POST', `/circles/${createdCircleId}/join`, null, true, secondToken);
    assert('转让前第二用户重新加入返回 200', rejoinSecond.status === 200 && rejoinSecond.data?.data?.isJoined === true);
    const transferOwner = await request('PATCH', `/circles/${createdCircleId}/owner`, { userId: secondUserId }, true);
    assert('圈主转让返回 200', transferOwner.status === 200);
    assert('圈主转让返回新圈主', transferOwner.data?.data?.ownerId === secondUserId && transferOwner.data?.data?.previousOwnerId === userId);

    const afterTransferMembers = await request('GET', `/circles/${createdCircleId}/members`, null, true);
    assert('转让后 A 变为普通成员', afterTransferMembers.data?.data?.currentUserRole === 'member');
    assert('转让后 B 成为圈主', afterTransferMembers.data?.data?.members?.some((member) => member.userId === secondUserId && member.role === 'owner'));
    const oldOwnerEdit = await request('PUT', `/circles/${createdCircleId}`, { description: '旧圈主不应编辑' }, true);
    assert('转让后旧圈主编辑返回 403', oldOwnerEdit.status === 403);
    const oldOwnerDisband = await request('DELETE', `/circles/${createdCircleId}`, null, true);
    assert('转让后旧圈主解散返回 403', oldOwnerDisband.status === 403);

    const disbandCircle = await request('DELETE', `/circles/${createdCircleId}`, null, true, secondToken);
    assert('新圈主解散圈子返回 200', disbandCircle.status === 200 && disbandCircle.data?.data?.deleted === true);
    const deletedCircle = await request('GET', `/circles/${createdCircleId}`);
    assert('解散后圈子详情返回 404', deletedCircle.status === 404);
  }

  const { status: listStatus, data: listData } = await request('GET', '/circles', null, true);
  assert('GET /circles 返回 200', listStatus === 200);
  assert('圈子列表返回数组', Array.isArray(listData.data));
  assert('圈子返回真实展示字段', typeof listData.data?.[0]?.name === 'string' && typeof listData.data?.[0]?.emoji === 'string');
  assert('圈子列表包含数据库默认 c5', listData.data?.some((circle) => circle.id === 'c5' && circle.name === '新手铲屎官'));
  circleId = listData.data?.[0]?.id;

  if (circleId) {
    const { status: joinStatus, data: joinData } = await request('POST', `/circles/${circleId}/join`, null, true);
    assert('POST /circles/:id/join 返回 200', joinStatus === 200);
    assert('圈子加入返回 isJoined', typeof joinData.data?.isJoined === 'boolean');

    const { status: membersStatus, data: membersData } = await request('GET', `/circles/${circleId}/members`, null, true);
    assert('GET /circles/:id/members 返回 200', membersStatus === 200);
    assert('圈子成员列表返回数组', Array.isArray(membersData.data?.members));
    assert('当前用户成员角色返回 member', membersData.data?.currentUserRole === 'member');
    assert('成员列表包含当前测试用户', membersData.data?.members?.some((member) => member.userId === userId && member.role === 'member'));

    const { status: circlePostsStatus, data: circlePostsData } = await request('GET', `/circles/${circleId}/posts?page=1&pageSize=10`, null, true);
    assert('GET /circles/:id/posts 返回 200', circlePostsStatus === 200);
    assert('圈子帖子列表返回数组', Array.isArray(circlePostsData.data));
  }
}

async function testBookmarks() {
  console.log('\n📌 收藏模块');

  const { status, data } = await request('GET', '/bookmarks?page=1&limit=10', null, true);
  assert('GET /bookmarks 返回 200', status === 200);
  assert('收藏列表返回数组', Array.isArray(data.data));
  assert('A 收藏包含自己收藏过的 A 帖子', data.data.some((item) => item.postId === postId));
  if (secondPostId) {
    assert('A 收藏包含自己收藏过的 B 帖子', data.data.some((item) => item.postId === secondPostId));
  }

  const { status: secondStatus, data: secondData } = await request('GET', '/bookmarks?page=1&limit=10', null, true, secondToken);
  assert('B GET /bookmarks 返回 200', secondStatus === 200);
  assert('B 收藏包含 A 帖子', secondData.data?.some((item) => item.postId === postId));
  if (secondPostId) {
    assert('B 收藏不包含 A 私有收藏的 B 帖子', !secondData.data?.some((item) => item.postId === secondPostId));
  }

  const ownPosts = await request('GET', `/users/${userId}/posts?page=1&pageSize=10`, null, true);
  assert('A 个人帖子 API 返回 200', ownPosts.status === 200);
  assert('A 个人帖子 API 可读到新帖', ownPosts.data.data?.some((item) => item.id === postId));
}

async function testPostDeletion() {
  console.log('\n📌 发布管理模块');

  if (!postId || !secondPostId) {
    assert('删除测试前置帖子存在', false, '缺少测试帖子 ID');
    return;
  }

  const forbiddenDelete = await request('DELETE', `/posts/${secondPostId}`, null, true);
  assert('A 删除 B 的帖子返回 403', forbiddenDelete.status === 403);

  const deleted = await request('DELETE', `/posts/${postId}`, null, true);
  assert('A 删除自己的帖子返回 200', deleted.status === 200);

  const deletedDetail = await request('GET', `/posts/${postId}`);
  assert('删除后帖子详情返回 404', deletedDetail.status === 404);

  const circleAfterDelete = await request('GET', '/circles/c5');
  assert(
    '删除圈子帖子后圈子帖子数恢复',
    defaultCirclePostCount === null || circleAfterDelete.data.data?.postCount === defaultCirclePostCount,
    `expected ${defaultCirclePostCount}, got ${circleAfterDelete.data.data?.postCount}`,
  );

  const ownPosts = await request('GET', `/users/${userId}/posts?page=1&pageSize=10`, null, true);
  assert('删除后个人帖子列表不含该帖子', !ownPosts.data.data?.some((item) => item.id === postId));
}

async function testAccountSecurity() {
  console.log('\n📌 账号安全');

  // Legacy users migrated without a password must not fall through to bcrypt.
  const legacyPasswordHash = await bcrypt.hash('Test1234', 10);
  await pool.execute('UPDATE users SET password_hash = NULL WHERE id = ?', [userId]);
  const { status: legacyLoginStatus, data: legacyLoginData } = await request('POST', '/auth/login', {
    username,
    password: 'Test1234',
  });
  assert('旧账号无密码拒绝密码登录', legacyLoginStatus === 401);
  assert('旧账号提示使用邮箱验证码', String(legacyLoginData.message || '').includes('邮箱验证码'));
  const legacyLoginCode = String(crypto.randomInt(100000, 1000000));
  await pool.execute(
    `INSERT INTO email_login_codes (id, email, code_hash, expires_at)
     VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
    [uuidv4(), email, hashLoginCode(legacyLoginCode)],
  );
  const { status: legacyCodeLoginStatus, data: legacyCodeLoginData } = await request('POST', '/auth/email/login-code/login', {
    email,
    code: legacyLoginCode,
  });
  assert('旧账号可用邮箱验证码登录', legacyCodeLoginStatus === 200);
  const legacyAccessToken = legacyCodeLoginData.data?.accessToken;
  const { status: initialPasswordStatus } = await request('PUT', '/users/me/password', {
    newPassword: 'LegacySet1234',
  }, true, legacyAccessToken);
  assert('旧账号邮箱登录后可以设置初始密码', initialPasswordStatus === 200);
  const { status: legacyPasswordLoginStatus } = await request('POST', '/auth/login', {
    username,
    password: 'LegacySet1234',
  });
  assert('旧账号设置初始密码后可以密码登录', legacyPasswordLoginStatus === 200);
  token = legacyAccessToken;
  refreshToken = legacyCodeLoginData.data?.refreshToken;
  await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [legacyPasswordHash, userId]);

  const { status: verificationSendStatus, data: verificationSendData } = await request('POST', '/auth/email/verification/send', {
    email,
  });
  assert('未配置邮件服务时激活邮件明确失败', verificationSendStatus === 503);
  assert('激活邮件失败返回配置错误码', verificationSendData.code === 'EMAIL_NOT_CONFIGURED');

  const { status: loginCodeSendStatus, data: loginCodeSendData } = await request('POST', '/auth/email/login-code/send', {
    email,
  });
  assert('未配置邮件服务时登录验证码明确失败', loginCodeSendStatus === 503);
  assert('登录验证码失败返回配置错误码', loginCodeSendData.code === 'EMAIL_NOT_CONFIGURED');

  const { status: invalidVerificationStatus } = await request('GET', '/auth/verify-email?token=invalid-token');
  assert('无效邮箱激活Token返回 400', invalidVerificationStatus === 400);

  const activationToken = crypto.randomBytes(32).toString('hex');
  await pool.execute(
    `INSERT INTO email_verification_tokens
      (id, user_id, email, token_hash, purpose, expires_at)
     VALUES (?, ?, ?, ?, 'activation', DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
    [uuidv4(), userId, email, hashVerificationToken(activationToken)],
  );
  const { status: activationStatus } = await request('GET', `/auth/verify-email?token=${activationToken}`);
  assert('有效激活Token可以消费', activationStatus === 200);
  const { status: activationReplayStatus } = await request('GET', `/auth/verify-email?token=${activationToken}`);
  assert('激活Token不能重复使用', activationReplayStatus === 409);

  const expiredActivationToken = crypto.randomBytes(32).toString('hex');
  await pool.execute(
    `INSERT INTO email_verification_tokens
      (id, user_id, email, token_hash, purpose, expires_at)
     VALUES (?, ?, ?, ?, 'activation', DATE_SUB(NOW(), INTERVAL 1 MINUTE))`,
    [uuidv4(), userId, email, hashVerificationToken(expiredActivationToken)],
  );
  const { status: expiredActivationStatus } = await request('GET', `/auth/verify-email?token=${expiredActivationToken}`);
  assert('过期激活Token被拒绝', expiredActivationStatus === 410);

  const { status: resetWithBadCodeStatus } = await request('POST', '/auth/password/reset', {
    method: 'phone',
    phone,
    smsCode: '000000',
    newPassword: 'Reset1234',
  });
  assert('错误验证码不能重置密码', resetWithBadCodeStatus === 400 || resetWithBadCodeStatus === 401);

  const { status: emailSendStatus, data: emailSendData } = await request('POST', '/auth/email/reset/send', {
    email,
  });
  assert('POST /auth/email/reset/send 返回 200', emailSendStatus === 200);
  assert('开发环境返回 email reset debugToken', !!emailSendData.data?.debugToken);

  const { status: resetWithBadEmailTokenStatus } = await request('POST', '/auth/password/reset', {
    method: 'email',
    email,
    resetToken: 'bad-token',
    newPassword: 'EmailReset1234',
  });
  assert('错误邮箱重置 token 不能重置密码', resetWithBadEmailTokenStatus === 400 || resetWithBadEmailTokenStatus === 401);

  const emailResetPassword = 'EmailReset1234';
  const { status: emailResetStatus } = await request('POST', '/auth/password/reset', {
    method: 'email',
    email,
    resetToken: emailSendData.data?.debugToken,
    newPassword: emailResetPassword,
  });
  assert('正确邮箱重置 token 可以重置密码', emailResetStatus === 200);

  const { data: concurrentResetData } = await request('POST', '/auth/email/reset/send', { email });
  const concurrentResetRequests = await Promise.all([
    request('POST', '/auth/password/reset', {
      method: 'email', email, resetToken: concurrentResetData.data?.debugToken, newPassword: emailResetPassword,
    }),
    request('POST', '/auth/password/reset', {
      method: 'email', email, resetToken: concurrentResetData.data?.debugToken, newPassword: emailResetPassword,
    }),
  ]);
  const concurrentResetStatuses = concurrentResetRequests.map((result) => result.status).sort((a, b) => a - b);
  assert('并发邮箱重置只能成功一次', concurrentResetStatuses[0] === 200 && (concurrentResetStatuses[1] === 400 || concurrentResetStatuses[1] === 409));

  const { status: reuseEmailTokenStatus } = await request('POST', '/auth/password/reset', {
    method: 'email',
    email,
    resetToken: emailSendData.data?.debugToken,
    newPassword: 'EmailResetAgain1234',
  });
  assert('邮箱重置 token 不能重复使用', reuseEmailTokenStatus === 400 || reuseEmailTokenStatus === 401);

  const { data: expiringResetData } = await request('POST', '/auth/email/reset/send', { email });
  const [resetRows] = await pool.execute(
    'SELECT id FROM email_reset_tokens WHERE user_id = ? AND is_used = FALSE ORDER BY created_at DESC LIMIT 1',
    [userId],
  );
  if (resetRows.length > 0) {
    await pool.execute('UPDATE email_reset_tokens SET expires_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE id = ?', [resetRows[0].id]);
  }
  const { status: expiredResetStatus } = await request('POST', '/auth/password/reset', {
    method: 'email',
    email,
    resetToken: expiringResetData.data?.debugToken,
    newPassword: 'ExpiredReset1234',
  });
  assert('过期邮箱重置Token被拒绝', expiredResetStatus === 400 || expiredResetStatus === 401);

  const loginCode = String(crypto.randomInt(100000, 1000000));
  await pool.execute(
    `INSERT INTO email_login_codes (id, email, code_hash, expires_at)
     VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
    [uuidv4(), email, hashLoginCode(loginCode)],
  );
  const { status: codeLoginStatus } = await request('POST', '/auth/email/login-code/login', { email, code: loginCode });
  assert('邮箱登录验证码可以消费', codeLoginStatus === 200);
  const { status: codeReplayStatus } = await request('POST', '/auth/email/login-code/login', { email, code: loginCode });
  assert('邮箱登录验证码不能重复使用', codeReplayStatus === 401 || codeReplayStatus === 409);

  let expiredLoginCode = String(crypto.randomInt(100000, 1000000));
  if (expiredLoginCode === loginCode) expiredLoginCode = String((Number(loginCode) + 1) % 900000 + 100000);
  await pool.execute(
    `INSERT INTO email_login_codes (id, email, code_hash, expires_at)
     VALUES (?, ?, ?, DATE_SUB(NOW(), INTERVAL 1 MINUTE))`,
    [uuidv4(), email, hashLoginCode(expiredLoginCode)],
  );
  const { status: expiredCodeStatus } = await request('POST', '/auth/email/login-code/login', { email, code: expiredLoginCode });
  assert('过期邮箱登录验证码被拒绝', expiredCodeStatus === 401);

  const { status: emailReloginStatus } = await request('POST', '/auth/login', {
    username,
    password: emailResetPassword,
  });
  assert('邮箱重置后可用新密码登录', emailReloginStatus === 200);

  const newPassword = 'Newpass123';
  const { status: changeStatus } = await request('PUT', '/users/me/password', {
    oldPassword: emailResetPassword,
    newPassword,
  }, true);
  assert('PUT /users/me/password 返回 200', changeStatus === 200);

  const { status: reloginStatus, data: reloginData } = await request('POST', '/auth/login', {
    username,
    password: newPassword,
  });
  assert('修改密码后可用新密码登录', reloginStatus === 200);
  assert('修改密码后登录返回 accessToken', !!reloginData.data?.accessToken);
}

async function testLogout() {
  console.log('\n📌 登出');

  const { status } = await request('POST', '/auth/logout', { refreshToken }, true);
  assert('POST /auth/logout 返回 200', status === 200);
}

// ==================== 运行 ====================

async function run() {
  console.log('🧪 萌宠星球 API 测试\n' + '='.repeat(40));

  try {
    await resetLocalRateLimitBuckets();
    await testHealth();
    await testAuth();
    await testUserPets();
    await testUsers();
    await testPosts();
    await testComments();
    await testContentSafety();
    await testNotifications();
    await testPoints();
    await testAI();
    await testMessages();
await testCircles();
await testBookmarks();
await testPostDeletion();
await testAccountSecurity();
    await testLogout();
  } catch (err) {
    console.error('\n💥 测试中断:', err.message);
    failed++;
  }

  console.log('\n' + '='.repeat(40));
  console.log(`📊 结果: ${passed} 通过, ${failed} 失败, 共 ${passed + failed} 项`);
  console.log(failed === 0 ? '🎉 全部通过！' : '⚠️ 有失败项，请检查');
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

run();
