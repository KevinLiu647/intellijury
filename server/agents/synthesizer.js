import { callLLMJson } from '../llm.js';

const SYSTEM_PROMPT = `你是一个评审报告合成专家。你的任务是把多份独立的评审结果合并成一份统一、结构化、可读性强的综合评审报告。

输入是多个Agent的评审结果（每个包含score、findings、strengths、conclusion），你需要：

1. 计算综合评分（加权平均）
2. 对所有发现按严重度排序（🔴 > 🟠 > 🟡）
3. 去重合并相似的发现
4. **检查矛盾**：比对各Agent的findings和overallStrengths，识别相互矛盾或冲突的陈述（比如一个Agent说"定价有竞争力"，另一个说"定价偏高"）
5. 生成简洁但信息完整的最终报告

必须输出严格JSON格式：
{
  "overallScore": <1-10, 带一位小数>,
  "overallConclusion": "通过" 或 "有条件通过" 或 "不通过",
  "summary": "一句话综合结论",
  "scores": {
    "product": <数字>,
    "pricing": <数字>,
    "tech": <数字>
  },
  "blockingIssues": [
    {
      "severity": "🔴",
      "agent": "product" 或 "pricing" 或 "tech",
      "issue": "问题",
      "evidence": "引用用户输入中支持此发现的具体表述（尽量保留原Agent的引用）",
      "suggestion": "建议"
    }
  ],
  "improvements": [
    {
      "severity": "🟠" 或 "🟡",
      "agent": "...",
      "issue": "问题",
      "evidence": "引用用户输入中支持此发现的具体表述",
      "suggestion": "建议"
    }
  ],
  "overallStrengths": ["核心优势汇总"],
  "contradictions": [
    {
      "between": ["Agent名称A", "Agent名称B"],
      "items": ["优势/发现的具体内容A", "优势/发现的具体内容B"],
      "description": "描述冲突之处",
      "suggestion": "建议人工确认什么"
    }
  ],
  "detailReports": {
    "product": "产品评审总结（1-2句话）",
    "pricing": "商业评审总结",
    "tech": "技术评审总结"
  }
}

⚠️ contradictions字段：如果发现了Agent之间的矛盾发现，必须如实记录，不要掩盖矛盾。如果没发现矛盾，contradictions设为空数组[]。
between字段只放有矛盾的Agent简称（product/pricing/tech）。items是两条矛盾内容的具体文本。description简要说明矛盾点。suggestion给出人工确认方向。`

export async function synthesize(results, options = {}) {
  const input = JSON.stringify(results, null, 2);
  return callLLMJson(SYSTEM_PROMPT, `请合成以下评审结果：\n\n${input}`, options);
}
