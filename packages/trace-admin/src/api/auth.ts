import request from '@/utils/request'
import type { LoginDto, LoginResult, RegisterDto, RegisterResult, ProfileResult } from '@/types'

export const login = (data: LoginDto) => {
  return request.post<LoginResult>('/auth/login', data)
}

export const register = (data: RegisterDto) => {
  return request.post<RegisterResult>('/auth/register', data)
}

export const logout = () => {
  return request.post<null>('/auth/logout')
}

export const getProfile = () => {
  return request.get<ProfileResult>('/auth/profile')
}
