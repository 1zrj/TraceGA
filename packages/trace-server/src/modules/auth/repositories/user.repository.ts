import { Injectable } from '@nestjs/common'
import { Prisma } from '@generated/prisma'
import { PrismaService } from '@/database/prisma.service'
import { User } from '../entities/user.entity'

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    })
    return user ? this.toUser(user) : null
  }

  async findByPhone(phone: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { phone },
    })
    return user ? this.toUser(user) : null
  }

  async findById(id: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(id) },
    })
    return user ? this.toUser(user) : null
  }

  async create(data: { username: string; email: string; phone: string; passwordHash: string; role?: string }): Promise<User> {
    const user = await this.prisma.user.create({
      data: {
        username: data.username,
        email: data.email,
        phone: data.phone,
        password_hash: data.passwordHash,
        role: data.role ?? 'admin',
        status: 1,
      },
    })
    return this.toUser(user)
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: BigInt(id) },
      data: { last_login_at: new Date() },
    })
  }

  private toUser(user: Prisma.userGetPayload<Record<string, never>>): User {
    return {
      id: user.id.toString(),
      username: user.username,
      email: user.email,
      phone: user.phone,
      passwordHash: user.password_hash,
      role: user.role ?? 'admin',
      avatar: user.avatar,
      status: user.status ?? 1,
      lastLoginAt: user.last_login_at,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    }
  }
}
