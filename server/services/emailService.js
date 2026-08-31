const EMAIL_NOT_CONFIGURED = 'EMAIL_NOT_CONFIGURED';

function getEmailConfig(env = process.env) {
  return {
    provider: String(env.EMAIL_PROVIDER || '').trim().toLowerCase(),
    from: env.EMAIL_FROM || '',
    mailpitUrl: env.EMAIL_MAILPIT_URL || 'http://127.0.0.1:8025',
    apiUrl: env.EMAIL_API_URL || '',
    apiKey: env.EMAIL_API_KEY || '',
  };
}

function isConfigured(env = process.env) {
  const config = getEmailConfig(env);
  if (!config.provider || !config.from) return false;
  if (config.provider === 'mailpit') return Boolean(config.mailpitUrl);
  if (config.provider === 'webhook') return Boolean(config.apiUrl && config.apiKey);
  return false;
}

function configurationError() {
  const error = new Error('邮件服务未配置，请设置 EMAIL_PROVIDER、EMAIL_FROM 及对应 provider 参数');
  error.code = EMAIL_NOT_CONFIGURED;
  return error;
}

async function sendEmail({ to, subject, text, html }, env = process.env) {
  const config = getEmailConfig(env);
  if (!isConfigured(env)) throw configurationError();

  const payload = {
    From: { Email: config.from },
    To: [{ Email: to }],
    Subject: subject,
    Text: text,
    HTML: html,
  };

  let url;
  let headers = { 'Content-Type': 'application/json' };
  if (config.provider === 'mailpit') {
    url = `${config.mailpitUrl.replace(/\/$/, '')}/api/v1/send`;
  } else if (config.provider === 'webhook') {
    url = config.apiUrl;
    headers.Authorization = `Bearer ${config.apiKey}`;
  } else {
    throw configurationError();
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = new Error(`邮件服务返回 HTTP ${response.status}`);
    error.code = 'EMAIL_PROVIDER_ERROR';
    throw error;
  }
  return { provider: config.provider };
}

module.exports = {
  EMAIL_NOT_CONFIGURED,
  getEmailConfig,
  isConfigured,
  sendEmail,
};
