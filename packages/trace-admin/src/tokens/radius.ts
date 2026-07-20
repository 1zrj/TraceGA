// Design Token — 圆角体系

/** 基础圆角等级 */
export const radius = {
  none: '0px',
  xs: '2px',
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  pill: '9999px',
  full: '50%',
} as const

// ─── B/C 端组件级圆角映射 ────────────────────────────────────

/** B 端圆角映射 — 紧凑、小圆角 */
export const bRadius = {
  button: radius.sm, // 4px
  input: radius.sm, // 4px
  select: radius.sm, // 4px
  card: radius.md, // 6px
  modal: radius.lg, // 8px
  tag: radius.xs, // 2px
} as const

/** C 端圆角映射 — 宽松、大圆角 */
export const cRadius = {
  button: radius.lg, // 8px
  input: radius.lg, // 8px
  select: radius.lg, // 8px
  card: radius.lg, // 8px
  modal: radius.xl, // 12px
  tag: radius.sm, // 4px
} as const
