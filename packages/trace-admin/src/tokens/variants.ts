// Design Token — B / C 端差异化变量

export type Variant = 'b' | 'c'

/** B 端（运营后台）— 紧凑、高效、信息密度高 */
export const bVariant = {
  fontSize: '14px',
  borderRadius: '6px',
  controlHeight: '32px',
  buttonBorderRadius: '4px',
  modalBorderRadiusLG: '8px',
  modalTitleFontSize: '18px',
  tableCellPaddingBlock: '12px',
  tableCellPaddingInline: '16px',
} as const

/** C 端（客户看板）— 宽松、友好、视觉引导强 */
export const cVariant = {
  fontSize: '16px',
  borderRadius: '8px',
  controlHeight: '40px',
  buttonBorderRadius: '8px',
  modalBorderRadiusLG: '12px',
  modalTitleFontSize: '20px',
  tableCellPaddingBlock: '16px',
  tableCellPaddingInline: '24px',
} as const

export const variants = {
  b: bVariant,
  c: cVariant,
} as const
