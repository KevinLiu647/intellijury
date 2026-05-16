<template>
  <div id="app">
    <header class="app-header" :class="headerTheme">
      <div class="header-content">
        <h1 class="logo">智评团 <span class="logo-en">IntelliJury</span></h1>
        <p class="subtitle">AI Multi-Agent 产品评审系统 · 输入想法，5个Agent并行评审</p>
      </div>
    </header>

    <main class="app-main">
      <!-- 🤖 AI 免责提示 -->
      <div class="disclaimer-bar">
        ⚠️ AI 生成内容仅供参考，切勿盲目信任，谨防幻觉。<br class="d-break" />
        所有评审结论请结合实际情况人工判断。
      </div>

      <Transition name="page-fade" mode="out-in">
        <InputView v-if="page === 'input'" key="input" :history="historyItems" @start="startReview" />

        <ReviewProgress
          v-else-if="page === 'progress'" key="progress"
          :status="reviewStatus"
          :agents="agents"
          :analysis="analysis"
          @cancel="cancelReview"
          @retry="retryReview"
          @back="reset"
        />

        <ReportView
          v-else-if="page === 'report'" key="report"
          :report="report"
          :confidence="confidence"
          :idea="currentIdea"
          :context="currentContext"
          :deepdiveFn="handleDeepDive"
          @back="reset"
          @retry="retryReview"
        />
      </Transition>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import InputView from './views/InputView.vue'
import ReviewProgress from './views/ReviewProgress.vue'
import ReportView from './views/ReportView.vue'
import { AGENT_LIST } from './config/agents'

const page = ref<'input' | 'progress' | 'report'>('input')

interface AgentStatus {
  key: string
  name: string
  status: 'waiting' | 'running' | 'done' | 'error'
  result?: any
  error?: string
}

const agents = ref<AgentStatus[]>(
  AGENT_LIST.map(a => ({ ...a, status: 'waiting' as const }))
)

// Header 状态感知
const headerTheme = computed(() => {
  if (page.value === 'report') return 'header-done'
  if (page.value === 'progress') return 'header-running'
  return ''
})

const reviewStatus = ref('')
const analysis = ref<any>(null)
const report = ref<any>(null)
const confidence = ref<any[]>([])
const currentIdea = ref('')
const currentContext = ref<any>(null)

// AbortController 用于取消请求
let abortController: AbortController | null = null

// 前端fetch超时（120秒）
const FETCH_TIMEOUT = 120_000

function startReview(idea: string, context?: any) {
  currentIdea.value = idea
  currentContext.value = context || null
  page.value = 'progress'
  agents.value.forEach(a => { a.status = 'waiting'; a.result = undefined; a.error = undefined })
  reviewStatus.value = '正在连接评审服务...'
  analysis.value = null
  report.value = null
  confidence.value = []

  // 两个AbortController：一个给用户停止，一个给超时
  const userAbort = new AbortController()
  const timeoutAbort = new AbortController()
  const timeoutTimer = setTimeout(() => timeoutAbort.abort(), FETCH_TIMEOUT)
  abortController = userAbort

  function abortOnEither() {
    userAbort.abort()
    timeoutAbort.abort()
    clearTimeout(timeoutTimer)
  }
  userAbort.signal.addEventListener('abort', () => abortOnEither(), { once: true })

  const signal = combineAbortSignals([userAbort.signal, timeoutAbort.signal])

  const body: any = { idea }
  if (context) body.context = context

  fetch('api/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  }).then(async (res) => {
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`服务器错误 ${res.status}${text ? ': ' + text.slice(0, 100) : ''}`)
    }

    reviewStatus.value = '评审进行中'
    const reader = res.body?.getReader()
    if (!reader) return

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith(':')) continue
        if (!line.startsWith('data: ')) continue

        let data: any
        try {
          data = JSON.parse(line.slice(6))
        } catch {
          continue
        }

        switch (data.type) {
          case 'status':
            reviewStatus.value = data.message
            break
          case 'queue':
            reviewStatus.value = `⏳ 排队中，当前位置：第 ${data.position} 位`
            break
          case 'supervisor_done':
            analysis.value = data.data
            reviewStatus.value = '评审计划已生成'
            break
          case 'agent_start':
            const a1 = agents.value.find(a => a.key === data.agent)
            if (a1) a1.status = 'running'
            break
          case 'agent_done':
            const a2 = agents.value.find(a => a.key === data.agent)
            if (a2) { a2.status = 'done'; a2.result = data.result }
            break
          case 'agent_error':
            const a3 = agents.value.find(a => a.key === data.agent)
            if (a3) { a3.status = 'error'; a3.error = data.error }
            break
          case 'report':
            report.value = data.data
            break
          case 'confidence':
            confidence.value = data.data
            break
          case 'done':
            clearTimeout(timeoutTimer)
            page.value = 'report'
            saveReviewHistory(currentIdea.value, currentContext.value, report.value)
            break
          case 'error':
            reviewStatus.value = '❌ ' + data.message
            break
        }
      }
    }
  }).catch(err => {
    clearTimeout(timeoutTimer)
    if (err.name === 'AbortError') {
      reviewStatus.value = '⏹ 已取消'
      page.value = 'input'
    } else {
      reviewStatus.value = '❌ 连接失败: ' + err.message
    }
  })
}

// 深度追问
async function handleDeepDive(issue: any, question: string) {
  try {
    const res = await fetch('api/deepdive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idea: currentIdea.value,
        context: currentContext.value,
        issue,
        question,
      }),
    })
    if (!res.ok) throw new Error(`请求失败 ${res.status}`)
    const data = await res.json()
    return data.result
  } catch (err: any) {
    return { error: err.message || '深入分析请求失败，请重试' }
  }
}

// 组合AbortSignal
function combineAbortSignals(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController()
  for (const sig of signals) {
    if (sig.aborted) {
      controller.abort(sig.reason)
      return controller.signal
    }
    sig.addEventListener('abort', () => controller.abort(sig.reason), { once: true })
  }
  return controller.signal
}

function cancelReview() {
  if (abortController) {
    abortController.abort()
    abortController = null
  }
}

function retryReview() {
  if (currentIdea.value) {
    startReview(currentIdea.value, currentContext.value)
  }
}

function reset() {
  page.value = 'input'
  agents.value.forEach(a => { a.status = 'waiting'; a.result = undefined; a.error = undefined })
  reviewStatus.value = ''
  analysis.value = null
  report.value = null
  confidence.value = []
  currentIdea.value = ''
  currentContext.value = null
  window.scrollTo({ top: 0 })
}
// ===== 切后台检测：不再自动中止，避免"AI未能生成有效评审" =====
// 若SSE连接真的断了，fetch catch会显示连接失败并允许重试
// 若没断，回来继续接收就行

// ===== 评审历史缓存 =====
const HISTORY_KEY = 'review-history'
interface ReviewHistoryItem { idea: string; time: string; score: number; context?: any }

function saveReviewHistory(idea: string, context: any, report: any) {
  if (!idea || !report) return
  const list: ReviewHistoryItem[] = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
  list.unshift({
    idea: idea.slice(0, 60),
    context: context || undefined,
    time: new Date().toLocaleString('zh-CN'),
    score: report.overallScore ?? 0,
  })
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 3)))
}

function getReviewHistory(): ReviewHistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
  } catch { return [] }
}

const historyItems = getReviewHistory()
</script>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #faf3ec;
  color: #2c3e50;
  min-height: 100vh;
}

.app-header {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: #faf3ec;
  padding: 2rem 1rem;
  text-align: center;
  transition: background 0.4s ease;
}
.app-header.header-running {
  background: linear-gradient(135deg, #1a1a2e 0%, #2d1b69 100%);
}
.app-header.header-done {
  background: linear-gradient(135deg, #1a3a1a 0%, #2d5a2d 100%);
}

.header-content {
  max-width: 800px;
  margin: 0 auto;
}

.logo { font-size: 1.8rem; margin-bottom: 0.3rem; }
.logo-en { font-size: 0.9rem; font-weight: 400; opacity: 0.7; margin-left: 0.4rem; }

.subtitle { font-size: 0.85rem; opacity: 0.8; }

.app-main {
  max-width: 900px;
  margin: 0 auto;
  padding: 1.5rem 1rem;
}

/* 全局 AI 免责栏 */
.disclaimer-bar {
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 8px;
  padding: 0.6rem 1rem;
  margin-bottom: 1rem;
  font-size: 0.8rem;
  color: #856404;
  text-align: center;
  line-height: 1.5;
}
.d-break { display: none; }
@media (max-width: 480px) { .d-break { display: inline; } }

/* 页面切换动画 */
.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.page-fade-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
.page-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
