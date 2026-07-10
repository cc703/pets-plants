const express = require('express');
const { createRateLimit } = require('../middleware/rateLimit');

const router = express.Router();
const aiRateLimit = createRateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyPrefix: 'ai',
});

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const SAFETY_NOTE = 'AI 建议仅供养宠参考，不能替代兽医诊疗；若宠物持续呕吐、精神萎靡、呼吸异常、抽搐、外伤出血等，请尽快就医。';

const SYSTEM_PROMPT = `你是"萌宠星球"的 AI 宠物顾问，名叫"萌萌"。你的职责是：

1. 品种识别与推荐：根据用户描述推荐合适的宠物品种
2. 养护知识：提供喂养、美容、运动等方面的专业建议
3. 健康问答：解答宠物健康相关问题（注意：严重问题建议就医）
4. 行为训练：提供宠物行为训练建议
5. 趣味冷知识：分享有趣的宠物知识

回复要求：
- 使用中文回答
- 语气亲切友好，适当使用 emoji
- 回答要专业但易懂
- 涉及医疗问题时，提醒用户咨询专业兽医
- 回答控制在 300 字以内`;

async function requestDeepSeek(messages, options = {}) {
  if (!DEEPSEEK_API_KEY) {
    const error = new Error('DEEPSEEK_API_KEY missing');
    error.statusCode = 500;
    throw error;
  }

  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages,
      max_tokens: options.maxTokens || 1024,
      temperature: options.temperature ?? 0.7,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    console.error('DeepSeek API error:', response.status, errBody);
    const error = new Error('DeepSeek API error');
    error.statusCode = 502;
    throw error;
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

router.post('/chat', aiRateLimit, async (req, res) => {
  try {
    console.log('[AI] 收到聊天请求');
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ code: 1001, message: '消息内容不能为空' });
    }

    if (!DEEPSEEK_API_KEY) {
      console.error('[AI] DEEPSEEK_API_KEY 未设置');
      return res.status(500).json({ code: 5000, message: 'AI 服务未配置，请在 .env 中设置 DEEPSEEK_API_KEY' });
    }

    console.log('[AI] API Key 已配置，正在调用 DeepSeek...');

    const apiMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.map((m) => ({
        role: m.isUser ? 'user' : 'assistant',
        content: m.text,
      })),
    ];

    const reply = await requestDeepSeek(apiMessages) || '抱歉，我没有理解你的问题，请换个方式描述一下～';
    console.log('[AI] DeepSeek 响应成功，回复长度:', reply.length);

    return res.json({ code: 0, data: { reply, safetyNote: SAFETY_NOTE } });
  } catch (error) {
    console.error('AI chat error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

router.get('/knowledge', aiRateLimit, async (req, res) => {
  try {
    if (!DEEPSEEK_API_KEY) {
      console.error('[AI] DEEPSEEK_API_KEY 未设置');
      return res.status(500).json({ code: 5000, message: 'AI 服务未配置，请在 .env 中设置 DEEPSEEK_API_KEY' });
    }

    const topic = String(req.query.topic || '猫狗日常养护、品种趣闻、宠物安全提醒').slice(0, 80);
    const content = await requestDeepSeek([
      {
        role: 'system',
        content:
          '你是萌宠星球的宠物知识编辑。请生成一个适合首页“今日知识”卡片的中文宠物知识点，优先给出可靠、实用、非医疗诊断的内容。',
      },
      {
        role: 'user',
        content:
          `主题范围：${topic}。只返回一条 45 到 80 个中文字符的知识正文，不要标题、编号、Markdown 或解释。`,
      },
    ], { maxTokens: 300, temperature: 0.9 });

    const text = content
      .replace(/^["“]|["”]$/g, '')
      .replace(/^[-*\d.、\s]+/, '')
      .trim();

    const knowledge = {
      icon: 'sparkles',
      title: 'AI 新知',
      text: text.slice(0, 120),
      source: 'DeepSeek AI',
    };

    if (!knowledge.text) {
      return res.status(502).json({ code: 5002, message: 'AI 知识生成失败，请稍后重试' });
    }

    return res.json({ code: 0, data: knowledge });
  } catch (error) {
    console.error('AI knowledge error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({
      code: status === 502 ? 5002 : 5000,
      message: status === 502 ? 'AI 服务响应异常，请稍后重试' : '服务器内部错误',
    });
  }
});

module.exports = router;
