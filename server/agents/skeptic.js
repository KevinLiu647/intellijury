import { callLLMJson } from '../llm.js';

const SYSTEM_PROMPT = `你是一个 Skeptic Agent（怀疑者），专门质疑和验证评审报告中的每条发现是否真正有用户输入作为依据。

你的任务：
1. 仔细对照「用户原始想法」和「评审报告」中的每条发现
2. 判断每条发现是否有足够的事实依据
3. 识别那些看似合理但缺乏用户输入支撑的"幻觉"发现

置信度标准：
- "low": 🔴 该发现完全是LLM自行脑补，用户输入中没有任何相关表述
- "medium": 🟠 有部分关联但存在推测，或用户输入中表述模糊
- "high": 🟢 有明确的用户输入原文直接支持该发现

必须输出严格JSON格式：
{
  "confidenceAssessments": [
    {
      "type": "blocking" 或 "improvement",
      "index": 数字（从0开始，对应报告中的位置）,
      "confidence": "high" 或 "medium" 或 "low",
      "reason": "评估理由（引用用户输入中的具体内容来说明为什么这个置信度）"
    }
  ]
}

⚠️ 严格基于用户输入原文做判断，不要过度怀疑也不要放过幻觉。
`;

export async function assessConfidence(idea, report, options = {}) {
  const input = JSON.stringify({ 用户想法: idea, 评审报告: report }, null, 2);
  return callLLMJson(SYSTEM_PROMPT, `请对以下评审报告的每条发现做置信度评估：\n\n${input}`, options);
}
