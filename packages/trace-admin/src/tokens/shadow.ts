// Design Token — 阴影体系


export const boxShadow = {
  /** 卡片默认 — 轻微浮起 */
  sm: '0 1px 2px 0 rgba(0,0,0,0.03), 0 1px 6px -1px rgba(0,0,0,0.02), 0 2px 4px 0 rgba(0,0,0,0.02)',
  /** 下拉菜单 / Popover — 中层浮起 */
  md: '0 6px 16px 0 rgba(0,0,0,0.08), 0 3px 6px -4px rgba(0,0,0,0.06), 0 9px 28px 8px rgba(0,0,0,0.05)',
  /** 模态框 / 抽屉 — 最高层浮起 */
  lg: '0 12px 40px 0 rgba(0,0,0,0.12), 0 6px 16px -8px rgba(0,0,0,0.08)',
} as const
