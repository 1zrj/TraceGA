// Design Token — 色彩体系

// ─── Primitive 原色色板 ────────────────────────────────────────

const blue = {
  1: '#e6f4ff',
  2: '#bae0ff',
  3: '#91caff',
  4: '#69b1ff',
  5: '#4096ff', // hover 态
  6: '#1677ff', // 主色
  7: '#0958d9', // active 态
  8: '#003eb3',
  9: '#002c8c',
  10: '#001d66',
} as const

const gray = {
  1: '#ffffff', // 纯白
  2: '#fafafa',
  3: '#f5f5f5', // 页面底色
  4: '#f0f0f0',
  5: '#d9d9d9', // 默认边框 / 禁用文字
  6: '#bfbfbf',
  7: '#8c8c8c', // 辅助文字 / placeholder
  8: '#595959', // 次要文字
  9: '#434343',
  10: '#262626', // 正文
} as const

const green = {
  1: '#f6ffed',
  2: '#d9f7be',
  3: '#b7eb8f', // 状态标签边框
  4: '#95de64',
  5: '#73d13d',
  6: '#52c41a', // 主色 — 成功
  7: '#389e0d', // 状态标签文字
  8: '#237804',
  9: '#135200',
  10: '#092b00',
} as const

const orange = {
  1: '#fffbe6',
  2: '#fff1b8',
  3: '#ffe58f', // 状态标签边框
  4: '#ffd666',
  5: '#ffc53d',
  6: '#faad14', // 主色 — 警告
  7: '#d48806', // 状态标签文字
  8: '#ad6800',
  9: '#874d00',
  10: '#613400',
} as const

const red = {
  1: '#fff1f0',
  2: '#ffccc7',
  3: '#ffa39e', // 状态标签边框
  4: '#ff7875',
  5: '#ff4d4f', // 错误边框
  6: '#f5222d', // 主色 — 危险
  7: '#cf1322', // 状态标签文字
  8: '#a8071a',
  9: '#820014',
  10: '#5c0011',
} as const

// ─── Semantic 语义色 ───────────────────────────────────────────

export const colors = {
  /** Primitive 原色色板 */
  primitive: {
    blue,
    gray,
    green,
    orange,
    red,
  },

  /** 语义化色彩引用 */
  semantic: {
    brand: {
      colorPrimary: blue[6],
      colorPrimaryHover: blue[5],
      colorPrimaryActive: blue[7],
    },
    bg: {
      colorBgLayout: gray[3],
      colorBgContainer: gray[1],
      colorBgElevated: gray[1],
    },
    text: {
      colorText: gray[10],
      colorTextSecondary: gray[8],
      colorTextTertiary: gray[7],
      colorTextDisabled: gray[5],
    },
    border: {
      colorBorder: gray[5],
      colorBorderHover: blue[5],
      colorBorderError: red[5],
    },
    status: {
      colorSuccess: green[6],
      colorWarning: orange[6],
      colorError: red[6],
    },
    link: {
      colorLink: blue[6],
      colorLinkHover: blue[5],
    },
  },
} as const
