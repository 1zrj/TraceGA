/// <reference types="jest" />
import { Test, TestingModule } from '@nestjs/testing';
import { PromptService } from '../services/prompt.service';

// 模块级 mock：替换 fs 的所有方法为 jest.fn()
// jest.mock 会被 Jest 提升到 import 之前执行，因此工厂函数不能引用外部变量
jest.mock('fs', () => ({
  readdirSync: jest.fn(),
  readFileSync: jest.fn(),
  watch: jest.fn(() => ({ close: jest.fn() })),
  existsSync: jest.fn(),
}));

describe('PromptService', () => {
  let service: PromptService;

  beforeEach(async () => {
    jest.clearAllMocks();

    // 通过 jest.requireMock 获取 mock 模块引用，以便设置返回值
    const fs = jest.requireMock('fs') as jest.Mocked<typeof import('fs')>;

    fs.readdirSync.mockReturnValue(['test.system.txt', 'test.user.txt'] as any);
    fs.readFileSync.mockImplementation((filePath: any) => {
      const file = String(filePath);
      if (file.includes('test.system.txt')) return 'SYSTEM: {{role}}';
      if (file.includes('test.user.txt')) return 'USER: {{question}}';
      return '默认模板内容';
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [PromptService],
    }).compile();

    service = module.get(PromptService);
  });

  // ==================== 变量替换 ====================

  describe('变量替换', () => {
    it('应正确替换单个 {{变量}}', () => {
      const fs = jest.requireMock('fs') as jest.Mocked<typeof import('fs')>;
      fs.readFileSync.mockReturnValue('你好 {{name}}，欢迎使用');

      const result = service.system('test', { name: '张三' });

      expect(result).toBe('你好 张三，欢迎使用');
    });

    it('应正确替换多个 {{变量}}', () => {
      const fs = jest.requireMock('fs') as jest.Mocked<typeof import('fs')>;
      fs.readFileSync.mockReturnValue('{{greeting}} {{name}}，今天是 {{date}}');

      const result = service.user('test', {
        greeting: '你好',
        name: '李四',
        date: '2026-07-10',
      });

      expect(result).toBe('你好 李四，今天是 2026-07-10');
    });

    it('变量未提供时，应保留原始占位符', () => {
      const fs = jest.requireMock('fs') as jest.Mocked<typeof import('fs')>;
      fs.readFileSync.mockReturnValue('你好 {{name}}');

      const result = service.system('test', {});

      expect(result).toBe('你好 {{name}}');
    });

    it('部分变量未提供时，已提供的替换，未提供的保留', () => {
      const fs = jest.requireMock('fs') as jest.Mocked<typeof import('fs')>;
      fs.readFileSync.mockReturnValue('{{a}} 和 {{b}} 和 {{c}}');

      const result = service.user('test', { a: '一', c: '三' });

      expect(result).toBe('一 和 {{b}} 和 三');
    });

    it('无占位符的纯文本应原样返回', () => {
      const fs = jest.requireMock('fs') as jest.Mocked<typeof import('fs')>;
      fs.readFileSync.mockReturnValue('这是没有变量的纯文本');

      const result = service.system('test');

      expect(result).toBe('这是没有变量的纯文本');
    });

    it('空模板应返回空字符串', () => {
      const fs = jest.requireMock('fs') as jest.Mocked<typeof import('fs')>;
      fs.readFileSync.mockReturnValue('');

      const result = service.system('test');

      expect(result).toBe('');
    });
  });

  // ==================== system / user 方法 ====================

  describe('system() 和 user() 方法', () => {
    it('system() 应读取 <name>.system.txt', () => {
      const result = service.system('test', { role: '分析师' });

      expect(result).toBe('SYSTEM: 分析师');
    });

    it('user() 应读取 <name>.user.txt', () => {
      const result = service.user('test', { question: '今天PV多少' });

      expect(result).toBe('USER: 今天PV多少');
    });
  });

  // ==================== 文件读取错误 ====================

  describe('文件读取错误', () => {
    it('不存在的 Prompt 文件应抛出明确错误', () => {
      const fs = jest.requireMock('fs') as jest.Mocked<typeof import('fs')>;
      fs.readFileSync.mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      expect(() => service.system('nonexistent')).toThrow('Prompt 文件不存在或无法读取');
    });
  });

  // ==================== 缓存行为 ====================

  describe('缓存行为', () => {
    it('第二次调用同一文件应命中缓存，不再 readFileSync', () => {
      const fs = jest.requireMock('fs') as jest.Mocked<typeof import('fs')>;

      // 第一次调用：缓存 miss，触发 readFileSync 读盘
      const first = service.system('test', { role: '分析师' });
      expect(first).toBe('SYSTEM: 分析师');

      // 记录此时的 readFileSync 调用次数（包含 onModuleInit 中的加载）
      const callCountAfterFirst = fs.readFileSync.mock.calls.length;

      // 第二次调用：应命中缓存，不再读盘
      const second = service.system('test', { role: '分析师' });
      expect(second).toBe('SYSTEM: 分析师');

      // readFileSync 不应有新增调用
      expect(fs.readFileSync.mock.calls.length - callCountAfterFirst).toBe(0);
    });
  });
});
