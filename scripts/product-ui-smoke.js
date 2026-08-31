const http = require('http');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const FRONTEND_URL = process.env.UI_SMOKE_FRONTEND_URL || 'http://localhost:8081';
const SHOULD_START_FRONTEND = process.env.UI_SMOKE_START_FRONTEND !== '0';
const DEBUG_PORT = Number(process.env.UI_SMOKE_DEBUG_PORT || 9222);
const CHROME_PATH =
  process.env.UI_SMOKE_CHROME ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const USER_DATA_DIR =
  process.env.UI_SMOKE_USER_DATA_DIR ||
  `${process.cwd()}\\.tmp-chrome-ui-smoke`;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(fn, timeoutMs = 10000, intervalMs = 500) {
  const startedAt = Date.now();
  let lastValue = null;
  while (Date.now() - startedAt < timeoutMs) {
    // eslint-disable-next-line no-await-in-loop
    lastValue = await fn();
    if (lastValue) return lastValue;
    // eslint-disable-next-line no-await-in-loop
    await wait(intervalMs);
  }
  return lastValue;
}

function getText(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => resolve(data));
      })
      .on('error', reject);
  });
}

async function canReachHttp(url) {
  try {
    await getText(url);
    return true;
  } catch {
    return false;
  }
}

function stopProcessTree(child) {
  if (!child || !child.pid) return;
  spawn('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], {
    stdio: 'ignore',
    windowsHide: true,
  });
}

async function ensureFrontend() {
  if (await canReachHttp(FRONTEND_URL)) return null;
  if (!SHOULD_START_FRONTEND) {
    await waitForHttp(FRONTEND_URL);
    return null;
  }

  const child = spawn(
    'cmd.exe',
    ['/d', '/s', '/c', 'npm.cmd run web -- --port 8081'],
    {
      cwd: process.cwd(),
      env: { ...process.env, BROWSER: 'none' },
      stdio: 'ignore',
      windowsHide: true,
    },
  );

  try {
    await waitForHttp(FRONTEND_URL, 90);
    return child;
  } catch (error) {
    const reachable = await canReachHttp(FRONTEND_URL);
    stopProcessTree(child);
    throw new Error(`Frontend did not become ready at ${FRONTEND_URL}; reachable after timeout: ${reachable}; ${error.message}`);
  }
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(error);
          }
        });
      })
      .on('error', reject);
  });
}

async function apiRequest(method, path, body, accessToken) {
  const response = await fetch(`http://localhost:3000/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, data: await response.json().catch(() => ({})) };
}

async function registerApiUser(label) {
  const suffix = String(Date.now()).slice(-8);
  const username = `${label}${suffix}`;
  const result = await apiRequest('POST', '/auth/register', {
    username,
    email: `${username}@example.test`,
    password: 'Smoke123',
    nickname: `通知${suffix.slice(-4)}`,
  });
  if (result.status !== 201 || !result.data.data?.accessToken) {
    throw new Error(`Notifier test user registration failed: ${JSON.stringify(result)}`);
  }
  return {
    nickname: result.data.data.user.nickname,
    accessToken: result.data.data.accessToken,
  };
}

async function waitForJson(url, attempts = 25) {
  let lastError;
  for (let index = 0; index < attempts; index += 1) {
    try {
      return await getJson(url);
    } catch (error) {
      lastError = error;
      await wait(500);
    }
  }
  throw lastError;
}

async function waitForHttp(url, attempts = 40) {
  let lastError;
  for (let index = 0; index < attempts; index += 1) {
    try {
      const html = await getText(url);
      if (html && html.length > 0) return html;
    } catch (error) {
      lastError = error;
    }
    await wait(1000);
  }
  throw lastError || new Error(`HTTP not ready: ${url}`);
}

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
      this.ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (!message.id) return;
        const deferred = this.pending.get(message.id);
        if (!deferred) return;
        this.pending.delete(message.id);
        if (message.error) deferred.reject(message.error);
        else deferred.resolve(message.result);
      };
    });
    await this.send('Runtime.enable');
    await this.send('Page.enable');
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    return result.result ? result.result.value : undefined;
  }

  async close() {
    try {
      this.ws.close();
    } catch {}
  }
}

async function ensureChrome() {
  await waitForHttp(FRONTEND_URL);
  try {
    await waitForJson(`http://127.0.0.1:${DEBUG_PORT}/json/version`, 2);
    return null;
  } catch {}

  const child = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      `--remote-debugging-port=${DEBUG_PORT}`,
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      `--user-data-dir=${USER_DATA_DIR}`,
      FRONTEND_URL,
    ],
    {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    },
  );
  child.unref();
  try {
    await waitForJson(`http://127.0.0.1:${DEBUG_PORT}/json/version`, 80);
    return child;
  } catch (error) {
    stopProcessTree(child);
    throw new Error(`Chrome debugging port ${DEBUG_PORT} did not become ready: ${error.message}`);
  }
}

async function openClient() {
  const page = await waitFor(async () => {
    const pages = await waitForJson(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
    return pages.find(
      (item) =>
        item.type === 'page' &&
        item.webSocketDebuggerUrl &&
        item.url?.startsWith(FRONTEND_URL),
    ) || pages.find((item) => item.type === 'page' && item.webSocketDebuggerUrl);
  }, 30000, 300);
  if (!page) throw new Error('No debuggable page found');
  const client = new CdpClient(page.webSocketDebuggerUrl);
  await client.connect();
  return client;
}

async function waitForReady(client) {
  await client.send('Page.navigate', { url: FRONTEND_URL });
  const ready = await waitFor(() => client.evaluate(`
    (function() {
      const text = document.body ? document.body.innerText : '';
      const hasTab = !!document.querySelector('[data-testid="tab-home"], [data-testid="tab-community"]');
      return hasTab || text.includes('萌宠星球') || text.includes('我的宠物');
    })();
  `), 120000, 800);
  if (!ready) {
    const state = await pageState(client);
    throw new Error(`Frontend home did not render expected app content: ${JSON.stringify(state)}`);
  }
}

async function route(client, path) {
  await client.evaluate(`
    (function() {
      window.location.href = ${JSON.stringify(`${FRONTEND_URL}`)} + ${JSON.stringify(path)};
      return true;
    })();
  `);
  await wait(2600);
}

async function back(client) {
  await client.evaluate(`
    (function() {
      history.back();
      return true;
    })();
  `);
  await wait(2200);
}

async function clickTestId(client, testId) {
  const clicked = await waitFor(() => client.evaluate(`
    (function() {
      const el = document.querySelector('[data-testid="${testId}"]');
      if (!el) return false;
      el.scrollIntoView({ block: 'center', inline: 'center' });
      el.click();
      return true;
    })();
  `), 60000, 300);
  if (!clicked) {
    const state = await pageState(client);
    throw new Error(`Missing testId: ${testId}; state=${JSON.stringify(state)}`);
  }
  await wait(1200);
}

async function fillByTestId(client, testId, value) {
  const ok = await waitFor(() => client.evaluate(`
    (function() {
      const el = document.querySelector('[data-testid="${testId}"]');
      if (!el) return false;
      el.focus();
      const setter = el.tagName === 'TEXTAREA'
        ? Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
        : Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      if (setter) {
        setter.call(el, '');
      } else {
        el.value = '';
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })();
  `), 60000, 300);
  if (!ok) {
    const state = await pageState(client);
    throw new Error(`Missing input testId: ${testId}; state=${JSON.stringify(state)}`);
  }
  await client.send('Input.insertText', { text: value });
  await client.evaluate(`
    (function() {
      const el = document.querySelector('[data-testid="${testId}"]');
      if (!el) return false;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })();
  `);
  await wait(300);
}

async function textSnapshot(client) {
  return client.evaluate(`document.body ? document.body.innerText.slice(0, 5000) : ''`);
}

async function pageState(client) {
  return client.evaluate(`
    (() => ({
      href: location.href,
      text: document.body ? document.body.innerText.slice(0, 2000) : '',
      testIds: [...document.querySelectorAll('[data-testid]')].map((el) => el.getAttribute('data-testid')).slice(0, 120),
      inputs: [...document.querySelectorAll('input, textarea')].map((el) => ({
        placeholder: el.placeholder || '',
        testid: el.getAttribute('data-testid'),
        type: el.type || '',
      })),
    }))()
  `);
}

function makeUser() {
  const suffix = Date.now();
  const shortSuffix = String(suffix).slice(-8);
  return {
    username: `ui${shortSuffix}`,
    email: `ui${shortSuffix}@example.test`,
    password: 'Smoke123',
    nickname: `Smoke${String(suffix).slice(-4)}`,
    petName: `团团${String(suffix).slice(-4)}`,
    postContent: `UI smoke post ${shortSuffix}`,
    commentContent: `UI smoke comment ${shortSuffix}`,
  };
}

async function run() {
  const user = makeUser();
  const notifier = await registerApiUser('notify');
  const frontend = await ensureFrontend();
  const chrome = await ensureChrome();
  const client = await openClient();
  try {
    await waitForReady(client);
    await client.send('Storage.clearDataForOrigin', {
      origin: FRONTEND_URL,
      storageTypes: 'all',
    }).catch(() => undefined);
    await client.send('Network.clearBrowserCookies').catch(() => undefined);
    await waitForReady(client);

    const startText = await textSnapshot(client);
    const startState = await pageState(client);
    if (
      !startText.includes('萌宠星球') &&
      !startText.includes('我的宠物') &&
      !startState.testIds.includes('tab-home')
    ) {
      throw new Error(`Frontend home did not render expected text: ${JSON.stringify(startState)}`);
    }

    await route(client, '/wiki');
    const guestWikiText = await waitFor(async () => {
      const text = await textSnapshot(client);
      return text.includes('品种百科') && (text.includes('个品种') || text.includes('百科数据为空')) ? text : null;
    }, 20000, 800);
    if (!guestWikiText) {
      const state = await pageState(client);
      throw new Error(`Guest wiki did not render breed encyclopedia: ${JSON.stringify(state)}`);
    }

    await route(client, '/login');
    await fillByTestId(client, 'login-username-input', user.username);
    await fillByTestId(client, 'login-password-input', user.password);
    await clickTestId(client, 'login-to-register-link');

    await fillByTestId(client, 'register-username-input', user.username);
    await fillByTestId(client, 'register-email-input', user.email);
    await fillByTestId(client, 'register-password-input', user.password);
    await fillByTestId(client, 'register-confirm-password-input', user.password);
    await fillByTestId(client, 'register-nickname-input', user.nickname);
    await clickTestId(client, 'register-submit-btn');
    await wait(4000);

    const postRegister = await pageState(client);
    if (!postRegister.testIds.includes('tab-home') && !postRegister.testIds.includes('tab-community')) {
      throw new Error(`Register did not reach authenticated tabs: ${JSON.stringify(postRegister)}`);
    }
    if (postRegister.href.includes('/register') && postRegister.text.includes('用户名需3-20位')) {
      throw new Error(`Register validation failed: ${JSON.stringify(postRegister)}`);
    }
    if (!postRegister.href.startsWith(FRONTEND_URL)) {
      throw new Error(`Unexpected post-register page: ${JSON.stringify(postRegister)}`);
    }

    await route(client, '/pet');
    await fillByTestId(client, 'primary-pet-name-input', user.petName);
    await fillByTestId(client, 'primary-pet-birthday-input', '2024-01-02');
    await clickTestId(client, 'primary-pet-sex-male');
    await clickTestId(client, 'primary-pet-save-btn');
    await wait(2500);

    const petText = await waitFor(async () => {
      const text = await textSnapshot(client);
      return text.includes(user.petName) ? text : null;
    }, 20000, 800);
    if (!petText) {
      const state = await pageState(client);
      throw new Error(`Primary pet was not visible after save: ${JSON.stringify(state)}`);
    }

    await clickTestId(client, 'tab-community');
    await clickTestId(client, 'community-tab-latest');
    const communityC5Name = await client.evaluate(`
      (document.querySelector('[data-testid="community-circle-chip-c5"]') || {}).innerText || ''
    `);
    if (!communityC5Name.includes('新手铲屎官')) {
      throw new Error(`Community did not render API-backed c5 name: ${JSON.stringify({ communityC5Name, state: await pageState(client) })}`);
    }
    await clickTestId(client, 'community-create-post-btn');

    const createPage = await pageState(client);
    if (!createPage.testIds.includes('create-post-content-input')) {
      throw new Error(`Create page did not render expected input: ${JSON.stringify(createPage)}`);
    }
    if (!createPage.testIds.includes('create-post-circle-c5')) {
      throw new Error(`Create page did not render the API-backed c5 circle: ${JSON.stringify(createPage)}`);
    }
    const createC5Name = await client.evaluate(`
      (document.querySelector('[data-testid="create-post-circle-c5"]') || {}).innerText || ''
    `);
    if (!createC5Name.includes('新手铲屎官')) {
      throw new Error(`Create page did not render API-backed c5 name: ${JSON.stringify({ createC5Name, state: createPage })}`);
    }
    await fillByTestId(client, 'create-post-content-input', user.postContent);
    await clickTestId(client, 'create-post-circle-c5');
    await clickTestId(client, 'create-post-submit-btn');
    await wait(3500);

    await back(client);
    await clickTestId(client, 'community-tab-latest');
    await wait(1200);

    const postId = await waitFor(() => client.evaluate(`
      (function() {
        const cards = [...document.querySelectorAll('[data-testid^="post-card-"]')];
        const card = cards.find((node) => (node.innerText || '').includes(${JSON.stringify(user.postContent)}));
        if (!card) return null;
        return card.getAttribute('data-testid').replace('post-card-', '');
      })();
    `), 12000, 800);
    if (!postId) throw new Error('Could not locate created post card in UI');

    await clickTestId(client, 'community-circle-chip-c5');
    const filteredPostId = await waitFor(() => client.evaluate(`
      (function() {
        const cards = [...document.querySelectorAll('[data-testid^="post-card-"]')];
        const card = cards.find((node) => (node.innerText || '').includes(${JSON.stringify(user.postContent)}));
        return card ? card.getAttribute('data-testid').replace('post-card-', '') : null;
      })();
    `), 12000, 800);
    if (filteredPostId !== postId) {
      throw new Error(`Circle filter did not return the newly created post: ${JSON.stringify({ postId, filteredPostId })}`);
    }

    const externalComment = await apiRequest(
      'POST',
      `/posts/${postId}/comments`,
      { content: `通知测试评论 ${user.postContent}` },
      notifier.accessToken,
    );
    if (externalComment.status !== 201) {
      throw new Error(`External notification comment failed: ${JSON.stringify(externalComment)}`);
    }

    await clickTestId(client, `post-${postId}-bookmark-btn`);
    await wait(1200);
    await clickTestId(client, 'community-see-all-circles-btn');
    await wait(1800);
    const circleListState = await pageState(client);
    if (!circleListState.testIds.includes('circle-list-card-c5')) {
      throw new Error(`Circle list did not render API-backed c5 card: ${JSON.stringify(circleListState)}`);
    }
    await clickTestId(client, 'circle-list-create-btn');
    await wait(1200);
    const createdCircleName = `UI圈子${String(Date.now()).slice(-6)}`;
    await fillByTestId(client, 'create-circle-name-input', createdCircleName);
    await fillByTestId(client, 'create-circle-description-input', 'UI 冒烟创建的圈子');
    await clickTestId(client, 'create-circle-submit-btn');
    await wait(2000);
    const createdCircleState = await pageState(client);
    if (!createdCircleState.text.includes(createdCircleName) || !createdCircleState.testIds.includes('circle-detail-name')) {
      throw new Error(`Created circle did not reach detail page: ${JSON.stringify(createdCircleState)}`);
    }
    if (!createdCircleState.testIds.includes('circle-detail-edit-btn')) {
      throw new Error(`Circle owner did not receive edit action: ${JSON.stringify(createdCircleState)}`);
    }
    await clickTestId(client, 'circle-detail-edit-btn');
    await wait(500);
    await fillByTestId(client, 'circle-detail-edit-description-input', 'UI 冒烟编辑后的圈子简介');
    await clickTestId(client, 'circle-detail-edit-submit-btn');
    await wait(1600);
    const editedCircleState = await pageState(client);
    if (!editedCircleState.text.includes('UI 冒烟编辑后的圈子简介')) {
      throw new Error(`Circle owner edit did not update detail page: ${JSON.stringify(editedCircleState)}`);
    }
    await back(client);
    await wait(1200);
    await clickTestId(client, 'circle-list-join-c5');
    await wait(1200);
    await clickTestId(client, 'circle-list-tab-my');
    await wait(1500);
    const myCirclesState = await pageState(client);
    if (!myCirclesState.testIds.includes('circle-list-card-c5')) {
      throw new Error(`My circles did not include joined c5: ${JSON.stringify(myCirclesState)}`);
    }
    await clickTestId(client, 'circle-list-tab-all');
    await wait(1000);
    await clickTestId(client, 'circle-list-card-c5');
    await wait(1800);
    const circleDetail = await pageState(client);
    if (!circleDetail.testIds.includes('circle-detail-name')) {
      throw new Error(`Circle detail did not render API-backed detail state: ${JSON.stringify(circleDetail)}`);
    }
    await clickTestId(client, 'circle-detail-members-btn');
    await wait(1000);
    const membersState = await pageState(client);
    if (!membersState.text.includes('圈子成员') || !membersState.text.includes('成员')) {
      throw new Error(`Circle members panel did not render: ${JSON.stringify(membersState)}`);
    }
    await clickTestId(client, 'circle-detail-members-close-btn');
    await back(client);
    await clickTestId(client, `post-${postId}-comment-btn`);
    await wait(1600);
    await fillByTestId(client, 'reply-input-field', user.commentContent);
    await clickTestId(client, 'reply-input-send');
    await wait(1600);

    const detailText = await waitFor(
      async () => {
        const text = await textSnapshot(client);
        return text.includes(user.commentContent) ? text : null;
      },
      12000,
      800,
    );
    if (!detailText.includes(user.commentContent)) {
      throw new Error('Comment text not visible after submit');
    }

    await back(client);
    await wait(1200);
    await clickTestId(client, 'tab-profile');
    await wait(1800);
    await clickTestId(client, 'profile-menu-notification');
    const notificationText = await waitFor(async () => {
      const text = await textSnapshot(client);
      return text.includes('评论了你的帖子') ? text : null;
    }, 20000, 800);
    if (!notificationText) {
      const state = await pageState(client);
      throw new Error(`Real notification was not visible: ${JSON.stringify(state)}`);
    }

    console.log(JSON.stringify({
      ok: true,
      user: {
        username: user.username,
        nickname: user.nickname,
      },
      postId,
      postContent: user.postContent,
      commentContent: user.commentContent,
      verified: [
        'guest-wiki',
        'register',
        'create-primary-pet',
        'create-post',
        'comment-post',
        'join-circle',
        'bookmark-post',
        'real-notification-visible',
      ],
    }, null, 2));
  } finally {
    await client.close();
    if (frontend) {
      stopProcessTree(frontend);
    }
    if (chrome) {
      stopProcessTree(chrome);
    }
    const cleanup = spawnSync(process.execPath, [path.join(__dirname, 'cleanup-test-data.js'), '--apply'], {
      stdio: 'inherit',
      env: process.env,
    });
    if (cleanup.status !== 0) {
      throw new Error(`UI smoke test data cleanup failed with exit code ${cleanup.status}`);
    }
  }
}

run().catch((error) => {
  if (error instanceof Error) {
    console.error(error.stack || error.message);
  } else {
    console.error(JSON.stringify(error, null, 2));
  }
  process.exit(1);
});
