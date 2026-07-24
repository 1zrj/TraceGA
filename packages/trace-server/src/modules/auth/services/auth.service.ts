import { BadRequestException, ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcryptjs'
import { UserRepository } from '../repositories/user.repository'
import { RegisterDto } from '../dto/register.dto'
import { LoginDto } from '../dto/login.dto'
import { User, toUserWithoutPassword, UserWithoutPassword } from '../entities/user.entity'

const SALT_ROUNDS = 10

// 登录频率限制：同一标识（邮箱/手机号）5 分钟内最多失败 5 次
const LOGIN_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000
const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 5

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)
  private readonly loginAttempts = new Map<string, { count: number; firstAttemptAt: number }>()

  constructor(
    private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<{ token: string; user: UserWithoutPassword }> {
    // 检查邮箱是否已注册
    const existingByEmail = await this.userRepository.findByEmail(dto.email)
    if (existingByEmail) {
      throw new ConflictException('该邮箱已被注册')
    }

    // 检查手机号是否已注册
    const existingByPhone = await this.userRepository.findByPhone(dto.phone)
    if (existingByPhone) {
      throw new ConflictException('该手机号已被注册')
    }

    // 密码加密
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS)

    // 创建用户
    const user = await this.userRepository.create({
      username: dto.username,
      email: dto.email,
      phone: dto.phone,
      passwordHash,
      role: dto.role,
    })

    // 生成 JWT
    const token = this.generateToken(user)

    this.logger.log(`用户注册成功: id=${user.id}, email=${user.email}`)

    return { token, user: toUserWithoutPassword(user) }
  }

  async login(dto: LoginDto): Promise<{ token: string; user: UserWithoutPassword }> {
    // 获取登录标识用于频率限制
    const loginKey = dto.email || dto.phone || ''
    this.checkLoginRateLimit(loginKey)

    // 通过邮箱或手机号查找用户
    let user: User | null = null

    if (dto.email) {
      user = await this.userRepository.findByEmail(dto.email)
    } else if (dto.phone) {
      user = await this.userRepository.findByPhone(dto.phone)
    } else {
      throw new BadRequestException('请提供邮箱或手机号')
    }

    if (!user) {
      this.recordFailedAttempt(loginKey)
      throw new UnauthorizedException('账号或密码错误')
    }

    // 检查账号状态
    if (user.status !== 1) {
      this.recordFailedAttempt(loginKey)
      throw new UnauthorizedException('账号已被禁用')
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash)
    if (!isPasswordValid) {
      this.recordFailedAttempt(loginKey)
      throw new UnauthorizedException('账号或密码错误')
    }

    // 登录成功，清除失败记录
    this.loginAttempts.delete(loginKey)

    // 更新最后登录时间
    await this.userRepository.updateLastLogin(user.id)

    // 生成 JWT
    const token = this.generateToken(user)

    this.logger.log(`用户登录成功: id=${user.id}, email=${user.email}`)

    return { token, user: toUserWithoutPassword(user) }
  }

  async getProfile(userId: string): Promise<UserWithoutPassword> {
    const user = await this.userRepository.findById(userId)
    if (!user) {
      throw new UnauthorizedException('用户不存在')
    }
    return toUserWithoutPassword(user)
  }

  async validateUser(userId: string): Promise<UserWithoutPassword | null> {
    const user = await this.userRepository.findById(userId)
    if (!user || user.status !== 1) {
      return null
    }
    return toUserWithoutPassword(user)
  }

  private generateToken(user: User): string {
    const payload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    }
    return this.jwtService.sign(payload)
  }

  // ===== 登录频率限制 =====

  private checkLoginRateLimit(key: string): void {
    if (!key) return
    const record = this.loginAttempts.get(key)
    if (!record) return

    // 窗口已过期，清除记录
    if (Date.now() - record.firstAttemptAt > LOGIN_RATE_LIMIT_WINDOW_MS) {
      this.loginAttempts.delete(key)
      return
    }

    if (record.count >= LOGIN_RATE_LIMIT_MAX_ATTEMPTS) {
      const remainingMs = LOGIN_RATE_LIMIT_WINDOW_MS - (Date.now() - record.firstAttemptAt)
      const remainingMin = Math.ceil(remainingMs / 60000)
      this.logger.warn(`登录频率限制触发: key=${key}, 剩余锁定时间=${remainingMin}分钟`)
      throw new UnauthorizedException(`登录尝试过于频繁，请 ${remainingMin} 分钟后再试`)
    }
  }

  private recordFailedAttempt(key: string): void {
    if (!key) return
    const now = Date.now()
    const record = this.loginAttempts.get(key)

    if (!record || now - record.firstAttemptAt > LOGIN_RATE_LIMIT_WINDOW_MS) {
      this.loginAttempts.set(key, { count: 1, firstAttemptAt: now })
    } else {
      record.count++
    }
  }
}
