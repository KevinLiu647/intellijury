<template>
  <div class="progress-view">
    <div class="card">
      <h2 class="card-title">⚙️ 评审进行中</h2>
      <p class="card-desc">{{ status }}</p>

      <div class="agents-grid">
        <div
          v-for="agent in visibleAgents"
          :key="agent.key"
          class="agent-card"
          :class="agent.status"
        >
          <div class="agent-icon">
            <span v-if="agent.status === 'waiting'">⏳</span>
            <span v-else-if="agent.status === 'running'" class="spinner">🔄</span>
            <span v-else-if="agent.status === 'done'">✅</span>
            <span v-else-if="agent.status === 'error'">❌</span>
          </div>

          <div class="agent-info">
            <div class="agent-name">{{ agent.name }}</div>
            <div class="agent-status-text">
              <template v-if="agent.status === 'waiting'">等待中</template>
              <template v-else-if="agent.status === 'running'">分析中...</template>
              <template v-else-if="agent.status === 'done'">已完成</template>
              <template v-else-if="agent.status === 'error'">{{ agent.error }}</template>
            </div>
          </div>

          <div class="agent-progress-bar">
            <div
              class="progress-fill"
              :class="agent.status"
            />
          </div>
        </div>
      </div>

      <div class="synthesizer-status" v-if="showSynthesizer">
        <div class="synthesizer-info">
          <span class="spinner">🔄</span>
          <span>Synthesizer 正在合并评审结果...</span>
        </div>
      </div>

      <!-- 停止按钮：连接正常时显示 -->
      <div class="stop-bar" v-if="!isError">
        <el-button
          type="danger"
          plain
          round
          @click="$emit('cancel')"
          :disabled="allDone"
        >
          ⏹ 停止评审
        </el-button>
      </div>

      <!-- 错误恢复：连接失败时显示 -->
      <div class="stop-bar" v-else>
        <div class="error-actions">
          <el-button type="primary" round @click="$emit('retry')">
            🔄 重新评审
          </el-button>
          <el-button round @click="$emit('back')">
            ← 返回修改
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  status: string
  agents: Array<{ key: string; name: string; status: string; result?: any; error?: string }>
  analysis: any
}>()

const emit = defineEmits<{ report: []; cancel: []; retry: []; back: [] }>()

const isError = computed(() => props.status.includes('❌'))

// 只显示Supervisor指定的Agent（如果已分配），否则全显示
const visibleAgents = computed(() => {
  const allowed = props.analysis?.agentsToRun
  if (!allowed?.length) return props.agents
  return props.agents.filter(a => allowed.includes(a.key))
})

const allDone = computed(() => visibleAgents.value.every(a => a.status === 'done' || a.status === 'error'))

const showSynthesizer = computed(() => {
  return visibleAgents.value.every(a => a.status === 'done') && !props.status.includes('Skeptic')
})
</script>

<style scoped>
.card {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
}

.card-title { font-size: 1.4rem; margin-bottom: 0.3rem; }
.card-desc { color: #666; font-size: 0.9rem; margin-bottom: 1.5rem; }

.agents-grid { display: flex; flex-direction: column; gap: 1rem; }

.agent-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.2rem;
  border-radius: 10px;
  border: 2px solid #eee;
  transition: all 0.3s ease;
}

.agent-card.running {
  border-color: #c9a84c;
  background: #fffdf5;
}

.agent-card.done {
  border-color: #67c23a;
  background: #f0f9eb;
}

.agent-card.error {
  border-color: #f56c6c;
  background: #fef0f0;
}

.agent-icon { font-size: 1.5rem; width: 2rem; text-align: center; }

.agent-info { flex: 1; }
.agent-name { font-weight: 600; font-size: 0.95rem; }
.agent-status-text { font-size: 0.8rem; color: #999; }

.agent-progress-bar {
  width: 80px;
  height: 6px;
  background: #eee;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  transition: width 0.5s ease;
}

.progress-fill.waiting { width: 0; }
.progress-fill.running { width: 60%; background: #c9a84c; animation: pulse 1s infinite; }
.progress-fill.done { width: 100%; background: #67c23a; }
.progress-fill.error { width: 100%; background: #f56c6c; }

@keyframes pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

.spinner { display: inline-block; animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.synthesizer-status { margin-top: 1.5rem; padding: 1rem; background: #f0f5ff; border-radius: 8px; }
.synthesizer-info { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; color: #409eff; }

.stop-bar { text-align: center; margin-top: 1.5rem; }
</style>
