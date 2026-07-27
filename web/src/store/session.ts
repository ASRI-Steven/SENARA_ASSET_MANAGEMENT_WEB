import { create } from 'zustand'
import { api, firstRow } from '@/api/client'

export type SessionStatus = 'unknown' | 'authenticated' | 'unauthenticated'

export interface SessionUser {
  nik: string
  name: string
}

interface SessionState {
  status: SessionStatus
  user: SessionUser | null
  /** Resolve the current session from the httpOnly cookie (GET /api/auth/check). */
  check: () => Promise<void>
  /** POST /api/auth/login; throws on invalid credentials. */
  login: (nik: string, password: string) => Promise<void>
  /** POST /api/auth/logout; clears the cookie server-side. */
  logout: () => Promise<void>
}

interface AuthRow {
  NIK?: string
  Name?: string
  Session_ID?: string
}

// The session lives entirely in the BFF's httpOnly cookie. This store only
// mirrors the identity (name/NIK) for the UI — it holds no token.
export const useSession = create<SessionState>((set) => ({
  status: 'unknown',
  user: null,

  check: async () => {
    try {
      const env = await api.get<AuthRow>('/api/auth/check')
      const row = firstRow(env)
      if (env.status === 'success' && row?.Name) {
        set({ status: 'authenticated', user: { nik: row.NIK ?? '', name: row.Name } })
      } else {
        set({ status: 'unauthenticated', user: null })
      }
    } catch {
      set({ status: 'unauthenticated', user: null })
    }
  },

  login: async (nik, password) => {
    const env = await api.post<AuthRow>('/api/auth/login', { NIK: nik, Password: password })
    const row = firstRow(env)
    if (env.status !== 'success' || !row?.Session_ID) {
      throw new Error(env.message || 'NIK atau password salah')
    }
    set({ status: 'authenticated', user: { nik: row.NIK ?? nik, name: row.Name ?? nik } })
  },

  logout: async () => {
    try {
      await api.post('/api/auth/logout')
    } catch {
      // ignore — clear the UI regardless
    }
    set({ status: 'unauthenticated', user: null })
  },
}))
