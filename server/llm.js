import { config } from './config.js';

const TIMEOUT_MS = 25_000; // 单次LLM调用超时25秒

/**
 * 调用 DeepSeek API
 */
export async function callLLM(systemPrompt, userMessage, options = {}) {
  const {
    temperature = 0.3,
    maxTokens = 2048,
    signal: externalSignal = null,
  } = options;

  const body = {
    model: config.deepseek.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature,
    max_tokens: maxTokens,
  };

  // 合并内部超时 + 外部中断
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      throw new Error('评审已被中断');
    }
    externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const res = await fetch(`${config.deepseek.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.deepseek.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`DeepSeek API error ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = await res.json();
    return data.choices[0].message.content;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 调用LLM并解析JSON（自动重试一次解析失败的情况）
 */
export async function callLLMJson(systemPrompt, userMessage, options = {}) {
  // 在system prompt里强调JSON输出
  let jsonPrompt = `${systemPrompt}\n\n⚠️ 必须输出严格JSON格式，不要markdown包裹，不要多余文字，以{开头以}结尾。`;
  
  let text;
  try {
    text = await callLLM(jsonPrompt, userMessage, {
      ...options,
      temperature: 0.1,
    });
  } catch (err) {
    // LLM调用本身失败（超时/中断等），直接抛
    throw err;
  }

  const result = tryParseJSON(text);
  if (result && result.summary !== 'AI未能生成有效评审，请重试') {
    return result;
  }

  // 解析失败，重试一次带更强硬的指令
  console.warn('⚠️ JSON解析失败，正在重试...');
  jsonPrompt = `${systemPrompt}\n\n🚨 严重警告：你上一条输出不是合法的JSON格式，导致系统崩溃。\n这次必须输出严格JSON格式，不要markdown包裹（不要\`\`\`json），不要多余文字，不要换行内注释。\n以{开头，以}结尾。整个输出必须是一个合法的JSON对象。`;
  
  try {
    text = await callLLM(jsonPrompt, userMessage, {
      ...options,
      temperature: 0.05, // 更低温度，更确定
    });
  } catch (err) {
    throw err;
  }

  return tryParseJSON(text);
}

function tryParseJSON(text) {
  // 去markdown包裹
  let cleaned = text.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/g, '').trim();

  // 尝试找到第一个 { ... } 块
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end > start) {
    cleaned = cleaned.slice(start, end + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    console.warn('JSON解析失败，原文:', text.slice(0, 150));
    // 返回一个兜底结构
    return {
      score: 5,
      summary: 'AI未能生成有效评审，请重试',
      findings: [{ severity: '🟡', issue: 'LLM输出解析失败', position: 'Agent', suggestion: '重新提交试试' }],
      strengths: [],
      conclusion: '评审失败',
    };
  }
}
