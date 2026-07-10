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

    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: apiMessages,
        max_tokens: 1024,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('DeepSeek API error:', response.status, errBody);
      return res.status(502).json({ code: 5002, message: 'AI 服务响应异常，请稍后重试' });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || '抱歉，我没有理解你的问题，请换个方式描述一下～';
    console.log('[AI] DeepSeek 响应成功，回复长度:', reply.length);

    return res.json({ code: 0, data: { reply, safetyNote: SAFETY_NOTE } });
  } catch (error) {
    console.error('AI chat error:', error);
    return res.status(500).json({ code: 5000, message: '服务器内部错误' });
  }
});

module.exports = router;
