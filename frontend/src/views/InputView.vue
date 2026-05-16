<template>
  <div class="input-view">
    <div class="card">
      <h2 class="card-title">💡 输入产品想法</h2>
      <p class="card-desc">描述你的产品想法，AI Agent 团队将从三个维度并行评审</p>

      <el-input
        v-model="idea"
        type="textarea"
        :rows="6"
        placeholder="例如：我想做一个面向1-3人中小卖家的AI客服，149元/月，支持多模态识别和上下文订单查询..."
        maxlength="3000"
        show-word-limit
      />

      <!-- 折叠式结构化字段 -->
      <div class="context-fields">
        <div class="context-toggle" @click="showContext = !showContext">
          <span>📋 补充背景信息</span>
          <span class="toggle-arrow" :class="{ open: showContext }">▾</span>
          <span class="context-hint" v-if="!showContext && hasContext">（已填写 {{ contextCount }} 项）</span>
        </div>
        <Transition name="context-slide">
          <div v-if="showContext" class="context-form">
            <div class="field-row">
              <div class="field-group">
                <label>技术栈</label>
                <input v-model="ctx.techStack" placeholder="如: Vue3 + Node.js + MySQL" class="ctx-input" />
              </div>
              <div class="field-group">
                <label>团队规模（人数）</label>
                <input v-model.number="ctx.teamSize" type="number" inputmode="numeric" min="1" max="999" placeholder="2" class="ctx-input ctx-input-num" />
              </div>
            </div>
            <div class="field-row">
              <div class="field-group">
                <label>开发周期</label>
                <div class="field-combo">
                  <input v-model.number="ctx.devCycleNum" type="number" inputmode="numeric" min="1" max="999" placeholder="3" class="ctx-input ctx-input-num ctx-input-sm" />
                  <select v-model="ctx.devCycleUnit" class="ctx-select">
                    <option value="月">月</option>
                    <option value="天">天</option>
                  </select>
                </div>
              </div>
              <div class="field-group">
                <label>预算（元）</label>
                <input v-model.number="ctx.budgetRange" type="number" inputmode="numeric" min="0" step="10000" placeholder="50000" class="ctx-input ctx-input-num" />
              </div>
            </div>
            <div class="field-row">
              <div class="field-group full-width">
                <label>已有产品/数据</label>
                <input v-model="ctx.existingProduct" placeholder="如: 已有小程序MVP, 已积累1000用户数据" class="ctx-input" />
              </div>
            </div>
          </div>
        </Transition>
      </div>

      <div class="features-banner">
        <span class="feature">🤖 并行 multi-agent</span>
        <span class="feature">📊 结构化输出</span>
        <span class="feature">⚡ 实时状态推送</span>
      </div>

      <el-button
        type="primary"
        size="large"
        :disabled="!idea.trim() || loading"
        :loading="loading"
        @click="handleStart"
        class="start-btn"
      >
        🚀 开始评审
      </el-button>
    </div>

    <div class="examples">
      <h3>试试这些例子：</h3>
      <div class="example-chips">
        <el-tag
          v-for="(ex, i) in examples"
          :key="i"
          @click="idea = ex"
          class="example-tag"
        >
          {{ ex.slice(0, 40) }}...
        </el-tag>
      </div>
    </div>

    <!-- 历史评审 -->
    <div class="history-section" v-if="history && history.length > 0">
      <h3>📋 最近评审</h3>
      <div
        v-for="(item, i) in (history as any[])"
        :key="i"
        class="history-item"
        @click="$emit('start', item.idea, item.context)"
      >
        <span class="history-idea">{{ item.idea.slice(0, 30) }}{{ item.idea.length > 30 ? '...' : '' }}</span>
        <span class="history-meta">{{ item.time }} · {{ item.score }}分</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const emit = defineEmits<{ start: [idea: string, context?: any] }>()

const props = defineProps<{ history?: Array<{ idea: string; context?: any; time: string; score: number }> }>()

const idea = ref('')
const loading = ref(false)
const showContext = ref(true)

interface ContextFields {
  techStack: string
  teamSize: number | null
  devCycleNum: number | null
  devCycleUnit: string
  budgetRange: number | null
  existingProduct: string
}

const ctx = ref<ContextFields>({
  techStack: '',
  teamSize: null,
  devCycleNum: null,
  devCycleUnit: '月',
  budgetRange: null,
  existingProduct: '',
})

const contextCount = computed(() => {
  let n = 0
  if (ctx.value.techStack.trim()) n++
  if (ctx.value.teamSize) n++
  if (ctx.value.devCycleNum) n++
  if (ctx.value.budgetRange) n++
  if (ctx.value.existingProduct.trim()) n++
  return n
})

const hasContext = computed(() => contextCount.value > 0)

const examples = [
  '做一个面向1-3人中小卖家的AI客服，149元/月，对接抖音/淘宝/拼多多，自动回复+多模态图片识别+Knowledge retrieval',
  '做一个个人知识库RAG工具，上传PDF/MD后自然语言问答，自部署在2C2G服务器上，对标Notion AI但更便宜',
  '做一个多Agent代码库审计工具，给GitHub仓库地址自动分析代码质量、安全漏洞、架构合理性',
]

function handleStart() {
  if (!idea.value.trim()) return
  loading.value = true
  // 构建context对象，只传非空字段
  const context: Record<string, any> = {}
  if (ctx.value.techStack.trim()) context.techStack = ctx.value.techStack.trim()
  if (ctx.value.teamSize) context.teamSize = ctx.value.teamSize
  if (ctx.value.devCycleNum) context.devCycle = `${ctx.value.devCycleNum}${ctx.value.devCycleUnit}`
  if (ctx.value.budgetRange) context.budgetRange = ctx.value.budgetRange
  if (ctx.value.existingProduct.trim()) context.existingProduct = ctx.value.existingProduct.trim()
  emit('start', idea.value, Object.keys(context).length > 0 ? context : undefined)
}
</script>

<style scoped>
.card {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
}

.card-title { font-size: 1.4rem; margin-bottom: 0.5rem; }
.card-desc { color: #666; margin-bottom: 1rem; font-size: 0.9rem; }

/* 结构化字段 */
.context-fields { margin-bottom: 1rem; }
.context-toggle {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
  font-size: 0.85rem;
  color: #409eff;
  padding: 0.4rem 0;
  user-select: none;
}
.context-toggle:hover { color: #66b1ff; }
.toggle-arrow { transition: transform 0.2s; font-size: 0.7rem; }
.toggle-arrow.open { transform: rotate(180deg); }
.context-hint { color: #999; font-size: 0.75rem; }

.context-form {
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 0.8rem;
  margin-top: 0.3rem;
  background: #fafafa;
}
.field-row {
  display: flex;
  gap: 0.8rem;
  margin-bottom: 0.6rem;
}
.field-row:last-child { margin-bottom: 0; }
.field-group { flex: 1; }
.field-group label {
  display: block;
  font-size: 0.75rem;
  color: #666;
  margin-bottom: 0.2rem;
}
.field-group.full-width { flex: none; width: 100%; }

/* 原生输入框（防iOS自动缩放） */
.ctx-input {
  width: 100%;
  padding: 0.5rem 0.6rem;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 16px;
  line-height: 1.4;
  color: #333;
  background: white;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}
.ctx-input:focus { border-color: #c9a84c; }
.ctx-input::placeholder { color: #bbb; font-size: 14px; }
.ctx-input-num { max-width: 100%; }
.ctx-input-sm { flex: 1; min-width: 0; }

/* 组合字段（数字+单位） */
.field-combo { display: flex; gap: 0.3rem; align-items: stretch; }
.ctx-select {
  padding: 0.5rem 0.4rem;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 16px;
  background: white;
  color: #333;
  outline: none;
  cursor: pointer;
  flex-shrink: 0;
}
.ctx-select:focus { border-color: #c9a84c; }

.context-slide-enter-active,
.context-slide-leave-active {
  transition: all 0.25s ease;
  overflow: hidden;
}
.context-slide-enter-from,
.context-slide-leave-to {
  opacity: 0;
  max-height: 0;
  transform: translateY(-8px);
}

.features-banner {
  display: flex;
  gap: 1rem;
  margin: 1rem 0;
  justify-content: center;
}
.feature { font-size: 0.85rem; color: #666; }

.start-btn {
  display: block;
  width: 100%;
  margin-top: 1rem;
  background: #c9a84c;
  border-color: #c9a84c;
  font-size: 1.1rem;
  padding: 0.8rem;
}
.start-btn:hover { background: #b8963e; border-color: #b8963e; }

.examples { margin-top: 2rem; }
.examples h3 { font-size: 0.95rem; color: #666; margin-bottom: 0.8rem; }

.example-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
@media (max-width: 480px) {
  .example-chips {
    flex-wrap: nowrap;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    padding-bottom: 0.5rem;
    scrollbar-width: none;
  }
  .example-chips::-webkit-scrollbar { display: none; }
}
.example-tag { cursor: pointer; flex-shrink: 0; }

/* 历史评审 */
.history-section { margin-top: 1.5rem; }
.history-section h3 { font-size: 0.95rem; color: #666; margin-bottom: 0.6rem; }
.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.6rem 0.8rem;
  border: 1px solid #eee;
  border-radius: 8px;
  margin-bottom: 0.4rem;
  cursor: pointer;
  transition: background 0.15s;
  font-size: 0.85rem;
}
.history-item:hover { background: #faf3ec; }
.history-idea { color: #333; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.history-meta { color: #999; font-size: 0.75rem; white-space: nowrap; margin-left: 0.5rem; }
</style>
