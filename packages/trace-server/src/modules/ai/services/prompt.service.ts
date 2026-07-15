import { Injectable, Logger } from '@nestjs/common'
import { readFileSync } from 'fs'
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
 * 当前版本每次调用都从磁盘读取（文件很小，性能影响可忽略）。
 * 后续如果性能敏感，可以改为启动时加载 + 文件变更时热重载。
 */
@Injectable()
export class PromptService {
  private readonly logger = new Logger(PromptService.name)

  /** Prompt 模板文件存放目录 */
  private readonly promptsDir: string

  constructor() {
    // __dirname 当前是 services/ 目录，prompts/ 在它上面一层
    this.promptsDir = resolve(__dirname, '..', 'prompts')
  }

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
   * 底层方法：读文件 + 替换变量
   */
  private load(fileName: string, vars: Record<string, string>): string {
    const filePath = resolve(this.promptsDir, fileName)

    let raw: string
    try {
      raw = readFileSync(filePath, 'utf8')
    } catch (err) {
      this.logger.error(`无法读取 Prompt 文件: ${filePath}`, err)
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
