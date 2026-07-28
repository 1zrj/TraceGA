// Design Token — 间距体系（4px 基准栅格）

/** 4px 基准栅格 — 0 → 64px 共 11 级 */
export const scale = {
  0: '0px',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  7: '32px',
  8: '40px',
  9: '48px',
  10: '64px',
} as const

/** 语义间距 — 引用 scale 值 */
export const semantic = {
  /** 内容区 padding = 24px */
  contentPadding: scale[6],
  /** 卡片内 padding = 16px */
  cardPadding: scale[4],
  /** 表单项垂直间距 = 24px */
  formItemGap: scale[6],
  /** 按钮组间距 = 8px */
  buttonGap: scale[2],
  /** Tag 间距 = 8px */
  tagGap: scale[2],
  /** 页面 Section 间距 = 32px */
  sectionGap: scale[7],
} as const
