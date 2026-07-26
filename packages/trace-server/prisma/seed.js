/**
 * 种子数据脚本
 *
 * 职责：
 *   - 创建默认管理员账号（首次运行）
 *   - 插入模拟事件日志数据（让看板有数据可看）
 *
 * 运行：node prisma/seed.js
 * 前置条件：npx prisma db push 已执行，数据库表已创建
 */
require('dotenv/config')

const mariadb = require('mariadb')
const bcrypt = require('bcrypt')

// ── 数据库连接 ──────────────────────────────────────────────

const url = new URL(process.env.DATABASE_URL || 'mysql://root:root@localhost:3306/tracega')

function getConnection() {
  return mariadb.createConnection({
    host: url.hostname,
    port: Number(url.port) || 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, '') || 'tracega',
  })
}

// ── 模拟事件生成配置 ────────────────────────────────────────

const PROJECT_ID = 'trace-app'

const EVENT_DEFINITIONS = [
  { event_name: 'page_view', event_type: 'page_view', event_desc: '页面浏览' },
  { event_name: 'button_click', event_type: 'click', event_desc: '按钮点击' },
  { event_name: 'form_submit', event_type: 'form_submit', event_desc: '表单提交' },
  { event_name: 'api_call', event_type: 'custom', event_desc: 'API 调用' },
  { event_name: 'scroll_depth', event_type: 'scroll', event_desc: '页面滚动深度' },
]

const PAGE_URLS = ['/', '/dashboard', '/event-management', '/profile', '/login']
const UIDS = ['u-10001', 'u-10002', 'u-10003', 'u-10004', 'u-10005']
const SESSION_IDS = ['s-20001', 's-20002', 's-20003', 's-20004', 's-20005']
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/17.2',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2) AppleWebKit/605.1.15 Mobile/15E148',
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile',
]
const IPS = ['192.168.1.100', '10.0.0.50', '172.16.0.10', '203.0.113.42']

/**
 * 生成分布于过去 N 天内的模拟事件日志
 */
function generateEvents(count) {
  const now = Date.now()
  const DAY_MS = 86400000
  const events = []

  for (let i = 0; i < count; i++) {
    const def = EVENT_DEFINITIONS[Math.floor(Math.random() * EVENT_DEFINITIONS.length)]
    const uid = UIDS[Math.floor(Math.random() * UIDS.length)]
    const sessionId = SESSION_IDS[Math.floor(Math.random() * SESSION_IDS.length)]
    const pageUrl = PAGE_URLS[Math.floor(Math.random() * PAGE_URLS.length)]
    const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
    const ip = IPS[Math.floor(Math.random() * IPS.length)]

    // 随机偏移：过去 30 天内
    const daysAgo = Math.floor(Math.random() * 30)
    const hoursOffset = Math.floor(Math.random() * 24)
    const minutesOffset = Math.floor(Math.random() * 60)
    const occurredAt = new Date(now - daysAgo * DAY_MS - hoursOffset * 3600000 - minutesOffset * 60000)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ')

    // 为部分事件生成额外参数
    let eventParams = null
    if (def.event_type === 'click') {
      eventParams = JSON.stringify({ button_id: ['btn-submit', 'btn-cancel', 'btn-search', 'btn-export'][Math.floor(Math.random() * 4)] })
    } else if (def.event_type === 'form_submit') {
      eventParams = JSON.stringify({ form_id: 'contact-form', fields_count: Math.floor(Math.random() * 5) + 1 })
    } else if (def.event_name === 'scroll_depth') {
      eventParams = JSON.stringify({ depth_percent: [25, 50, 75, 100][Math.floor(Math.random() * 4)] })
    } else if (def.event_name === 'api_call') {
      eventParams = JSON.stringify({ endpoint: '/api/analysis/summary', duration_ms: Math.floor(Math.random() * 500) + 50 })
    }

    events.push([
      PROJECT_ID,
      def.event_name,
      def.event_type,
      occurredAt,
      uid,
      sessionId,
      pageUrl,
      eventParams,
      userAgent,
      ip,
    ])
  }

  return events
}

// ── 主流程 ──────────────────────────────────────────────────

async function main() {
  const conn = await getConnection()

  try {
    // ── 1. 插入 / 检查 project ─────────────────────────────
    const existingProject = await conn.query('SELECT id FROM project WHERE project_id = ?', [PROJECT_ID])
    if (existingProject.length === 0) {
      await conn.query(
        'INSERT INTO project (project_id, project_name, owner, created_at) VALUES (?, ?, ?, NOW())',
        [PROJECT_ID, 'TraceGA Demo', 'admin'],
      )
      console.log(`项目 ${PROJECT_ID} 创建成功`)
    } else {
      console.log(`项目 ${PROJECT_ID} 已存在，跳过`)
    }

    // ── 2. 插入 / 检查 event_definition ────────────────────
    for (const def of EVENT_DEFINITIONS) {
      const existing = await conn.query(
        'SELECT id FROM event_definition WHERE project_id = ? AND event_name = ?',
        [PROJECT_ID, def.event_name],
      )
      if (existing.length === 0) {
        await conn.query(
          'INSERT INTO event_definition (project_id, event_name, event_type, event_desc, status, created_at, updated_at) VALUES (?, ?, ?, ?, 1, NOW(), NOW())',
          [PROJECT_ID, def.event_name, def.event_type, def.event_desc],
        )
      }
    }
    console.log('事件定义同步完成')

    // ── 3. 插入模拟事件日志 ────────────────────────────────
    const existingLogs = await conn.query('SELECT COUNT(*) as cnt FROM event_log')
    if (existingLogs[0].cnt > 50) {
      console.log(`已存在 ${existingLogs[0].cnt} 条事件日志，跳过模拟数据插入`)
    } else {
      // 如果已有但不足 50 条，先清空再重新插入
      if (existingLogs[0].cnt > 0) {
        await conn.query('DELETE FROM event_log')
        console.log('已清空旧事件日志')
      }

      const events = generateEvents(80)
      const batchSize = 20

      for (let i = 0; i < events.length; i += batchSize) {
        const batch = events.slice(i, i + batchSize)
        const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')
        const values = batch.flat()

        await conn.query(
          `INSERT INTO event_log (project_id, event_name, event_type, occurred_at, uid, session_id, page_url, event_params, user_agent, ip) VALUES ${placeholders}`,
          values,
        )
      }
      console.log(`插入 ${events.length} 条模拟事件日志成功`)
    }

    // ── 4. 创建默认 admin 用户 ──────────────────────────────
    const existingUser = await conn.query('SELECT id FROM user WHERE username = ?', ['admin'])
    if (existingUser.length === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10)
      await conn.query(
        'INSERT INTO user (username, password, name, email, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
        ['admin', hashedPassword, 'Admin', 'admin@tracega.com', 'admin'],
      )
      console.log('默认 admin 用户创建成功（密码: admin123）')
    } else {
      console.log('admin 用户已存在，跳过创建')
    }

    console.log('\n✓ 种子数据初始化完成！')
  } finally {
    await conn.end()
  }
}

main().catch((e) => {
  console.error('种子数据初始化失败:', e)
  process.exit(1)
})
