<template>
  <div class="report-view">
    <div class="card" v-if="report">
      <!-- 操作栏 -->
      <div class="action-bar">
        <el-button @click="$emit('back')" round>← 返回重新输入</el-button>
        <el-button v-if="isFailedReview" type="primary" round @click="$emit('retry')">🔄 重新评审</el-button>
        <el-button type="warning" round @click="downloadPDF">
          📄 下载PDF报告
        </el-button>
      </div>

      <!-- 报告内容 -->
      <div class="print-area">
        <!-- 封面区 -->
        <div class="print-cover">
          <h1 class="print-title">智评团 · AI 多Agent产品评审报告</h1>
          <p class="print-meta">生成时间：{{ now }}</p>
          <p class="print-meta">产品想法：{{ idea }}</p>
          <p class="print-warning" style="margin-top:2rem;color:#f56c6c;font-size:10pt;">
            ⚠️ 本报告由AI自动生成，仅供参考，请人工核实关键结论。
          </p>
        </div>

        <!-- 顶部综合评分 -->
        <div class="report-header">
          <div class="score-ring">
            <svg viewBox="0 0 120 120" class="ring-svg">
              <circle cx="60" cy="60" r="54" fill="none" stroke="#eee" stroke-width="8"/>
              <circle cx="60" cy="60" r="54" fill="none" :stroke="scoreColor" stroke-width="8"
                stroke-linecap="round" :stroke-dasharray="`${dashOffset} 339.3`"
                transform="rotate(-90, 60, 60)" class="score-arc"/>
            </svg>
            <div class="score-text">
              <div class="score-num">{{ report.overallScore }}</div>
              <div class="score-label">综合评分</div>
            </div>
          </div>
          <div class="header-info">
            <div class="overall-conclusion" :class="conclusionClass">{{ report.overallConclusion }}</div>
            <p class="summary">{{ report.summary }}</p>
          </div>
        </div>

        <!-- 各维度评分 -->
        <div class="sub-scores">
          <div class="sub-score-item" v-for="(score, key) in report.scores" :key="key">
            <div class="sub-label">{{ agentNames[key] || key }}</div>
            <div class="sub-value" :style="{ color: scoreColorFor(score) }">{{ score }}</div>
          </div>
        </div>

        <!-- 置信度图例 -->
        <div class="section legend-section">
          <h3>📖 置信度说明</h3>
          <div class="legend-items">
            <span class="legend-item"><span class="legend-badge" style="background:#e8f5e9;color:#2e7d32;">🟢 高</span> 有明确依据，可直接参考</span>
            <span class="legend-item"><span class="legend-badge" style="background:#fff3e0;color:#e65100;">🟠 推测</span> 有推测成分，建议人工核实</span>
            <span class="legend-item" v-if="lowCount > 0"><span class="legend-badge" style="background:#ffebee;color:#c62828;">🔴 已过滤 {{ lowCount }} 条</span> 无依据的发现已自动隐藏</span>
          </div>
        </div>

        <!-- 🔴 阻塞性问题（带置信度） -->
        <div class="section" v-if="report.blockingIssues?.length">
          <h3>🔴 阻塞性问题</h3>
          <div v-for="(item, i) in report.blockingIssues" :key="'b'+i" class="issue-row">
            <div class="issue-body">
              <div class="issue-header">
                <div class="issue-tag">{{ agentNames[item.agent] || item.agent }}</div>
                <span v-if="getConfidence('blocking', i) && getConfidence('blocking', i) !== 'low'" :class="'confidence-badge ' + 'confidence-' + getConfidence('blocking', i)">
                  {{ {high:'🟢高',medium:'🟠推测'}[getConfidence('blocking', i)] || '' }}
                </span>
                <button class="deepdive-btn" @click="openDeepDive('blocking', i, item)">🔍 深入分析</button>
              </div>
              <div class="issue-text">{{ item.issue }}</div>
              <div class="issue-suggestion">💡 {{ item.suggestion }}</div>
              <div class="issue-evidence" v-if="item.evidence">
                📎 依据：<em>{{ item.evidence }}</em>
              </div>
              <!-- 深度分析结果 -->
              <div v-if="ddState('b'+i)" class="deepdive-result">
                <div v-if="ddState('b'+i)!.loading" class="deepdive-loading">🔍 正在深入分析...</div>
                <div v-else-if="ddState('b'+i)!.error" class="deepdive-error">❌ {{ ddState('b'+i)!.error }}</div>
                <div v-else-if="ddState('b'+i)!.result" class="deepdive-content">
                  <div class="deepdive-question">💬 {{ ddState('b'+i)!.question }}</div>
                  <div class="deepdive-analysis" v-html="renderMarkdown(ddState('b'+i)!.result.analysis)"></div>
                  <div class="deepdive-conclusion"><strong>📌 结论：</strong>{{ ddState('b'+i)!.result.conclusion }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 🟠 改进建议（带置信度） -->
        <div class="section" v-if="report.improvements?.length">
          <h3>🟠 改进建议</h3>
          <div v-for="(item, i) in report.improvements" :key="'m'+i" class="issue-row">
            <div class="issue-body">
              <div class="issue-header">
                <div class="issue-tag">{{ agentNames[item.agent] || item.agent }}</div>
                <span v-if="getConfidence('improvement', i) && getConfidence('improvement', i) !== 'low'" :class="'confidence-badge ' + 'confidence-' + getConfidence('improvement', i)">
                  {{ {high:'🟢高',medium:'🟠推测'}[getConfidence('improvement', i)] || '' }}
                </span>
                <button class="deepdive-btn" @click="openDeepDive('improvement', i, item)">🔍 深入分析</button>
              </div>
              <div class="issue-text">{{ item.issue }}</div>
              <div class="issue-suggestion">💡 {{ item.suggestion }}</div>
              <div class="issue-evidence" v-if="item.evidence">
                📎 依据：<em>{{ item.evidence }}</em>
              </div>
              <!-- 深度分析结果 -->
              <div v-if="ddState('m'+i)" class="deepdive-result">
                <div v-if="ddState('m'+i)!.loading" class="deepdive-loading">🔍 正在深入分析...</div>
                <div v-else-if="ddState('m'+i)!.error" class="deepdive-error">❌ {{ ddState('m'+i)!.error }}</div>
                <div v-else-if="ddState('m'+i)!.result" class="deepdive-content">
                  <div class="deepdive-question">💬 {{ ddState('m'+i)!.question }}</div>
                  <div class="deepdive-analysis" v-html="renderMarkdown(ddState('m'+i)!.result.analysis)"></div>
                  <div class="deepdive-conclusion"><strong>📌 结论：</strong>{{ ddState('m'+i)!.result.conclusion }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 核心优势 -->
        <div class="section" v-if="report.overallStrengths?.length">
          <h3>✅ 核心优势</h3>
          <ul class="strengths-list">
            <li v-for="(s, i) in report.overallStrengths" :key="i">{{ s }}</li>
          </ul>
        </div>

        <!-- ⚡ Agent矛盾检测 -->
        <div class="section contradiction-section" v-if="report.contradictions?.length">
          <h3>⚡ Agent发现存在矛盾</h3>
          <div class="contra-warning">
            <p class="contra-desc">
              不同的Agent给出的评审结论存在冲突，<strong>建议人工确认后再做决策</strong>。
            </p>
            <div v-for="(c, i) in report.contradictions" :key="'c'+i" class="contra-item">
              <div class="contra-agents">{{ c.between?.join(' vs ') || 'Agent之间' }}</div>
              <div class="contra-detail">
                <div class="contra-item-a">观点A：{{ c.items?.[0] }}</div>
                <div class="contra-item-b">观点B：{{ c.items?.[1] }}</div>
              </div>
              <div class="contra-desc">{{ c.description }}</div>
              <div class="contra-sug">💡 {{ c.suggestion }}</div>
            </div>
          </div>
        </div>

        <!-- 各维度详情 -->
        <div class="section" v-if="report.detailReports">
          <h3>📋 各维度详情</h3>
          <div v-for="(summary, key) in report.detailReports" :key="key" class="detail-card">
            <div class="detail-title">{{ agentNames[key] || key }}</div>
            <p>{{ summary }}</p>
          </div>
        </div>
      </div>
    </div>

    <div class="empty-state" v-else>
      <p>暂无评审结果</p>
    </div>

    <!-- 回到顶部 -->
    <el-button v-if="showBackTop" class="back-top-btn" circle @click="scrollToTop" :icon="ArrowUp" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { ArrowUp } from '@element-plus/icons-vue'
import { AGENT_NAMES } from '../config/agents'

const props = defineProps<{ report: any; confidence?: any[]; idea?: string; context?: any; deepdiveFn?: (issue: any, question: string) => Promise<any> }>()
const emit = defineEmits<{ back: []; retry: [] }>()

const agentNames = AGENT_NAMES

const now = new Date().toLocaleString('zh-CN', {
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
})

function downloadPDF() {
  window.print()
}

// 回到顶部
const showBackTop = ref(false)
let scrollHandler: (() => void) | null = null
onMounted(() => {
  scrollHandler = () => { showBackTop.value = window.scrollY > 600 }
  window.addEventListener('scroll', scrollHandler, { passive: true })
})
onUnmounted(() => {
  if (scrollHandler) window.removeEventListener('scroll', scrollHandler)
})
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// 查找某条发现的置信度
function getConfidence(type: string, index: number | string): string {
  if (!props.confidence?.length) return ''
  const idx = Number(index)
  const found = props.confidence.find((c: any) => c.type === type && c.index === idx)
  return found?.confidence || ''
}

const scoreColor = computed(() => {
  const s = props.report?.overallScore || 0
  if (s >= 7) return '#67c23a'
  if (s >= 5) return '#e6a23c'
  return '#f56c6c'
})

const conclusionClass = computed(() => {
  const c = props.report?.overallConclusion || ''
  if (c.includes('通过')) return 'pass'
  return 'fail'
})

const dashOffset = computed(() => {
  const s = props.report?.overallScore || 0
  return 339.3 * (1 - s / 10)
})

function scoreColorFor(score: number) {
  if (score >= 7) return '#67c23a'
  if (score >= 5) return '#e6a23c'
  return '#f56c6c'
}

const lowCount = computed(() => {
  if (!props.confidence?.length) return 0
  return props.confidence.filter((c: any) => c.confidence === 'low').length
})

// 检查是否为失败评审
const isFailedReview = computed(() => {
  return props.report?.summary === 'AI未能生成有效评审，请重试'
})

// ===== 深度追问 =====
interface DeepDiveState { loading: boolean; result: any; error: string; question: string }
const deepDiveStates = ref<Record<string, DeepDiveState>>({})

function ddState(key: string): DeepDiveState | undefined {
  return deepDiveStates.value[key]
}

async function openDeepDive(listType: string, index: number | string, item: any) {
  const key = listType === 'blocking' ? 'b' + index : 'm' + index

  // 如果已展开，切换关闭
  const cur = ddState(key)
  if (cur) {
    delete deepDiveStates.value[key]
    return
  }

  // 弹出追问输入框
  const question = prompt('你想深入追问什么？', '能不能展开讲讲具体的实施步骤？')
  if (!question) return

  // 设为加载状态
  deepDiveStates.value[key] = { loading: true, result: null, error: '', question }

  try {
    if (!props.deepdiveFn) {
      deepDiveStates.value[key] = { loading: false, result: null, error: '深入分析功能不可用', question }
      return
    }
    const result = await props.deepdiveFn(item, question)
    if (result && result.error) {
      deepDiveStates.value[key] = { loading: false, result: null, error: result.error, question }
    } else if (result) {
      deepDiveStates.value[key] = { loading: false, result, error: '', question }
    }
  } catch (err: any) {
    deepDiveStates.value[key] = { loading: false, result: null, error: err.message || '分析失败', question }
  }
}

// 简易 markdown 渲染（支持换行、列表、加粗）
function renderMarkdown(text: string): string {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n/g, '<br/>')
}
</script>

<style scoped>
/* ===== 屏幕样式 ===== */
.card { background: white; border-radius: 12px; padding: 2rem; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }

.action-bar { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; }

/* 报告标题区 */
.report-header { display: flex; gap: 1.5rem; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; }
.score-ring { position: relative; width: 120px; height: 120px; flex-shrink: 0; }
.ring-svg { width: 100%; height: 100%; }
.score-arc { transition: stroke-dasharray 1s ease; }
.score-text { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.score-num { font-size: 2rem; font-weight: 700; }
.score-label { font-size: 0.75rem; color: #999; }
.header-info { flex: 1; min-width: 200px; }
.overall-conclusion { font-size: 1.2rem; font-weight: 700; margin-bottom: 0.3rem; }
.overall-conclusion.pass { color: #67c23a; }
.overall-conclusion.fail { color: #f56c6c; }
.summary { font-size: 0.9rem; color: #666; line-height: 1.5; }
.sub-scores { display: flex; gap: 1rem; margin-bottom: 1.5rem; }
.sub-score-item { flex: 1; text-align: center; padding: 0.8rem; background: #faf3ec; border-radius: 8px; }
.sub-label { font-size: 0.8rem; color: #999; margin-bottom: 0.3rem; }
.sub-value { font-size: 1.5rem; font-weight: 700; }

.section { margin-bottom: 1.5rem; }
.section h3 { font-size: 1.05rem; margin-bottom: 0.8rem; }

/* issue行 */
.issue-row { display: flex; align-items: flex-start; gap: 0.8rem; padding: 0.8rem; border: 1px solid #eee; border-radius: 8px; margin-bottom: 0.5rem; }
.issue-body { flex: 1; }
.issue-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.3rem; flex-wrap: wrap; }
.issue-tag { display: inline-block; background: #f0f2f5; padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.75rem; color: #666; }
.issue-text { font-size: 0.9rem; margin-bottom: 0.3rem; }
.issue-suggestion { font-size: 0.8rem; color: #409eff; }
.issue-evidence { font-size: 0.75rem; color: #888; margin-top: 0.3rem; padding: 0.4rem; background: #f9f9f9; border-radius: 4px; }
.issue-evidence em { font-style: italic; color: #666; }

/* 置信度徽章 */
.confidence-badge { font-size: 0.7rem; padding: 0.1rem 0.4rem; border-radius: 3px; white-space: nowrap; font-weight: 600; }
.confidence-high { background: #e8f5e9; color: #2e7d32; }
.confidence-medium { background: #fff3e0; color: #e65100; }
.confidence-low { background: #ffebee; color: #c62828; }

/* 深入分析按钮 */
.deepdive-btn {
  margin-left: auto;
  background: none;
  border: 1px solid #c9a84c;
  color: #c9a84c;
  border-radius: 4px;
  padding: 0.15rem 0.5rem;
  font-size: 0.7rem;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.deepdive-btn:hover {
  background: #c9a84c;
  color: white;
}

/* 深度分析结果 */
.deepdive-result {
  margin-top: 0.6rem;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 0.8rem;
  background: #fafafa;
}
.deepdive-loading {
  font-size: 0.85rem;
  color: #999;
  text-align: center;
  padding: 0.5rem;
}
.deepdive-error {
  font-size: 0.8rem;
  color: #f56c6c;
}
.deepdive-question {
  font-size: 0.8rem;
  color: #666;
  background: #f0f2f5;
  padding: 0.3rem 0.6rem;
  border-radius: 4px;
  margin-bottom: 0.5rem;
}
.deepdive-analysis {
  font-size: 0.85rem;
  line-height: 1.6;
  color: #333;
}
.deepdive-analysis ul { padding-left: 1.2rem; margin: 0.3rem 0; }
.deepdive-analysis li { font-size: 0.85rem; margin-bottom: 0.2rem; }
.deepdive-conclusion {
  margin-top: 0.5rem;
  font-size: 0.85rem;
  color: #c9a84c;
  padding-top: 0.5rem;
  border-top: 1px dashed #eee;
}

.strengths-list { list-style: none; }
.strengths-list li { padding: 0.4rem 0; padding-left: 1.2rem; position: relative; font-size: 0.9rem; }
.strengths-list li::before { content: '✓'; position: absolute; left: 0; color: #67c23a; }

.detail-card { padding: 1rem; background: #faf3ec; border-radius: 8px; margin-bottom: 1rem; }
.detail-title { font-weight: 600; font-size: 0.9rem; margin-bottom: 0.3rem; }
.detail-card p { font-size: 0.85rem; color: #666; line-height: 1.5; }

/* Agent矛盾检测 */
.contradiction-section { border: 2px solid #f56c6c; border-radius: 10px; padding: 1rem; margin-bottom: 1.5rem; background: #fff5f5; }
.contradiction-section h3 { color: #c62828; margin-bottom: 0.5rem; }
.contra-warning { font-size: 0.85rem; }
.contra-desc { color: #666; margin-bottom: 0.8rem; }
.contra-item { background: white; border: 1px solid #ffcdd2; border-radius: 8px; padding: 0.8rem; margin-bottom: 0.5rem; }
.contra-agents { font-weight: 600; color: #c62828; margin-bottom: 0.4rem; font-size: 0.8rem; }
.contra-item-a, .contra-item-b { font-size: 0.85rem; padding: 0.3rem 0; padding-left: 0.5rem; border-left: 3px solid; margin-bottom: 0.2rem; }
.contra-item-a { border-color: #67c23a; }
.contra-item-b { border-color: #f56c6c; }
.contra-desc { font-size: 0.8rem; color: #888; margin-top: 0.3rem; }
.contra-sug { font-size: 0.8rem; color: #f56c6c; margin-top: 0.3rem; }

.empty-state { text-align: center; padding: 3rem; color: #999; }

/* 回到顶部按钮 */
.back-top-btn {
  position: fixed !important;
  bottom: 2rem;
  right: 1.5rem;
  z-index: 100;
  background: #c9a84c !important;
  color: white !important;
  border: none !important;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}
.back-top-btn:hover { background: #b8963e !important; }

/* ===== 打印样式 ===== */
@media print {
  .action-bar { display: none !important; }
  .contradiction-section { display: none !important; }
  .empty-state { display: none; }

  @page { size: A4; margin: 20mm 15mm; }

  body { background: white; color: #333; font-size: 11pt; line-height: 1.6; }

  .card { box-shadow: none; padding: 0; border-radius: 0; max-width: 100%; }

  .print-cover {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    min-height: 60vh; text-align: center; page-break-after: always;
  }
  .print-title { font-size: 24pt; font-weight: 700; color: #1a1a2e; margin-bottom: 1.5rem; }
  .print-meta { font-size: 10pt; color: #666; margin-bottom: 0.3rem; }

  .report-header { page-break-inside: avoid; }
  .sub-scores { page-break-inside: avoid; }
  .section { page-break-inside: avoid; }
  .section h3 { border-bottom: 2px solid #1a1a2e; padding-bottom: 4px; margin-top: 1.5rem; }

  .score-ring { width: 100px; height: 100px; }
  .score-num { font-size: 1.8rem; }
  .sub-value { font-size: 1.3rem; }
  .summary { font-size: 10pt; color: #444; }
  .issue-text { font-size: 10pt; }
  .issue-suggestion { font-size: 9pt; }
  .issue-evidence { font-size: 8pt; }
  .detail-card { break-inside: avoid; background: #f5f5f5; border: 1px solid #ddd; }
  .detail-card p { font-size: 10pt; }
  .strengths-list li { font-size: 10pt; }
  .issue-row { break-inside: avoid; }

  :deep(.el-button) { display: none !important; }
  .deepdive-btn { display: none !important; }
  .deepdive-result {
    border: 1px solid #ccc !important;
    background: #f9f9f9 !important;
    page-break-inside: avoid;
  }
}

/* 置信度图例 */
.legend-section { border: 1px solid #e8e8e8; border-radius: 8px; padding: 0.8rem 1rem; background: #fafafa; }
.legend-section h3 { font-size: 0.85rem; margin-bottom: 0.5rem; color: #666; }
.legend-items { display: flex; flex-wrap: wrap; gap: 0.8rem; }
.legend-item { font-size: 0.8rem; color: #555; display: flex; align-items: center; gap: 0.3rem; }
.legend-badge { font-weight: 600; font-size: 0.75rem; padding: 0.1rem 0.4rem; border-radius: 3px; white-space: nowrap; }
</style>
