import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { readFileSync, readdirSync, watch } from 'fs'
import { resolve } from 'path'

/**
 * PromptService
 *
 * 职责：从文件加载 Prompt 模板，填充变量，返回拼好的字符串。
 *
 * 为什么用文件而不是硬编码？
 * - 调 Prompt 是高频操作，改文件比重启服务方便
 * - git diff 能追踪每次 Prompt 的变更
 * - 不同功能的 Prompt 各管各的，不会混在一个大文件里
 *
 * 启动时一次性加载所有 Prompt 文件到内存，后续读取走缓存。
 * 开发环境下通过 fs.watch 热重载文件变更（无需重启服务）。
 */
@Injectable()
export class PromptService implements OnModuleInit {
  private readonly logger = new Logger(PromptService.name)

  /** Prompt 模板文件存放目录 */
  private readonly promptsDir: string

  /** 缓存：文件名 → 模板内容 */
  private readonly cache = new Map<string, string>()

  constructor() {
    // __dirname 当前是 services/ 目录，prompts/ 在它上面一层
    this.promptsDir = resolve(__dirname, '..', 'prompts')
  }

  // ===== 生命周期：启动时加载 + 热重载 =====

  onModuleInit() {
    this.loadAll()
    this.watchHotReload()
  }

  /**
   * 启动时扫描 prompts 目录，将所有 .txt 文件读入缓存
   */
  private loadAll() {
    let files: string[]
    try {
      files = readdirSync(this.promptsDir)
    } catch (err) {
      this.logger.error(`无法读取 Prompts 目录: ${this.promptsDir}`, err)
      return
    }

    for (const file of files) {
      if (!file.endsWith('.txt')) continue
      this.loadFileToCache(file)
    }

    this.logger.log(`Prompt 模板加载完成，共 ${this.cache.size} 个文件`)
  }

  /**
   * 将单个文件读入缓存
   */
  private loadFileToCache(fileName: string) {
    const filePath = resolve(this.promptsDir, fileName)
    try {
      const content = readFileSync(filePath, 'utf8')
      this.cache.set(fileName, content)
    } catch (err) {
      this.logger.error(`无法读取 Prompt 文件: ${filePath}`, err)
    }
  }

  /**
   * 开发环境热重载：监听文件变更后刷新缓存
   *
   * 用 try-catch 包裹，生产环境可能因权限或 fs.watch 不支持而静默失败。
   */
  private watchHotReload() {
    try {
      const watcher = watch(this.promptsDir, (eventType, fileName) => {
        if (!fileName || !fileName.endsWith('.txt')) return
        this.logger.log(`Prompt 文件变更 (${eventType}): ${fileName}，重新加载`)
        this.loadFileToCache(fileName)
      })
      // 当进程退出或模块销毁时，watcher 会被自动垃圾回收
      // 不显式调用 watcher.close()，因为 PromptService 是 singleton，存活于整个进程生命周期
    } catch {
      // 某些平台/容器不支持 fs.watch，静默忽略即可
    }
  }

  // ===== 公开 API =====

  /**
   * 加载 system prompt 文件
   *
   * @param name  功能名称，对应 prompts/<name>.system.txt
   * @param vars  要替换的变量，key-value 对
   * @returns     替换后的 system prompt 文本
   *
   * 示例：
   *   promptService.system('analyze', { appName: '我的应用' })
   *   → 读取 prompts/analyze.system.txt，把 {{appName}} 替换为 "我的应用"
   */
  system(name: string, vars: Record<string, string> = {}): string {
    return this.load(`${name}.system.txt`, vars)
  }

  /**
   * 加载 user prompt 文件
   *
   * @param name  功能名称，对应 prompts/<name>.user.txt
   * @param vars  要替换的变量，key-value 对
   * @returns     替换后的 user prompt 文本
   */
  user(name: string, vars: Record<string, string> = {}): string {
    return this.load(`${name}.user.txt`, vars)
  }

  /**
   * 底层方法：从缓存读取 + 替换变量
   *
   * 缓存 miss 时仍尝试从磁盘读取（兼容缓存未初始化或新文件热加载前的边界情况）。
   */
  private load(fileName: string, vars: Record<string, string>): string {
    let raw = this.cache.get(fileName)

    // 缓存 miss：从磁盘读取（兜底）
    if (raw === undefined) {
      this.loadFileToCache(fileName)
      raw = this.cache.get(fileName)
    }

    if (raw === undefined) {
      throw new Error(`Prompt 文件不存在或无法读取: ${fileName}`)
    }

    return this.render(raw, vars)
  }

  /**
   * 将模板中的 {{key}} 替换为 vars[key]
   *
   * 示例：
   *   render('你好 {{name}}，今天是 {{date}}', { name: '张三', date: '2026-07-10' })
   *   → '你好 张三，今天是 2026-07-10'
   */
  private render(template: string, vars: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return vars[key] !== undefined ? vars[key] : match
    })
  }
}
