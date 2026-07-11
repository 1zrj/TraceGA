import request from '@/utils/request'
import type { LoginDto, LoginResult } from '@/types'

export const login = (data: LoginDto) => {
  return request.post<LoginResult>('/auth/login', data)
}

export const logout = () => {
  return request.post<null>('/auth/logout')
}