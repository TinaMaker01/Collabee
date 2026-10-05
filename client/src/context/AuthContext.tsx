/* eslint-disable react-refresh/only-export-components, react-hooks/set-state-in-effect */

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { get, post } from '../api/client'

interface User {
  id: number
  name: string
  email: string
  role: string
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchUser = useCallback(async () => {
    const token = localStorage.getItem('auth_token')
    if (!token) {
      setIsLoading(false)
      return
    }
    try {
      const data = await get<User>('/auth/me')
      setUser(data)
    } catch {
      localStorage.removeItem('auth_token')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchUser()
  }, [fetchUser])

  // TODO: Migrate to httpOnly cookies for better XSS protection.
  // Storing JWTs in localStorage makes them accessible to any JS executing on the page.
  // The server should set the token as an httpOnly, Secure, SameSite=Strict cookie instead.
  const login = useCallback(async (email: string, password: string) => {
    const data = await post<{ user: User; token: string }>('/auth/login', { email, password })
    localStorage.setItem('auth_token', data.token)
    setUser(data.user)
  }, [])

  const register = useCallback(async (name: string, email: string, password: string) => {
    const data = await post<{ user: User; token: string }>('/auth/register', { name, email, password })
    localStorage.setItem('auth_token', data.token)
    setUser(data.user)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token')
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
