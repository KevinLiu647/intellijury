// Agent 名称映射表（前端共享配置）
export const AGENT_NAMES: Record<string, string> = {
  product: '产品架构',
  pricing: '商业模式',
  tech: '技术可行性',
}

export const AGENT_LIST = [
  { key: 'product', name: AGENT_NAMES.product },
  { key: 'pricing', name: AGENT_NAMES.pricing },
  { key: 'tech', name: AGENT_NAMES.tech },
]
