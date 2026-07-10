/**
 * 萌宠星球 - 后端 API 全面测试脚本
 * 用法: node test-api.js
 */

const BASE = 'http://localhost:3000/api';
let token = null;
let refreshToken = null;
let userId = null;
let username = null;
let phone = null;
let email = null;
let postId = null;
let commentId = null;
let circleId = null;
let passed = 0;
let failed = 0;

async function request(method, path, body = null, useAuth = false) {
  const headers = { 'Content-Type': 'application/json' };
  if (useAuth && token) headers['Authorization'] = `Bearer ${token}`;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
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

  // 创建帖子
  const { status: createStatus, data: createData } = await request('POST', '/posts', {
    content: '这是一条测试帖子 #测试',
    tags: ['测试'],
  }, true);
  requireSuccess('POST /posts 返回 201', { status: createStatus, data: createData }, 201, (resp) => resp.message || JSON.stringify(resp));
  postId = createData.data?.id;

  if (postId) {
    // 获取帖子详情
    const { status: detailStatus } = await request('GET', `/posts/${postId}`);
    assert('GET /posts/:id 返回 200', detailStatus === 200);

    // 点赞
    const { status: likeStatus } = await request('POST', `/posts/${postId}/like`, null, true);
    assert('POST /posts/:id/like 返回 200', likeStatus === 200);

    // 收藏
    const { status: bookmarkStatus } = await request('POST', `/posts/${postId}/bookmark`, null, true);
    assert('POST /posts/:id/bookmark 返回 200', bookmarkStatus === 200);
  }
}

async function testComments() {
  console.log('\n📌 评论模块');

  if (!postId) {
    assert('评论前置帖子存在', false, '缺少帖子 ID');
    return;
  }

  const { status: createStatus, data: createData } = await request('POST', `/posts/${postId}/comments`, {
    content: '这是一条测试评论',
  }, true);
  requireSuccess('POST /posts/:id/comments 返回 201', { status: createStatus, data: createData }, 201, (resp) => resp.message || JSON.stringify(resp));
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

async function testNotifications() {
  console.log('\n📌 通知模块');

  const { status, data } = await request('GET', '/notifications?page=1&pageSize=10', null, true);
  assert('GET /notifications 返回 200', status === 200);
  assert('返回通知数组', Array.isArray(data.data));

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

  // 增加积分
  const { status: earnStatus } = await request('POST', '/points/earn', {
    amount: 50,
    type: 'reward',
    description: '测试奖励',
  }, true);
  assert('POST /points/earn 返回 200', earnStatus === 200);

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
  assert('POST /ai/chat 返回 200', status === 200);
  assert('返回回复内容', !!data.data?.reply);
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

  const { status: listStatus, data: listData } = await request('GET', '/circles', null, true);
  assert('GET /circles 返回 200', listStatus === 200);
  assert('圈子列表返回数组', Array.isArray(listData.data));
  circleId = listData.data?.[0]?.id;

  if (circleId) {
    const { status: joinStatus, data: joinData } = await request('POST', `/circles/${circleId}/join`, null, true);
    assert('POST /circles/:id/join 返回 200', joinStatus === 200);
    assert('圈子加入返回 isJoined', typeof joinData.data?.isJoined === 'boolean');

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
}

async function testAccountSecurity() {
  console.log('\n📌 账号安全');

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

  const { status: reuseEmailTokenStatus } = await request('POST', '/auth/password/reset', {
    method: 'email',
    email,
    resetToken: emailSendData.data?.debugToken,
    newPassword: 'EmailResetAgain1234',
  });
  assert('邮箱重置 token 不能重复使用', reuseEmailTokenStatus === 400 || reuseEmailTokenStatus === 401);

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
    await testHealth();
    await testAuth();
    await testUsers();
    await testPosts();
    await testComments();
    await testNotifications();
    await testPoints();
    await testAI();
    await testMessages();
    await testCircles();
    await testBookmarks();
    await testAccountSecurity();
    await testLogout();
  } catch (err) {
    console.error('\n💥 测试中断:', err.message);
    failed++;
  }

  console.log('\n' + '='.repeat(40));
  console.log(`📊 结果: ${passed} 通过, ${failed} 失败, 共 ${passed + failed} 项`);
  console.log(failed === 0 ? '🎉 全部通过！' : '⚠️ 有失败项，请检查');
  process.exit(failed > 0 ? 1 : 0);
}

run();
