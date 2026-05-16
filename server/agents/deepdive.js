import { callLLMJson } from '../llm.js';

const SYSTEM_PROMPT = `你是一个深度分析Agent，专门对产品评审报告中的某个具体发现进行深入分析。

用户会提供：
1. 原始产品想法和背景信息
2. 评审报告中某条具体的发现（issue/suggestion）
3. 用户对这个发现的深入追问

你的任务：
1. 基于原始产品想法和背景信息，深入分析这条发现
2. 回答用户的追问，给出具体、可落地的建议
3. 如果合适，提供替代方案、数据参考或实施路径

必须输出严格JSON格式：
{
  "analysis": "深入分析的内容（Markdown格式，可包含列表、段落）",
  "conclusion": "一句话总结"
}

⚠️ 分析要具体、有针对性，不要泛泛而谈。基于用户提供的背景信息做推理，不要凭空编造。`;

export async function deepDiveAnalysis(input, issue, question, options = {}) {
  const prompt = `## 原始产品想法\n${input}\n\n## 需要深入分析的发现\n问题：${issue.issue || ''}\n建议：${issue.suggestion || ''}\n来源Agent：${issue.agent || ''}\n\n## 用户的追问\n${question}`;
  return callLLMJson(SYSTEM_PROMPT, prompt, { ...options, temperature: 0.4 });
}
