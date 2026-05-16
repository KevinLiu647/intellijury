# 智评团 IntelliJury

> 输入产品想法 → 5个专用Agent并行评审 → 合成结构化评审报告 → 置信度过滤 → 可追问 → 可下载PDF

一个展示 **Multi-Agent 编排能力** 的生产级全栈系统。用户输入一个产品想法，系统自动分析、分配任务、并行评审、合并结果、幻觉过滤，最终输出带有置信度评分的结构化报告。支持高频并发、排队机制、深度追问、移动端下载PDF。

**线上体验**：[https://comm.fsy2lsq.xin/review/](https://comm.fsy2lsq.xin/review/)

---

## 🚀 What It Does

Users describe a product idea in natural language. The system automatically analyzes, assigns tasks to specialized agents, executes them in parallel, synthesizes results, validates each finding for hallucination, and outputs a structured review report — all via real-time SSE streaming.

Built from scratch on a 2C2G ECS, no scaffolding, no boilerplate generators.

---

## 🧠 Multi-Agent Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  User Input (product idea)               │
└──────────────────┬──────────────────────────────────────┘
                   │ POST /api/review (SSE stream)
                   ▼
┌──────────────────────────────────────────────────────────┐
│                     Supervisor Agent                      │
│  Analyzes intent → determines required agents → assigns  │
│  context from the user's description                      │
└──────────┬────────────────────────┬──────────────────────┘
           │                        │
           ▼                        ▼
┌─────────────────────┐  ┌─────────────────────┐
│   Product Agent     │  │   Pricing Agent     │
│  (Architecture)     │  │  (Business Model)   │
└──────────┬──────────┘  └──────────┬──────────┘
           │                        │
           │  ┌───────────────────────────┐
           └──┤       Tech Agent          │
              │  (Technical Feasibility)  │
              └──────────┬────────────────┘
                         │ All 3 run in parallel via Promise.all()
                         ▼
┌──────────────────────────────────────────────────────────┐
│                   Synthesizer Agent                       │
│  Merges all findings, detects contradictions between     │
│  agents, produces unified structured report               │
└──────────┬───────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────┐
│                   Skeptic Agent                            │
│  Validates each finding against user input, assigns       │
│  confidence level (high/medium/low), filters out          │
│  unsupported claims                                       │
└──────────────────────────────────────────────────────────┘
           │
           ▼
         Structured Report with Confidence Scoring
```

### Agent Roles

| Agent | Role | Responsibility |
|-------|------|----------------|
| **Supervisor** | Task orchestrator | Understands the product idea, determines which agents to invoke, assigns context |
| **Product** | Domain expert | Reviews product architecture, UX, feature completeness |
| **Pricing** | Business analyst | Evaluates pricing model, target market, go-to-market strategy |
| **Tech** | Engineering assessor | Assesses technical feasibility, implementation complexity, risk |
| **Synthesizer** | Report compiler | Merges all agent outputs, detects contradictions, formats final report |
| **Skeptic** | Quality gate | Validates each discovery against source input, assigns confidence, filters hallucination |

---

## 🔧 Key Technical Features

### Real-time SSE Streaming
Server-Sent Events with proper `res.on('close')` cleanup (not `req.on('close')` which fires prematurely). Heartbeat mechanism keeps the connection alive. Nginx `proxy_buffering off` ensures zero-latency event delivery.

### Concurrency Queue
`MAX_CONCURRENT=2` with auto-queuing. Queue position updates are pushed to the client in real-time. Disconnected clients are automatically removed from the queue — no phantom resource consumption.

### AbortController Down-propagation
Cancellation token flows through every layer: HTTP request → queue → agent execution → LLM API call. Aborting a review at any stage immediately terminates all in-flight LLM calls, freeing resources within 25 seconds.

### Hallucination Defense (Skeptic Agent)
A dedicated Skeptic Agent cross-references every finding against the original user input, scoring each on a 3-level confidence scale:
- 🟢 **High** — directly supported by source text
- 🟠 **Medium** — reasonable inference, some speculation
- 🔴 **Low** — no support, auto-filtered from output

Low-confidence findings are hidden with a count shown in the legend, keeping the report clean and trustworthy.

### Conflict Detection
The Synthesizer compares findings across agents and flags contradictions (e.g., Product says "feasible" while Tech says "high risk"). Contradictions are highlighted in a dedicated section with a recommendation for human review.

### Fault Tolerance
- Global `uncaughtException` / `unhandledRejection` handlers
- AbortError is silently ignored (normal cancellation ≠ error)
- 25s per-LLM-call timeout
- 120s frontend fetch timeout with retry button
- SSE heartbeat every 15s prevents proxy timeout
- Client disconnect properly cleans up all resources

### Zero Dependencies on Agent Frameworks
No LangChain, no CrewAI, no AutoGen. Each agent is a specialized prompt + `callLLMJson()` wrapper — minimal abstraction, full control, easy to inspect and debug.

---

## 📊 Report Structure

| Section | Content |
|---------|---------|
| Overall Score | Ring visualization (0-10) + conclusion label |
| Dimension Scores | Per-agent breakdown (Product, Pricing, Tech) |
| Confidence Legend | Explains high/medium/filtered badges |
| 🔴 Blocking Issues | Critical problems with confidence badges |
| 🟠 Improvements | Suggestions with confidence badges |
| ✅ Core Strengths | What the product does well |
| ⚡ Agent Contradictions | Cross-agent conflicts requiring human judgment |
| 📋 Detail Reports | Full agent summaries per dimension |
| 📄 PDF Export | Print-optimized layout with cover page |

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vue 3 + TypeScript + Element Plus |
| Build | Vite 8 |
| Backend | Node.js + Express |
| Real-time | Server-Sent Events |
| LLM API | DeepSeek (deepseek-chat) |
| Deployment | 2C2G ECS + Nginx + pm2 |
| PDF | Native `window.print()` (searchable, no image) |

---

## 🏗 Project Structure

```
agent-review-demo/
├── server/                    # Node.js + Express backend
│   ├── index.js              # HTTP server, SSE endpoint, concurrency queue
│   ├── llm.js                # DeepSeek API wrapper (25s timeout + AbortSignal)
│   ├── config.js             # Configuration
│   ├── agents/               # Multi-agent system
│   │   ├── supervisor.js     # Task analysis & allocation
│   │   ├── productAgent.js   # Product architecture review
│   │   ├── pricingAgent.js   # Pricing & business model review
│   │   ├── techAgent.js      # Technical feasibility review
│   │   ├── synthesizer.js    # Result merging + conflict detection
│   │   └── skeptic.js        # Confidence assessment & hallucination filter
│   └── .env                  # API key (gitignored)
│
├── frontend/                  # Vue 3 + TypeScript SPA
│   ├── src/
│   │   ├── App.vue            # Page routing + SSE stream handler
│   │   ├── main.ts            # Entry point (Element Plus registration)
│   │   ├── config/agents.ts   # Shared agent name config
│   │   └── views/
│   │       ├── InputView.vue       # Text input + examples + review history
│   │       ├── ReviewProgress.vue   # Agent status cards with animation
│   │       └── ReportView.vue       # Score ring + findings + PDF download
│   └── vite.config.ts
│
└── README.md
```

---

## 📈 Performance

| Metric | Value |
|--------|-------|
| LLM calls per review | 5 (Supervisor + 3 agents + Synthesizer + Skeptic) |
| Per-call timeout | 25 seconds |
| Typical completion | 40–80 seconds |
| Max concurrent reviews | 2 (configurable) |
| Frontend timeout | 120 seconds |
| Idle memory | ~25 MB |
| Full load memory | ~70 MB |
| Input limit | 3000 characters |

---

## 🔌 API

### `POST /api/review`
Initiates a review. Returns SSE stream.

**Request:**
```json
{ "idea": "AI customer service for small e-commerce sellers..." }
```

**Events:** queue → status → supervisor_done → agent_start/agent_done (per agent, parallel) → report → done

### `GET /api/health`
```json
{ "status": "ok", "agents": ["product", "pricing", "tech"], "activeReviews": 0, "queueLength": 0 }
```

---

## 🌐 Deployment

```bash
# Backend
cd server && npm install && pm2 start index.js --name agent-review-demo

# Frontend
cd ../frontend && npm install && npm run build
```

Nginx subpath configuration with SSE-specific settings (`proxy_buffering off`, `proxy_read_timeout 300s`). See deployment docs for details.

---

## ⚡ Design Decisions

| Decision | Rationale |
|----------|-----------|
| No agent framework | Full control, minimal dependencies, easy to debug |
| SSE over WebSocket | Simpler for one-way streaming, native HTTP support, Nginx-friendly |
| Native print for PDF | Text is selectable/searchable, no rendering dependencies |
| Skeptic post-validation | Catches hallucinations after synthesis, not inline (preserves agent creativity) |
| Promise.all() for agents | True parallelism on independent tasks |

---

## Usage as a Resume Project

This project demonstrates:
- **Multi-Agent System Design**: Task decomposition, role-based specialization, parallel execution, result synthesis
- **Production-Grade Engineering**: Fault tolerance, concurrency control, resource cleanup, real-time streaming
- **LLM Operations**: API integration, structured output parsing, timeout handling, hallucination defense
- **Full-Stack Delivery**: Vue 3 SPA, responsive mobile UI, Nginx deployment, pm2 process management

Built entirely by a single developer with AI-assisted coding, from concept to deployed production system on a 2C2G server.
