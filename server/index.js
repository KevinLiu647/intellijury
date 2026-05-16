import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { supervisorAnalysis } from './agents/supervisor.js';
import { reviewProduct } from './agents/productAgent.js';
import { reviewPricing } from './agents/pricingAgent.js';
import { reviewTech } from './agents/techAgent.js';
import { synthesize } from './agents/synthesizer.js';
import { assessConfidence } from './agents/skeptic.js';
import { deepDiveAnalysis } from './agents/deepdive.js';

// ============ 全局异常兜底 ============
process.on('uncaughtException', (err) => {
  console.error('💥 UNCAUGHT EXCEPTION:', err.message, err.stack);
});
process.on('unhandledRejection', (reason) => {
  console.error('💥 UNHANDLED REJECTION:', reason);
});

const app = express();
app.use(cors());
app.use(express.json({ limit: '50kb' }));

// ============ 请求日志 ============
app.use((req, res, next) => {
  if (req.path === '/api/review') {
    console.log(`📥 [${new Date().toISOString()}] POST ${req.ip} idea="${(req.body?.idea || '').slice(0, 30)}..."`);
  }
  next();
});

// ============ Agent映射表 ============
const AGENTS = {
  product: { name: '产品架构评审', run: reviewProduct },
  pricing: { name: '商业模式评审', run: reviewPricing },
  tech: { name: '技术可行性评审', run: reviewTech },
};

// ============ 并发队列（最多2个同时评审） ============
const MAX_CONCURRENT = 2;
const queue = [];
let activeCount = 0;

function broadcastPosition() {
  queue.forEach((item, index) => {
    const pos = index + 1;
    if (pos !== item.lastSentPos) {
      item.lastSentPos = pos;
      item.sendEvent({ type: 'queue', position: pos });
    }
  });
}

function processNext() {
  if (queue.length === 0 || activeCount >= MAX_CONCURRENT) return;
  activeCount++;
  const item = queue.shift();
  broadcastPosition();
  item.run().finally(() => {
    activeCount--;
    processNext();
  });
}

function enqueue(sendEvent, executor) {
  return new Promise((resolve, reject) => {
    queue.push({
      sendEvent,
      lastSentPos: -1,
      run: async () => {
        try { resolve(await executor()); } catch (err) { reject(err); }
      },
    });
    processNext();
  });
}

// ============ 构建带上下文的输入 ============
function buildInput(idea, context) {
  if (!context) return idea;
  const parts = [`## 产品想法\n${idea}`];
  const ctxMap = {
    techStack: '技术栈',
    teamSize: '团队规模',
    devCycle: '开发周期',
    budgetRange: '预算范围',
    existingProduct: '已有产品/数据',
  };
  const ctxLines = [];
  for (const [key, label] of Object.entries(ctxMap)) {
    if (context[key]) ctxLines.push(`- ${label}：${context[key]}`);
  }
  if (ctxLines.length > 0) {
    parts.push(`## 用户补充信息\n${ctxLines.join('\n')}`);
  }
  return parts.join('\n\n');
}

// ============ 核心评审流程 ============
async function runReview(idea, context, onEvent, signal) {
  const options = { signal };
  const input = buildInput(idea, context);

  // Step 1: Supervisor 分析
  onEvent({ type: 'status', message: 'Supervisor正在分析产品想法...' });
  const analysis = await supervisorAnalysis(input, options);
  onEvent({ type: 'supervisor_done', data: analysis });

  const agentList = analysis.agentsToRun || ['product', 'pricing', 'tech'];
  const results = {};

  // Step 2: 并行运行子Agent
  const tasks = agentList.map(async (key) => {
    const agent = AGENTS[key];
    if (!agent) return;

    onEvent({
      type: 'agent_start',
      agent: key,
      name: agent.name,
    });

    try {
      const extraCtx = analysis.agentContext?.[key] || '';
      const agentInput = extraCtx ? `${input}\n\nSupervisor补充：${extraCtx}` : input;
      const result = await agent.run(agentInput, options);

      results[key] = { score: result.score, summary: result.summary, findings: result.findings, strengths: result.strengths, conclusion: result.conclusion };

      onEvent({
        type: 'agent_done',
        agent: key,
        name: agent.name,
        result: results[key],
      });
    } catch (err) {
      if (err.name === 'AbortError') return;
      onEvent({
        type: 'agent_error',
        agent: key,
        name: agent.name,
        error: err.message,
      });
    }
  });

  await Promise.all(tasks);

  // Step 3: Synthesizer 汇总
  onEvent({ type: 'status', message: 'Synthesizer正在汇总评审结果...' });
  const finalReport = await synthesize(results, options);
  onEvent({ type: 'report', data: finalReport });

  // Step 4: Skeptic Agent 置信度评估
  onEvent({ type: 'status', message: 'Skeptic正在逐一验证每条发现的依据...' });
  try {
    const confidence = await assessConfidence(input, finalReport, options);
    onEvent({ type: 'confidence', data: confidence.confidenceAssessments || [] });
  } catch (err) {
    console.warn('⚠️ Skeptic评估失败:', err.message);
    onEvent({ type: 'confidence', data: [] });
  }

  return finalReport;
}

// ============ SSE 端点 ============
app.post('/api/review', async (req, res) => {
  const { idea, context } = req.body;
  if (!idea || idea.trim().length < 5) {
    return res.status(400).json({ error: '请输入至少5个字符的产品想法' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const reviewAbort = new AbortController();
  let clientDisconnected = false;

  res.on('close', () => {
    clientDisconnected = true;
    reviewAbort.abort();
    clearInterval(heartbeat);
    const idx = queue.findIndex(item => item.sendEvent === sendEvent);
    if (idx !== -1) queue.splice(idx, 1);
    console.log(`📴 Client ${req.ip} disconnected`);
  });

  const heartbeat = setInterval(() => {
    if (clientDisconnected) return;
    try { res.write(`:heartbeat ${Date.now()}\n\n`); } catch {}
  }, 15_000);

  const sendEvent = (data) => {
    if (clientDisconnected) return;
    try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch {}
  };

  try {
    const initialPos = queue.length + 1;
    if (initialPos > MAX_CONCURRENT) {
      sendEvent({ type: 'queue', position: initialPos });
    }

    await enqueue(sendEvent, async () => {
      await runReview(idea, context, sendEvent, reviewAbort.signal);
    });
  } catch (err) {
    if (!clientDisconnected) {
      console.error('❌ 评审异常:', err.message);
      sendEvent({ type: 'error', message: err.message });
    }
  }

  clearInterval(heartbeat);
  if (!clientDisconnected) {
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  }
});

// ============ 深度追问端点 ============
app.post('/api/deepdive', async (req, res) => {
  const { idea, context, issue, question } = req.body;
  if (!issue || !question) {
    return res.status(400).json({ error: '缺少 issue 或 question' });
  }

  const input = buildInput(idea, context);

  try {
    const result = await deepDiveAnalysis(input, issue, question);
    res.json({ result });
  } catch (err) {
    console.error('❌ DeepDive异常:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============ 健康检查 ============
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    agents: Object.keys(AGENTS),
    activeReviews: activeCount,
    queueLength: queue.length,
  });
});

// ============ 静态文件 ============
app.use(express.static('../frontend/dist'));

app.listen(config.port, () => {
  console.log(`✅ 智评团 IntelliJury running on http://localhost:${config.port}`);
  console.log(`   Agents: ${Object.keys(AGENTS).join(', ')}`);
  console.log(`   Max concurrent reviews: ${MAX_CONCURRENT}`);
});
