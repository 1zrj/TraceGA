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
const bcrypt = require('bcryptjs')

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
  // 漏斗图相关事件：事件名称与前端漏斗五步映射
  { event_name: '用户注册', event_type: 'custom', event_desc: '用户注册' },
  { event_name: '用户登录', event_type: 'custom', event_desc: '用户登录' },
  { event_name: '商品浏览', event_type: 'page_view', event_desc: '商品浏览' },
  { event_name: '添加购物车', event_type: 'click', event_desc: '添加购物车' },
  { event_name: '订单完成', event_type: 'form_submit', event_desc: '订单完成' },
]

const ERROR_TYPES = ['js-error', 'promise-error', 'resource-error', 'http-error']
const ERROR_MESSAGES = [
  'Uncaught TypeError: Cannot read properties of undefined',
  'Unhandled Promise Rejection: Network request failed',
  'Failed to load resource: /static/js/chunk-3a2b.js',
  'HTTP 500 Internal Server Error at /api/analytics/event-trend',
  'ReferenceError: $ is not defined',
  'SyntaxError: Unexpected token < in JSON at position 0',
  'RangeError: Maximum call stack size exceeded',
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
 * @param {number} normalCount 普通事件数量
 * @param {number} errorCount  错误事件数量
 */
/**
 * 在一天内的事件密度分布：上午较少、下午高峰、晚上中等
 */
function getTimeDistribution() {
  const r = Math.random()
  if (r < 0.15) return 7 + Math.random() * 2          // 07:00-09:00 上午少
  if (r < 0.35) return 9 + Math.random() * 3           // 09:00-12:00 上午中
  if (r < 0.70) return 14 + Math.random() * 4          // 14:00-18:00 下午高峰
  return 19 + Math.random() * 4                         // 19:00-23:00 晚上中
}

function generateEvents(normalCount, errorCount) {
  const now = Date.now()
  const DAY_MS = 86400000
  const events = []

  for (let i = 0; i < normalCount; i++) {
    const def = EVENT_DEFINITIONS[Math.floor(Math.random() * EVENT_DEFINITIONS.length)]
    const uid = UIDS[Math.floor(Math.random() * UIDS.length)]
    const sessionId = SESSION_IDS[Math.floor(Math.random() * SESSION_IDS.length)]
    const pageUrl = PAGE_URLS[Math.floor(Math.random() * PAGE_URLS.length)]
    const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
    const ip = IPS[Math.floor(Math.random() * IPS.length)]

    // 随机偏移：过去 30 天内，按时间段密度分布
    const daysAgo = Math.floor(Math.random() * 30)
    const hoursOffset = getTimeDistribution()
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

  // 生成错误事件
  for (let i = 0; i < errorCount; i++) {
    const uid = UIDS[Math.floor(Math.random() * UIDS.length)]
    const sessionId = SESSION_IDS[Math.floor(Math.random() * SESSION_IDS.length)]
    const pageUrl = PAGE_URLS[Math.floor(Math.random() * PAGE_URLS.length)]
    const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
    const ip = IPS[Math.floor(Math.random() * IPS.length)]

    const daysAgo = Math.floor(Math.random() * 30)
    const hoursOffset = getTimeDistribution()
    const minutesOffset = Math.floor(Math.random() * 60)
    const occurredAt = new Date(now - daysAgo * DAY_MS - hoursOffset * 3600000 - minutesOffset * 60000)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ')

    const errorType = ERROR_TYPES[Math.floor(Math.random() * ERROR_TYPES.length)]
    const message = ERROR_MESSAGES[Math.floor(Math.random() * ERROR_MESSAGES.length)]
    const errorName = message.split(':')[0]
    const duration = Math.floor(Math.random() * 5000) + 200

    const eventParams = JSON.stringify({
      type: errorType,
      message,
      errorName,
      duration,
    })

    events.push([
      PROJECT_ID,
      `error_${errorType}`,
      'error',
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

    // ── 3. 插入模拟事件日志（每次追加 300 条） ──────────────
    const beforeCount = await conn.query('SELECT COUNT(*) as cnt FROM event_log')
    const events = generateEvents(300, 30)
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
    const cnt = Number(beforeCount[0].cnt)
    console.log(`追加 ${events.length} 条模拟事件日志成功（当前总量：${cnt} → ${cnt + events.length}）`)

    // ── 3.1 生成近期突发事件（最近 10 分钟内，用于触发告警） ──
    const BURST_EVENTS = [
      { event_name: 'page_view', event_type: 'page_view', count: 150 },
      { event_name: 'button_click', event_type: 'click', count: 90 },
      { event_name: 'api_call', event_type: 'custom', count: 50 },
      { event_name: 'error_js-error', event_type: 'error', count: 25 },
    ]
    const burstRows = []
    for (const item of BURST_EVENTS) {
      for (let i = 0; i < item.count; i++) {
        const occurredAt = new Date(
          Date.now() - Math.floor(Math.random() * 9) * 60000 - Math.floor(Math.random() * 60) * 1000,
        )
          .toISOString()
          .slice(0, 19)
          .replace('T', ' ')
        burstRows.push([
          PROJECT_ID,
          item.event_name,
          item.event_type,
          occurredAt,
          UIDS[i % UIDS.length],
          SESSION_IDS[i % SESSION_IDS.length],
          PAGE_URLS[i % PAGE_URLS.length],
          null,
          USER_AGENTS[0],
          IPS[0],
        ])
      }
    }
    for (let i = 0; i < burstRows.length; i += batchSize) {
      const batch = burstRows.slice(i, i + batchSize)
      const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')
      await conn.query(
        `INSERT INTO event_log (project_id, event_name, event_type, occurred_at, uid, session_id, page_url, event_params, user_agent, ip) VALUES ${placeholders}`,
        batch.flat(),
      )
    }
    console.log(`追加 ${burstRows.length} 条近期突发事件（最近 10 分钟内，可触发告警）`)

    // ── 4. 创建默认 admin 用户 ──────────────────────────────
    const existingUser = await conn.query('SELECT id FROM user WHERE username = ?', ['admin'])
    if (existingUser.length === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10)
      await conn.query(
        'INSERT INTO user (username, password_hash, name, email, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
        ['admin', hashedPassword, 'Admin', 'admin@tracega.com', 'admin'],
      )
      console.log('默认 admin 用户创建成功（密码: admin123）')
    } else {
      console.log('admin 用户已存在，跳过创建')
    }

    // ── 4. 告警规则（幂等：先清空再重建，指向真实项目 trace-app） ──
    await conn.query('DELETE FROM alarm')
    await conn.query(`INSERT INTO alarm (project_id, event_name, threshold, operator, notify_type, webhook_url, status) VALUES
      ('trace-app', 'page_view', 100, 'gt', 'webhook', 'https://webhook.site/demo-tracega-alarm', 1),
      ('trace-app', 'button_click', 60, 'gt', 'webhook', 'https://webhook.site/demo-tracega-alarm', 1),
      ('trace-app', 'api_call', 100, 'lt', 'webhook', 'https://webhook.site/demo-tracega-alarm', 1),
      ('trace-app', 'error_js-error', 20, 'gt', 'webhook', 'https://webhook.site/demo-tracega-alarm', 1)
    `)
    console.log('插入 4 条告警规则成功（project_id 指向 trace-app，可被定时任务触发）')

    // ── 4.1 告警记录（alarm_record） ────────────────────
    const existingAlarmRecords = await conn.query('SELECT COUNT(*) AS cnt FROM alarm_record')
    if (Number(existingAlarmRecords[0].cnt) > 0) {
      console.log('告警记录已存在，跳过创建')
    } else {
      const now = Date.now()
      const DAY_MS = 86400000
      const ALARM_SAMPLES = [
        { name: '页面浏览量异常飙升', alarm_type: '错误量超阈值', level: 'critical', event_name: 'page_view', rule: 'page_view > 10000', message: '页面 page_view 事件量在 5 分钟内从均值 2000 飙升至 18500，超过阈值 10000，触发严重告警', data: { eventName: 'page_view', currentValue: 18500, threshold: 10000, operator: 'gt' } },
        { name: 'API 响应延迟超过 2s', alarm_type: 'API响应延迟', level: 'high', event_name: 'api_call', rule: 'api_call > 2000', message: 'API 接口 /api/analysis/summary 平均响应时间 2.3s，超过阈值 2s', data: { eventName: 'api_call', currentValue: 2300, threshold: 2000, operator: 'gt' } },
        { name: '错误事件数量突增', alarm_type: '错误量超阈值', level: 'high', event_name: 'error', rule: 'error > 100', message: '5 分钟内错误事件数量达 142 条，超过阈值 100', data: { eventName: 'error', currentValue: 142, threshold: 100, operator: 'gt' } },
        { name: '点击量低于预期', alarm_type: '事件量低于阈值', level: 'low', event_name: 'button_click', rule: 'button_click < 500', message: '今日 button_click 事件量 320 次，低于阈值 500', data: { eventName: 'button_click', currentValue: 320, threshold: 500, operator: 'lt' } },
        { name: '订单完成率异常下降', alarm_type: '事件量低于阈值', level: 'medium', event_name: '订单完成', rule: '订单完成 < 500', message: '今日订单完成事件量 210 次，低于阈值 500，转化率异常', data: { eventName: '订单完成', currentValue: 210, threshold: 500, operator: 'lt' } },
      ]
      const ALARM_STATUS = ['pending', 'processing', 'resolved', 'closed']

      const alarmRecords = []
      for (let i = 0; i < 30; i++) {
        const sample = ALARM_SAMPLES[i % ALARM_SAMPLES.length]
        const daysAgo = Math.floor(Math.random() * 7)
        const hoursOffset = 9 + Math.floor(Math.random() * 12)
        const minutesOffset = Math.floor(Math.random() * 60)
        const createdAt = new Date(now - daysAgo * DAY_MS - hoursOffset * 3600000 - minutesOffset * 60000)
          .toISOString()
          .slice(0, 19)
          .replace('T', ' ')

        alarmRecords.push([
          'app001',
          sample.event_name,
          sample.name,
          sample.alarm_type,
          sample.level,
          ALARM_STATUS[i % ALARM_STATUS.length],
          sample.rule,
          sample.message,
          JSON.stringify(sample.data),
          createdAt,
          createdAt,
        ])
      }

      const batchSize = 20
      for (let i = 0; i < alarmRecords.length; i += batchSize) {
        const batch = alarmRecords.slice(i, i + batchSize)
        const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')
        await conn.query(
          `INSERT INTO alarm_record (project_id, event_name, name, alarm_type, level, status, rule, message, data, created_at, updated_at) VALUES ${placeholders}`,
          batch.flat(),
        )
      }
      console.log(`插入 ${alarmRecords.length} 条告警记录成功`)
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
