export interface User {
  id: string
  username: string
  email: string
  phone: string
  passwordHash: string
  role: string
  avatar: string | null
  status: number
  lastLoginAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface UserWithoutPassword {
  id: string
  username: string
  email: string
  phone: string
  role: string
  avatar: string | null
  status: number
  lastLoginAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export function toUserWithoutPassword(user: User): UserWithoutPassword {
  const { passwordHash: _, ...rest } = user
  return rest
}
