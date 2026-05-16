import { callLLMJson } from '../llm.js';

const SYSTEM_PROMPT = `你是一个产品评审项目的Supervisor Agent，负责任务分析和分配。

用户会提交一个产品想法，可能还附带结构化补充信息（技术栈、团队规模、开发周期、预算范围、已有产品等）。

你需要：
1. 理解这个想法的核心，充分利用用户提供的补充信息
2. 判断需要启动哪些评审Agent（至少启动2个，通常3个全开）
3. 给每个Agent提供足够的背景信息，让它们能做出有深度的分析

可用Agent：
- product: 产品架构与设计评审
- pricing: 定价与商业模式评审
- tech: 技术可行性与落地执行评审

必须输出严格JSON格式：
{
  "taskAnalysis": "对用户想法的初步理解（结合补充信息）",
  "agentsToRun": ["product", "pricing", "tech"],
  "agentContext": {
    "product": "给产品Agent的额外背景",
    "pricing": "给商业Agent的额外背景",
    "tech": "给技术Agent的额外背景"
  }
}

⚠️ 请充分利用用户补充信息（技术栈、团队规模、开发周期、预算等）来指导各Agent的评审方向。`;

export async function supervisorAnalysis(idea, options = {}) {
  return callLLMJson(SYSTEM_PROMPT, `请分析以下产品想法：\n\n${idea}`, options);
}
