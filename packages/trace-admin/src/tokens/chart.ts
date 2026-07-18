// Design Token — 图表色板


/** 10 色分类色板 — 饼图 / 柱状图 */
export const dataPalette10 = [
  '#1677ff',
  '#52c41a',
  '#faad14',
  '#f5222d',
  '#722ed1',
  '#13c2c2',
  '#eb2f96',
  '#fa8c16',
  '#2f54eb',
  '#a0d911',
] as const

/** 顺序色板（蓝）— 热力图 / 连续数值渐变 */
export const sequentialBlue = [
  '#e6f4ff',
  '#91caff',
  '#4096ff',
  '#1677ff',
  '#0958d9',
  '#002c8c',
] as const

/** 发散色板 — 正负值对比 */
export const diverging = [
  '#0958d9',
  '#69b1ff',
  '#e6f4ff',
  '#fff1f0',
  '#ff7875',
  '#cf1322',
] as const

/** 状态标签色值映射 — bg / text / border 三色组合 */
export const statusTags = {
  active: {
    bg: '#f6ffed',
    text: '#389e0d',
    border: '#b7eb8f',
  },
  testing: {
    bg: '#e6f4ff',
    text: '#0958d9',
    border: '#91caff',
  },
  inactive: {
    bg: '#f5f5f5',
    text: '#8c8c8c',
    border: '#d9d9d9',
  },
  error: {
    bg: '#fff1f0',
    text: '#cf1322',
    border: '#ffa39e',
  },
  warning: {
    bg: '#fffbe6',
    text: '#d48806',
    border: '#ffe58f',
  },
} as const
