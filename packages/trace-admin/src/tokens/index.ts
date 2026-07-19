// Design Token — 统一导出入口
// 使用示例：
//   import { colors, fontFamily, fontSize, scale, radius, boxShadow, variants } from '@/tokens'
//   B/C 端差异化变量从 variants 获取：variants.b.controlHeight / variants.c.fontSize

export { colors } from './colors'
export {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  presets,
} from './typography'
export { scale, semantic } from './spacing'
export { radius, bRadius, cRadius } from './radius'
export { boxShadow } from './shadow'
export { zIndex } from './zIndex'
export { dataPalette10, sequentialBlue, diverging, statusTags } from './chart'
export { variants, bVariant, cVariant } from './variants'
export type { Variant } from './variants'
